import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // tests share one backend + config state; keep them serial
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node server.mjs',
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { PORT: String(PORT) },
  },
  projects: [
    { name: 'en', use: { ...devices['Desktop Chrome'], locale: 'en-US' }, testIgnore: /locale\.spec\.ts/ },
    { name: 'ko', use: { ...devices['Desktop Chrome'], locale: 'ko-KR' }, testMatch: /locale\.spec\.ts/ },
  ],
})
