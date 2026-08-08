import { TestCase } from '../engine/storage.js';
import { TestGenerator, GeneratedFile, GeneratorOptions } from './base.js';

const NOISE_HEADERS = new Set([
  'host', 'connection', 'accept-encoding', 'content-length',
  'cache-control', 'postman-token', 'user-agent',
]);

function filterHeaders(headers: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!NOISE_HEADERS.has(key.toLowerCase())) {
      filtered[key] = value;
    }
  }
  return filtered;
}

function toPythonDict(obj: any, indent: number = 4): string {
  const json = JSON.stringify(obj, null, indent);
  return json
    .replace(/: true/g, ': True')
    .replace(/: false/g, ': False')
    .replace(/: null/g, ': None');
}

function generateTestFunc(tc: TestCase, baseUrl: string): string {
  const method = tc.request.method.toLowerCase();
  const path = tc.request.path;
  const headers = filterHeaders(tc.request.headers || {});
  const hasBody = tc.request.body && Object.keys(tc.request.body).length > 0;
  const hasHeaders = Object.keys(headers).length > 0;
  const funcName = tc.id.replace(/-/g, '_');

  let code = `\ndef test_${funcName}():\n`;
  code += `    """${tc.request.method} ${path} — recorded by Vantage"""\n`;

  const args: string[] = [`f"{BASE_URL}${path}"`];

  if (hasHeaders) {
    args.push(`headers=${toPythonDict(headers)}`);
  }

  if (hasBody) {
    args.push(`json=${toPythonDict(tc.request.body)}`);
  }

  if (args.length === 1) {
    code += `    response = httpx.${method}(${args[0]})\n`;
  } else {
    code += `    response = httpx.${method}(\n`;
    for (const arg of args) {
      code += `        ${arg},\n`;
    }
    code += `    )\n`;
  }

  code += `\n`;
  code += `    assert response.status_code == ${tc.response.status}\n`;

  if (tc.response.body !== null && tc.response.body !== undefined && tc.response.status !== 204) {
    code += `    assert response.json() == ${toPythonDict(tc.response.body)}\n`;
  }

  return code;
}

export const pytestGenerator: TestGenerator = {
  generate(testCases: TestCase[], options: GeneratorOptions): GeneratedFile[] {
    const baseUrl = options.targetUrl || 'http://localhost:3000';

    // Single file with all tests in sequence — preserves state across requests
    let code = `"""Vantage API Tests — run against a live server (sequential)"""\nimport httpx\n\n`;
    code += `BASE_URL = "${baseUrl}"\n`;

    for (const tc of testCases) {
      code += generateTestFunc(tc, baseUrl);
    }

    code += `\n`;

    const baseName = options.testSetName ? options.testSetName.replace(/-/g, '_') : 'vantage';

    return [{
      filename: `test_${baseName}.py`,
      content: code,
    }];
  },
};
