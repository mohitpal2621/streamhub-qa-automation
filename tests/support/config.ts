import path from 'node:path';
import { config as loadEnvFile } from 'dotenv';

export const testEnv = process.env.TEST_ENV ?? 'local';

// dotenv never overwrites a variable that is already set, so the order is:
// real environment, then .env, then config/environments/<TEST_ENV>.env.
loadEnvFile({ path: '.env', quiet: true });
loadEnvFile({ path: path.join('config', 'environments', `${testEnv}.env`), quiet: true });

function read(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to config/environments/${testEnv}.env or export it.`);
  return value;
}

const flag = (name: string) => read(name).toLowerCase() === 'true';
const milliseconds = (name: string) => Number.parseInt(read(name), 10);

function viewport(): { width: number; height: number } {
  const [width, height] = read('VIEWPORT').split('x').map(Number);
  return { width, height };
}

export const config = {
  emiCalculatorUrl: read('EMI_CALCULATOR_URL'),
  api: {
    baseUrl: read('API_BASE_URL'),
    startServer: flag('START_API_SERVER'),
  },
  browser: {
    headless: flag('HEADLESS'),
    viewport: viewport(),
    blockAds: flag('BLOCK_ADS'),
  },
  timeouts: {
    action: milliseconds('ACTION_TIMEOUT_MS'),
    navigation: milliseconds('NAVIGATION_TIMEOUT_MS'),
    step: milliseconds('STEP_TIMEOUT_MS'),
  },
};
