import { TestCase } from '../engine/storage.js';
import { TestGenerator, GeneratedFile, GeneratorOptions } from './base.js';

// Headers that are transport artifacts, not app behavior
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

function generateItBlock(tc: TestCase): string {
  const method = tc.request.method.toLowerCase();
  const path = tc.request.path;
  const headers = filterHeaders(tc.request.headers || {});
  const hasBody = tc.request.body && Object.keys(tc.request.body).length > 0;

  let code = `  it('${tc.id} — ${tc.request.method} ${path}', async () => {\n`;
  code += `    const res = await request(server)\n`;
  code += `      .${method}('${path}')`;

  for (const [key, value] of Object.entries(headers)) {
    code += `\n      .set('${key}', '${value}')`;
  }

  if (hasBody) {
    code += `\n      .send(${JSON.stringify(tc.request.body)})`;
  }

  code += `;\n\n`;
  code += `    expect(res.status).toBe(${tc.response.status});\n`;

  if (tc.response.body !== null && tc.response.body !== undefined && tc.response.status !== 204) {
    code += `    expect(res.body).toEqual(${JSON.stringify(tc.response.body, null, 2).split('\n').join('\n    ')});\n`;
  }

  code += `  });\n`;
  return code;
}

export const jestGenerator: TestGenerator = {
  generate(testCases: TestCase[], options: GeneratorOptions): GeneratedFile[] {
    const appEntry = options.appEntry || '../../src/app';

    // Single file with all tests in sequence — preserves state across requests
    let code = `const request = require('supertest');\n`;
    code += `const app = require('${appEntry}');\n\n`;
    code += `const server = app.default || app;\n\n`;
    code += `describe('Vantage API Tests (sequential)', () => {\n`;

    for (const tc of testCases) {
      code += generateItBlock(tc);
      code += `\n`;
    }

    code += `});\n`;

    const baseName = options.testSetName || 'vantage-tests';

    return [{
      filename: `${baseName}.test.cjs`,
      content: code,
    }];
  },
};
