import axios from 'axios';
import { TestCase } from './storage.js';
import * as diff from 'diff';

export interface TestResult {
  testId: string;
  passed: boolean;
  actualStatus: number;
  expectedStatus: number;
  diffs: diff.Change[];
}

export async function runTest(testCase: TestCase, targetUrl: string): Promise<TestResult> {
  const url = `${targetUrl}${testCase.request.path}`;
  try {
    const cleanHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(testCase.request.headers || {})) {
      const lowerKey = key.toLowerCase();
      if (!['content-length', 'host', 'connection', 'accept-encoding'].includes(lowerKey)) {
        cleanHeaders[key] = value;
      }
    }

    const res = await axios({
      method: testCase.request.method,
      url,
      headers: cleanHeaders,
      data: Object.keys(testCase.request.body || {}).length > 0 ? testCase.request.body : undefined,
      params: testCase.request.query,
      validateStatus: () => true, // Don't throw on 4xx/5xx
    });

    const expectedBody = testCase.response.body;
    let bodyDiff: diff.Change[] = [];
    let hasDiff = false;

    if (expectedBody !== null && expectedBody !== undefined) {
      bodyDiff = diff.diffJson(expectedBody, res.data || {});
      hasDiff = bodyDiff.some(part => part.added || part.removed);
    }

    const passed = (res.status === testCase.response.status) && !hasDiff;

    return {
      testId: testCase.id,
      passed,
      actualStatus: res.status,
      expectedStatus: testCase.response.status,
      diffs: bodyDiff,
    };
  } catch (error: any) {
    return {
      testId: testCase.id,
      passed: false,
      actualStatus: 0,
      expectedStatus: testCase.response.status,
      diffs: [{ value: error.message, added: true, removed: false, count: 1 }],
    };
  }
}
