import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

const VANTAGE_DIR = path.join(process.cwd(), '.vantage');

export interface TestCase {
  id: string;
  metadata: {
    created_at: string;
    app_port: number | null;
    vantage_version: string;
  };
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: any;
    query: Record<string, any>;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
  };
  curl: string;
}

/**
 * Ensure the root .vantage/ directory exists.
 */
export function initVantageDir(): void {
  if (!fs.existsSync(VANTAGE_DIR)) {
    fs.mkdirSync(VANTAGE_DIR, { recursive: true });
  }
}

/**
 * Scan .vantage/ for existing test-set-X directories and return the next index.
 */
export function getNextTestSetIndex(): number {
  initVantageDir();
  const entries = fs.readdirSync(VANTAGE_DIR, { withFileTypes: true });
  let maxIndex = -1;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const match = entry.name.match(/^test-set-(\d+)$/);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx > maxIndex) maxIndex = idx;
      }
    }
  }
  return maxIndex + 1;
}

/**
 * Create a new test-set-X directory with a tests/ subdirectory.
 * Returns the absolute path to the test-set-X directory.
 */
export function createTestSet(index: number): string {
  const testSetDir = path.join(VANTAGE_DIR, `test-set-${index}`);
  const testsDir = path.join(testSetDir, 'tests');
  fs.mkdirSync(testsDir, { recursive: true });
  return testSetDir;
}

/**
 * Turn a request path into a slug for the filename.
 * e.g. "/api/todos" -> "api-todos", "/" -> "root"
 */
function slugifyPath(reqPath: string): string {
  const cleaned = reqPath
    .split('?')[0]          // strip query string
    .replace(/^\/+|\/+$/g, '') // trim leading/trailing slashes
    .replace(/\//g, '-')       // slashes to dashes
    .replace(/[^a-zA-Z0-9-]/g, ''); // strip non-alphanumeric

  return cleaned || 'root';
}

/**
 * Generate a curl command string from a test case's request data.
 */
function buildCurl(req: TestCase['request'], port: number | null): string {
  const baseUrl = `http://localhost:${port || 3000}`;
  const url = `${baseUrl}${req.path}`;
  const parts: string[] = [`curl --request ${req.method}`, `  --url ${url}`];

  // Add relevant headers (skip noisy ones)
  const skipHeaders = new Set(['host', 'connection', 'content-length']);
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (!skipHeaders.has(key.toLowerCase())) {
      parts.push(`  --header '${key}: ${value}'`);
    }
  }

  // Add body for POST/PUT/PATCH
  if (req.body && Object.keys(req.body).length > 0 && ['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
    parts.push(`  --data '${JSON.stringify(req.body)}'`);
  }

  return parts.join(' \\\n');
}

/**
 * Determine the next counter for a given method-slug combo within a test set.
 * e.g. if get-api-todos-1.yaml exists, returns 2.
 */
function getNextCounter(testsDir: string, method: string, slug: string): number {
  if (!fs.existsSync(testsDir)) return 1;

  const prefix = `${method.toLowerCase()}-${slug}-`;
  const files = fs.readdirSync(testsDir).filter(f => f.startsWith(prefix) && f.endsWith('.yaml'));
  let maxCounter = 0;
  for (const file of files) {
    const match = file.match(new RegExp(`^${prefix}(\\d+)\\.yaml$`));
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxCounter) maxCounter = n;
    }
  }
  return maxCounter + 1;
}

/**
 * Save a test case to the active test set directory.
 * Returns the generated test case ID (e.g. "get-api-todos-1").
 */
export function saveTestCase(
  testSetDir: string,
  testCase: { request: TestCase['request']; response: TestCase['response'] },
  appPort: number | null = null
): string {
  const testsDir = path.join(testSetDir, 'tests');
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }

  const slug = slugifyPath(testCase.request.path);
  const method = testCase.request.method.toLowerCase();
  const counter = getNextCounter(testsDir, method, slug);
  const id = `${method}-${slug}-${counter}`;

  const fullTestCase: TestCase = {
    id,
    metadata: {
      created_at: new Date().toISOString(),
      app_port: appPort,
      vantage_version: '1.0.0',
    },
    request: testCase.request,
    response: testCase.response,
    curl: buildCurl(testCase.request, appPort),
  };

  const filePath = path.join(testsDir, `${id}.yaml`);
  const yamlStr = yaml.stringify(fullTestCase);
  fs.writeFileSync(filePath, yamlStr, 'utf8');
  return id;
}

/**
 * Load all test cases from a specific test set directory.
 */
export function loadTestCases(testSetDir: string): TestCase[] {
  const testsDir = path.join(testSetDir, 'tests');
  if (!fs.existsSync(testsDir)) return [];

  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.yaml'));
  const testCases: TestCase[] = [];

  for (const file of files) {
    const filePath = path.join(testsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      const testCase = yaml.parse(content) as TestCase;
      testCases.push(testCase);
    } catch (e) {
      console.error(`Error parsing ${file}:`, e);
    }
  }

  // Ensure tests are replayed in the exact chronological order they were recorded
  testCases.sort((a, b) => {
    const timeA = new Date(a.metadata?.created_at || 0).getTime();
    const timeB = new Date(b.metadata?.created_at || 0).getTime();
    return timeA - timeB;
  });

  return testCases;
}

/**
 * List all test set directories, sorted by index.
 */
export function listTestSets(): { index: number; dir: string; testCount: number }[] {
  initVantageDir();
  const entries = fs.readdirSync(VANTAGE_DIR, { withFileTypes: true });
  const sets: { index: number; dir: string; testCount: number }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^test-set-(\d+)$/);
    if (!match) continue;

    const index = parseInt(match[1], 10);
    const dir = path.join(VANTAGE_DIR, entry.name);
    const testsDir = path.join(dir, 'tests');
    let testCount = 0;
    if (fs.existsSync(testsDir)) {
      testCount = fs.readdirSync(testsDir).filter(f => f.endsWith('.yaml')).length;
    }
    sets.push({ index, dir, testCount });
  }

  return sets.sort((a, b) => a.index - b.index);
}

/**
 * Save a test run report to .vantage/reports/test-run-X/test-set-Y-report.yaml
 */
export function saveTestReport(testSetIndex: number, results: any[]): string {
  initVantageDir();
  const reportsDir = path.join(VANTAGE_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const entries = fs.readdirSync(reportsDir, { withFileTypes: true });
  let maxRunIndex = -1;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const m = entry.name.match(/^test-run-(\d+)$/);
      if (m) {
        const idx = parseInt(m[1], 10);
        if (idx > maxRunIndex) maxRunIndex = idx;
      }
    }
  }
  const nextRunIndex = maxRunIndex + 1;
  const runDir = path.join(reportsDir, `test-run-${nextRunIndex}`);
  fs.mkdirSync(runDir, { recursive: true });

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  const status = failedCount === 0 ? 'PASSED' : 'FAILED';

  const reportData = {
    status,
    created_at: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: passedCount,
      failed: failedCount,
    },
    tests: results.map(r => ({
      id: r.testId,
      status: r.passed ? 'PASSED' : 'FAILED',
      actual_status: r.actualStatus,
      expected_status: r.expectedStatus,
      diffs: r.passed ? undefined : r.diffs,
    })),
  };

  const filePath = path.join(runDir, `test-set-${testSetIndex}-report.yaml`);
  fs.writeFileSync(filePath, yaml.stringify(reportData), 'utf8');
  return filePath;
}
