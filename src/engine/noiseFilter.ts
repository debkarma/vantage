import { VantageConfig } from './config.js';


export interface NoiseConfig {
  headers: string[];
  body_fields: string[];
  smart_masking?: boolean;
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

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT_REGEX = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function autoMask(obj: any): void {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      autoMask(item);
    }
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val instanceof Date) {
        obj[key] = '<AUTO_MASKED_DATE>';
      } else if (typeof val === 'string') {
        if (ISO_DATE_REGEX.test(val)) {
          obj[key] = '<AUTO_MASKED_DATE>';
        } else if (UUID_REGEX.test(val)) {
          obj[key] = '<AUTO_MASKED_UUID>';
        } else if (JWT_REGEX.test(val)) {
          obj[key] = '<AUTO_MASKED_JWT>';
        }
      } else if (typeof val === 'object') {
        autoMask(val);
      }
    }
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

  // Apply smart masking (defaults to true if not explicitly false)
  if (noiseRules.smart_masking !== false) {
    autoMask(filteredExpectedBody);
    autoMask(filteredActualBody);
  }

  return {
    filteredExpectedBody,
    filteredActualBody,
    filteredExpectedHeaders,
    filteredActualHeaders,
  };
}
