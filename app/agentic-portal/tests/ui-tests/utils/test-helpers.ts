/**
 * Test Utilities for Agentic Portal UI Tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Generate a unique name for test data
 */
export function uniqueName(prefix: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '-');
  return `${prefix} ${timestamp}`;
}

/**
 * Wait for page to be fully loaded (no pending network requests)
 */
export async function waitForPageLoad(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Login helper - logs in with given credentials
 */
export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(chat|dashboard|$)/, { timeout: 15000 });
}

/**
 * Navigate and verify page loaded
 */
export async function navigateTo(page: Page, path: string, expectedTitle: RegExp): Promise<void> {
  await page.goto(path);
  await expect(page.locator('h1')).toContainText(expectedTitle);
}

/**
 * Fill a form field by label or placeholder
 */
export async function fillField(
  page: Page,
  identifier: string,
  value: string
): Promise<void> {
  const field = page.locator(`input[placeholder*="${identifier}"], input[id="${identifier}"], input[name="${identifier}"], textarea[placeholder*="${identifier}"]`).first();
  await field.fill(value);
}

/**
 * Click a button by text
 */
export async function clickButton(page: Page, text: string): Promise<void> {
  await page.click(`button:has-text("${text}")`);
}

/**
 * Check if toast notification appears
 */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  const toast = page.locator('[role="alert"], [class*="toast"], [class*="Toast"]');
  await expect(toast.filter({ hasText: text })).toBeVisible({ timeout: 10000 });
}

/**
 * Wait for and verify a table has rows
 */
export async function expectTableHasRows(page: Page, minRows = 1): Promise<void> {
  const table = page.locator('table').first();
  await expect(table).toBeVisible();
  const rows = table.locator('tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(minRows);
}

/**
 * PostgreSQL connection config for tests
 */
export const TEST_POSTGRES_CONFIG = {
  host: 'agenticledger-flux-analyzer.caj4gmoas26w.us-east-2.rds.amazonaws.com',
  port: '5432',
  database: 'flux_analyzer',
  username: 'agenticledger_readonly',
  password: 'ReadOnly2024!Secure',
};

/**
 * Test user credentials
 */
export const TEST_USER = {
  email: 'clark@agenticledger.ai',
  password: 'testpassword123',
};
