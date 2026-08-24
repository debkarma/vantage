import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

const VANTAGE_DIR = path.join(process.cwd(), '.vantage');
const CONFIG_PATH = path.join(VANTAGE_DIR, 'vantage.config.yaml');

export interface ContainerConfig {
  type: 'mongodb' | 'postgresql';
  image?: string;
  seed?: string;
  env_var: string;
}

export interface NoiseConfig {
  headers: string[];
  body_fields: string[];
  smart_masking?: boolean;
  ignore_paths?: string[];
}

export interface VantageConfig {
  version: number;
  app_port?: number;
  record_port?: number;
  noise?: NoiseConfig;
  scripts?: {
    pre_test?: string;
    post_test?: string;
  };
  containers?: ContainerConfig[];
}

const DEFAULT_CONFIG: VantageConfig = {
  version: 1,
  app_port: 3000,
  record_port: 6789,
  noise: {
    headers: ['Date', 'ETag', 'X-Request-Id', 'Content-Length', 'Access-Control-Allow-Origin', 'Vary'],
    body_fields: [],
    smart_masking: true,
    ignore_paths: ['/_next/', '/__vite_ping', '.ico', '.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.woff2'],
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
      headers: parsed.noise?.headers || DEFAULT_CONFIG.noise!.headers,
      body_fields: parsed.noise?.body_fields || DEFAULT_CONFIG.noise!.body_fields,
      smart_masking: parsed.noise?.smart_masking !== undefined ? parsed.noise.smart_masking : true,
    },
  };
}
