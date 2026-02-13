import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Agentic Portal UI Tests
 * 
 * Run tests:
 *   npm run test:ui           - Run all UI tests
 *   npm run test:ui:headed    - Run with browser visible
 *   npm run test:ui:debug     - Run in debug mode
 * 
 * Authentication:
 *   Set TEST_AUTH_TOKEN env var with agentic_session JWT to run authenticated tests
 *   Example: TEST_AUTH_TOKEN="eyJ..." npm run test:ui
 */

// Auth token from environment (set via TEST_AUTH_TOKEN env var)
const authToken = process.env.TEST_AUTH_TOKEN;
const baseURL = process.env.TEST_BASE_URL || 'https://agentic-portal-web-production.up.railway.app';

export default defineConfig({
  testDir: './tests/ui-tests',
  fullyParallel: false, // Run sequentially for e2e flows
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for sequential tests
  reporter: [
    ['html', { outputFolder: 'tests/ui-tests/reports' }],
    ['list'],
  ],
  
  use: {
    // Base URL - change for different environments
    baseURL,
    
    // Collect trace on failure
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Set auth cookie if token provided
    ...(authToken ? {
      storageState: {
        cookies: [{
          name: 'agentic_session',
          value: authToken,
          domain: new URL(baseURL).hostname,
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax' as const,
        }],
        origins: [],
      },
    } : {}),
  },

  // Global timeout
  timeout: 60000,

  // Test output
  outputDir: 'tests/ui-tests/results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
