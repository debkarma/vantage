import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

const VANTAGE_DIR = path.join(process.cwd(), '.vantage');
const CONFIG_PATH = path.join(VANTAGE_DIR, 'vantage.config.yaml');

export interface VantageConfig {
  version: number;
  app_port: number;
  record_port: number;
  noise: {
    headers: string[];
    body_fields: string[];
  };
}

const DEFAULT_CONFIG: VantageConfig = {
  version: 1,
  app_port: 3000,
  record_port: 6789,
  noise: {
    headers: ['Date', 'ETag', 'X-Request-Id', 'Content-Length'],
    body_fields: [],
  },
};

/**
 * Load the config file. Creates it with defaults if it doesn't exist.
 */
export function loadConfig(): VantageConfig {
  if (!fs.existsSync(VANTAGE_DIR)) {
    fs.mkdirSync(VANTAGE_DIR, { recursive: true });
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    const yamlStr = yaml.stringify(DEFAULT_CONFIG);
    fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf8');
    return { ...DEFAULT_CONFIG };
  }

  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  const parsed = yaml.parse(content) as Partial<VantageConfig>;

  // Merge with defaults so missing fields don't break anything
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    noise: {
      ...DEFAULT_CONFIG.noise,
      ...(parsed.noise || {}),
    },
  };
}
