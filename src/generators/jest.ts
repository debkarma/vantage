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

function stringifyWithNoise(obj: any, noiseFields: Set<string>): string {
  if (obj === null || obj === undefined) return 'null';
  
  const placeholderObj = JSON.parse(JSON.stringify(obj));
  const placeholders = new Map<string, string>();
  let pIndex = 0;

  function walk(o: any) {
    if (!o || typeof o !== 'object') return;
    for (const key of Object.keys(o)) {
      if (noiseFields.has(key)) {
        const pKey = `__VANTAGE_NOISE_${pIndex++}__`;
        let expectedType = 'String';
        if (typeof o[key] === 'number') expectedType = 'Number';
        else if (typeof o[key] === 'boolean') expectedType = 'Boolean';
        else if (Array.isArray(o[key])) expectedType = 'Array';
        
        placeholders.set(pKey, `expect.any(${expectedType})`);
        o[key] = pKey;
      } else if (typeof o[key] === 'object') {
        walk(o[key]);
      }
    }
  }

  walk(placeholderObj);

  let jsonStr = JSON.stringify(placeholderObj, null, 2);
  
  for (const [pKey, code] of placeholders.entries()) {
    jsonStr = jsonStr.replace(`"${pKey}"`, code);
  }

  return jsonStr;
}

function generateItBlock(tc: TestCase, noiseFields: Set<string>): string {
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
    const expectedStr = stringifyWithNoise(tc.response.body, noiseFields).split('\n').join('\n    ');
    code += `    expect(res.body).toEqual(${expectedStr});\n`;
  }

  code += `  });\n`;
  return code;
}

export const jestGenerator: TestGenerator = {
  generate(testCases: TestCase[], options: GeneratorOptions): GeneratedFile[] {
    const appEntry = options.appEntry || '../../src/app';
    const noiseFields = new Set(options.noiseConfig?.body_fields || []);

    let code = `const request = require('supertest');\n`;

    const containers = options.containerConfigs || [];
    const hasMongo = containers.some(c => c.type === 'mongodb');
    
    if (hasMongo) {
      code += `const { MongoDBContainer } = require('@testcontainers/mongodb');\n`;
      code += `const mongoose = require('mongoose');\n`;
      code += `let mongoContainer;\n`;
    }

    code += `let app;\n`;
    code += `let server;\n\n`;
    code += `describe('Vantage API Tests (sequential)', () => {\n`;

    if (hasMongo) {
      code += `  beforeAll(async () => {\n`;
      code += `    mongoContainer = await new MongoDBContainer("mongo:6.0").start();\n`;
      const mongoConfig = containers.find(c => c.type === 'mongodb')!;
      code += `    process.env.${mongoConfig.env_var} = mongoContainer.getConnectionString() + "/?directConnection=true";\n`;
      code += `    app = require('${appEntry}');\n`;
      code += `    server = app.default || app;\n`;
      code += `  }, 60000);\n\n`;

      code += `  afterAll(async () => {\n`;
      code += `    await mongoose.disconnect();\n`;
      code += `    if (mongoContainer) await mongoContainer.stop();\n`;
      code += `  });\n\n`;
    } else {
      code += `  beforeAll(() => {\n`;
      code += `    app = require('${appEntry}');\n`;
      code += `    server = app.default || app;\n`;
      code += `  });\n\n`;
    }

    for (const tc of testCases) {
      code += generateItBlock(tc, noiseFields);
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
