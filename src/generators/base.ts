import { TestCase } from '../engine/storage.js';

export interface GeneratorOptions {
  appEntry?: string;   // Jest only: relative path to app module
  targetUrl?: string;  // Pytest: base URL (default http://localhost:3000)
  testSetName?: string; // e.g. "test-set-3"
}

export interface GeneratedFile {
  filename: string;
  content: string;
}

export interface TestGenerator {
  generate(testCases: TestCase[], options: GeneratorOptions): GeneratedFile[];
}
