import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: {baseURL: 'http://localhost:4173'},
  webServer: {command: 'VITE_CLOUD=off vite build --outDir dist-e2e && vite preview --outDir dist-e2e --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120000},
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'webkit', testMatch: 'mobile.spec.js', use: {browserName: 'webkit'}},
  ],
});
