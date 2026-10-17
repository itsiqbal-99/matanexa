import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/pilot',
  testMatch: '*.spec.ts',
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/g26/browser-results.json' }],
  ],
  outputDir: 'artifacts/g26/browser',
  use: {
    baseURL: 'http://localhost:3000',
    channel: 'msedge',
    headless: true,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 960 } } },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
