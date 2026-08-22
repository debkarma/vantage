import axios from 'axios';
import { TestCase } from './storage.js';
import { NoiseConfig, filterNoise } from './noiseFilter.js';
import * as diff from 'diff';
import { performance } from 'perf_hooks';

export type FailureCategory = 'STATUS_CODE_CHANGED' | 'BODY_CHANGED' | 'HEADER_CHANGED' | 'CONNECTION_ERROR';

export interface TestResult {
  testId: string;
  passed: boolean;
  actualStatus: number;
  expectedStatus: number;
  failureCategory?: FailureCategory;
  timeTakenMs: number;
  bodyDiffs: diff.Change[];
  headerDiffs: diff.Change[];
}

export async function runTest(
  testCase: TestCase,
  targetUrl: string,
  noiseConfig: NoiseConfig
): Promise<TestResult> {
  const url = `${targetUrl}${testCase.request.path}`;
  const startTime = performance.now();

  try {
    // Strip hop-by-hop headers that cause hanging on replay
    const cleanHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(testCase.request.headers || {})) {
      const lowerKey = key.toLowerCase();
      if (!['content-length', 'host', 'connection', 'accept-encoding'].includes(lowerKey)) {
        cleanHeaders[key] = value;
      }
    }

    let requestData = Object.keys(testCase.request.body || {}).length > 0 ? testCase.request.body : undefined;
    if (typeof requestData === 'string' && requestData.startsWith('data:application/octet-stream;base64,')) {
      requestData = Buffer.from(requestData.split(',')[1], 'base64');
    }

    const res = await axios({
      method: testCase.request.method,
      url,
      headers: cleanHeaders,
      data: requestData,
      params: testCase.request.query,
      validateStatus: () => true,
    });

    const timeTakenMs = Math.round(performance.now() - startTime);

    // --- Status check ---
    const statusMatches = res.status === testCase.response.status;

    // --- Body diff (with noise filtering) ---
    const expectedBody = testCase.response.body;
    let bodyDiffs: diff.Change[] = [];
    let hasBodyDiff = false;

    if (expectedBody !== null && expectedBody !== undefined) {
      const { filteredExpectedBody, filteredActualBody } = filterNoise(
        expectedBody, res.data || {},
        {}, {}, // headers handled separately below
        noiseConfig
      );
      bodyDiffs = diff.diffJson(filteredExpectedBody, filteredActualBody);
      hasBodyDiff = bodyDiffs.some(part => part.added || part.removed);
    }

    // --- Header diff (only compare headers present in the recorded YAML) ---
    const expectedHeaders = testCase.response.headers || {};
    const actualHeaders = res.headers || {};
    let headerDiffs: diff.Change[] = [];
    let hasHeaderDiff = false;

    if (Object.keys(expectedHeaders).length > 0) {
      const { filteredExpectedHeaders, filteredActualHeaders } = filterNoise(
        null, null,
        expectedHeaders, actualHeaders as Record<string, string>,
        noiseConfig
      );

      // Only compare headers that were recorded (subset comparison)
      const recordedSubset: Record<string, string> = {};
      const actualSubset: Record<string, string> = {};
      for (const key of Object.keys(filteredExpectedHeaders)) {
        const lowerKey = key.toLowerCase();
        recordedSubset[lowerKey] = String(filteredExpectedHeaders[key]);
        // Find matching header in actual (case-insensitive)
        const actualKey = Object.keys(filteredActualHeaders).find(k => k.toLowerCase() === lowerKey);
        if (actualKey !== undefined) {
          actualSubset[lowerKey] = String(filteredActualHeaders[actualKey]);
        }
      }

      headerDiffs = diff.diffJson(recordedSubset, actualSubset);
      hasHeaderDiff = headerDiffs.some(part => part.added || part.removed);
    }

    // --- Determine pass/fail and category ---
    const passed = statusMatches && !hasBodyDiff && !hasHeaderDiff;

    let failureCategory: FailureCategory | undefined;
    if (!passed) {
      if (!statusMatches) failureCategory = 'STATUS_CODE_CHANGED';
      else if (hasBodyDiff) failureCategory = 'BODY_CHANGED';
      else if (hasHeaderDiff) failureCategory = 'HEADER_CHANGED';
    }

    return {
      testId: testCase.id,
      passed,
      actualStatus: res.status,
      expectedStatus: testCase.response.status,
      failureCategory,
      timeTakenMs,
      bodyDiffs,
      headerDiffs,
    };
  } catch (error: any) {
    const timeTakenMs = Math.round(performance.now() - startTime);
    return {
      testId: testCase.id,
      passed: false,
      actualStatus: 0,
      expectedStatus: testCase.response.status,
      failureCategory: 'CONNECTION_ERROR',
      timeTakenMs,
      bodyDiffs: [{ value: error.message, added: true, removed: false, count: 1 }],
      headerDiffs: [],
    };
  }
}
