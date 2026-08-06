import { VantageConfig } from './config.js';

export interface NoiseConfig {
  headers: string[];
  body_fields: string[];
}

/**
 * Deep-clone an object (JSON-safe only).
 */
function deepClone<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Remove a field from an object using dot-notation path.
 * e.g. removeField(obj, "data.createdAt") removes obj.data.createdAt
 */
function removeField(obj: any, fieldPath: string): void {
  if (!obj || typeof obj !== 'object') return;

  const parts = fieldPath.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || typeof current[parts[i]] !== 'object') return;
    current = current[parts[i]];
  }

  const lastKey = parts[parts.length - 1];

  // Handle arrays: apply removal to each element
  if (Array.isArray(current)) {
    for (const item of current) {
      if (item && typeof item === 'object') {
        delete item[lastKey];
      }
    }
  } else {
    delete current[lastKey];
  }
}

/**
 * Remove a field from an object or array recursively at the top level.
 * If the body is an array, apply field removal to each element.
 */
function removeFieldFromBody(body: any, fieldPath: string): void {
  if (Array.isArray(body)) {
    // For top-level arrays, apply to each item
    for (const item of body) {
      removeField(item, fieldPath);
    }
  } else {
    removeField(body, fieldPath);
  }
}

/**
 * Filter noise from response headers and bodies before comparison.
 * Returns cleaned copies — never mutates the originals.
 */
export function filterNoise(
  expectedBody: any,
  actualBody: any,
  expectedHeaders: Record<string, string>,
  actualHeaders: Record<string, string>,
  noiseRules: NoiseConfig
): {
  filteredExpectedBody: any;
  filteredActualBody: any;
  filteredExpectedHeaders: Record<string, string>;
  filteredActualHeaders: Record<string, string>;
} {
  // Clone everything so we never mutate originals
  const filteredExpectedBody = deepClone(expectedBody);
  const filteredActualBody = deepClone(actualBody);
  const filteredExpectedHeaders = { ...expectedHeaders };
  const filteredActualHeaders = { ...actualHeaders };

  // Strip noisy headers (case-insensitive)
  const noiseHeadersLower = new Set(noiseRules.headers.map(h => h.toLowerCase()));
  for (const key of Object.keys(filteredExpectedHeaders)) {
    if (noiseHeadersLower.has(key.toLowerCase())) {
      delete filteredExpectedHeaders[key];
    }
  }
  for (const key of Object.keys(filteredActualHeaders)) {
    if (noiseHeadersLower.has(key.toLowerCase())) {
      delete filteredActualHeaders[key];
    }
  }

  // Strip noisy body fields (dot-notation)
  for (const fieldPath of noiseRules.body_fields) {
    removeFieldFromBody(filteredExpectedBody, fieldPath);
    removeFieldFromBody(filteredActualBody, fieldPath);
  }

  return {
    filteredExpectedBody,
    filteredActualBody,
    filteredExpectedHeaders,
    filteredActualHeaders,
  };
}
