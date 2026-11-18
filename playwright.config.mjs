/**
 * The app's flows, in Chrome, at a 9:16 phone viewport, with a fake camera.
 *
 * Two projects, each against its own freshly started server:
 *   showcase   the static edition (node tools/serve.mjs)
 *   live       the real studio with the simulator engine (uv run likeness serve --engine mock); skipped where uv is absent
 *
 * LIKENESS_BROWSER_CHANNEL chooses the browser: "chrome" by default (the installed Google Chrome);
 * set it to "chromium" after  npx playwright install chromium  to use Playwright's own build.
 */
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { defineConfig } from '@playwright/test';

const SHOWCASE = 'http://127.0.0.1:4183', LIVE = 'http://127.0.0.1:8797';
const env = { ...process.env, PATH: [join(homedir(), '.local', 'bin'), process.env.PATH].join(delimiter) };   // where uv installs itself
const hasUv = spawnSync('uv', ['--version'], { env }).status === 0;

export default defineConfig({
  testDir: 'tests/browser',
  outputDir: 'test-results',
  timeout: 120_000,
  expect: { timeout: 12_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    channel: process.env.LIKENESS_BROWSER_CHANNEL || 'chrome',
    viewport: { width: 360, height: 640 },   // exactly 9:16
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'showcase', testMatch: /showcase[\\/].*\.spec\.mjs$/, use: { baseURL: SHOWCASE } },
    ...(hasUv ? [{ name: 'live', testMatch: /live[\\/].*\.spec\.mjs$/, use: { baseURL: LIVE } }] : []),
  ],
  webServer: [
    { command: 'node tools/serve.mjs 4183', url: SHOWCASE + '/studio.json', reuseExistingServer: false, timeout: 30_000 },
    ...(hasUv ? [{
      command: 'uv run likeness serve --engine mock --host 127.0.0.1 --port 8797', url: LIVE + '/api/health', reuseExistingServer: false, timeout: 120_000,
      env: { ...env, LIKENESS_HOME: join(tmpdir(), 'likeness-test-studio') },   // the suite never touches private/
    }] : []),
  ],
});
