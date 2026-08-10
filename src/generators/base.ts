import { TestCase } from '../engine/storage.js';

import { NoiseConfig } from '../engine/noiseFilter.js';

import { ContainerConfig } from '../engine/config.js';

export interface GeneratorOptions {
  appEntry?: string;   // Jest only: relative path to app module
  targetUrl?: string;  // Pytest: base URL (default http://localhost:3000)
  testSetName?: string; // e.g. "test-set-3"
  noiseConfig?: NoiseConfig; // Config to filter dynamic fields in generated code
  containerConfigs?: ContainerConfig[]; // Containers to spin up inside the generated tests
}

export interface GeneratedFile {
  filename: string;
  content: string;
}

export interface TestGenerator {
  generate(testCases: TestCase[], options: GeneratorOptions): GeneratedFile[];
}
