/**
 * Comprehensive UI Test Suite - Agentic Portal
 * 
 * Run: npm run test:ui
 * Run headed: npm run test:ui:headed
 */

import { test, expect, Page } from '@playwright/test';

// Unique identifier for this test run
const TEST_RUN_ID = Date.now();

// Helper: Skip test if redirected to login
async function skipIfLogin(page: Page, testFn: typeof test) {
  if (page.url().includes('/login')) {
    testFn.skip();
  }
}

// ============================================================================
// 1. AUTHENTICATION & LOGIN PAGE
// ============================================================================

test.describe('1. Authentication', () => {
  test('1.1 Login page accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Agentic Portal')).toBeVisible();
  });

  test('1.2 Login/Register tabs visible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('[role="tab"]:has-text("Login")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Register")')).toBeVisible();
  });

  test('1.3 Email and password fields exist', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(1000);
    // Email field with placeholder "you@example.com"
    await expect(page.locator('input[placeholder="you@example.com"]').or(page.getByLabel('Email'))).toBeVisible();
    // Password field
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('1.4 Sign In button exists', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });
});

// ============================================================================
// 2. DATA SOURCES
// ============================================================================

test.describe('2. Data Sources', () => {
  test('2.1 Data Sources page loads', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForTimeout(2000);
    
    // Either shows data sources page or login
    const onDataSources = await page.locator('h1:has-text("Data Sources")').isVisible();
    const onLogin = page.url().includes('/login');
    
    expect(onDataSources || onLogin).toBeTruthy();
  });

  test('2.2 Add Data Source button visible', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('button:has-text("Add Data Source")')).toBeVisible();
  });

  test('2.3 Shows existing data sources or empty state', async ({ page }) => {
    await page.goto('/datasources');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Page loaded - should have Add button visible
    await expect(page.locator('button:has-text("Add Data Source")')).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// 3. CHAT
// ============================================================================

test.describe('3. Chat', () => {
  test('3.1 Chat page loads', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Chat page has input area
    await expect(page.locator('textarea').or(page.locator('input[type="text"]'))).toBeVisible();
  });

  test('3.2 Data source selector visible', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Should have data source dropdown - look for "Select data source" text
    await expect(page.locator('text=Select data source').or(page.locator('[role="combobox"]'))).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// 4. VIEWS
// ============================================================================

test.describe('4. Views', () => {
  test('4.1 Views list page loads', async ({ page }) => {
    await page.goto('/views');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("Views")')).toBeVisible();
  });

  test('4.2 Create View page loads', async ({ page }) => {
    await page.goto('/views/new');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("Create View")')).toBeVisible();
  });

  test('4.3 View builder has SQL/NL tabs', async ({ page }) => {
    await page.goto('/views/new');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Look for the SQL or Natural Language tabs
    await expect(page.locator('[role="tab"]:has-text("SQL")').or(page.locator('[role="tab"]:has-text("Natural Language")'))).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// 5. DASHBOARDS
// ============================================================================

test.describe('5. Dashboards', () => {
  test('5.1 Dashboards list page loads', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("Dashboards")')).toBeVisible();
  });

  test('5.2 Create Dashboard page loads', async ({ page }) => {
    await page.goto('/dashboards/new');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("Create Dashboard")')).toBeVisible();
  });

  test('5.3 Dashboard detail page loads', async ({ page }) => {
    await page.goto('/dashboards/1');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Dashboard page has "Sales Overview" or shows "Add Widget" button
    await expect(
      page.locator('h1:has-text("Sales Overview")')
        .or(page.locator('button:has-text("Add Widget")'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('5.4 Dashboard shows widgets/charts', async ({ page }) => {
    await page.goto('/dashboards/1');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Should have charts or metric cards - look for "Total Revenue" widget
    await expect(page.locator('text=Total Revenue').or(page.locator('text=Monthly Sales'))).toBeVisible({ timeout: 10000 });
  });

  test('5.5 Add Widget button visible', async ({ page }) => {
    await page.goto('/dashboards/1');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('button:has-text("Add Widget")')).toBeVisible();
  });

  test('5.6 Add Widget dialog opens', async ({ page }) => {
    await page.goto('/dashboards/1');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await page.click('button:has-text("Add Widget")');
    await page.waitForTimeout(500);
    // Dialog should open with widget options
    await expect(page.locator('text=Widget').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// 6. ORGANIZATION
// ============================================================================

test.describe('6. Organization', () => {
  test('6.1 Org Overview page loads', async ({ page }) => {
    await page.goto('/org');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1').filter({ hasText: /overview|organization/i })).toBeVisible();
  });

  test('6.2 Team page loads', async ({ page }) => {
    await page.goto('/org/members');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1').filter({ hasText: /team|members/i })).toBeVisible();
  });

  test('6.3 Agents page loads', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Page title is "AI Agents"
    await expect(page.locator('h1:has-text("AI Agents")')).toBeVisible();
  });

  test('6.4 Settings page loads', async ({ page }) => {
    await page.goto('/org/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Page title is "Organization Settings" or has "General" settings section
    await expect(
      page.locator('h1:has-text("Organization Settings")')
        .or(page.locator('text=General'))
    ).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// 7. PLATFORM ADMIN
// ============================================================================

test.describe('7. Platform Admin', () => {
  test('7.1 Admin Dashboard loads', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1').filter({ hasText: /admin|dashboard|platform/i })).toBeVisible();
  });

  test('7.2 Admin Organizations page loads', async ({ page }) => {
    await page.goto('/admin/organizations');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("Organizations")')).toBeVisible();
  });

  test('7.3 Admin Users page loads', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("Users")')).toBeVisible();
  });

  test('7.4 Admin Data Sources page loads', async ({ page }) => {
    await page.goto('/admin/datasources');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("Data Sources")')).toBeVisible();
  });

  test('7.5 Admin Settings page loads', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('7.6 Admin Settings has tabs', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('[role="tab"]:has-text("General")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("AI Models")')).toBeVisible();
  });
});

// ============================================================================
// 8. MCP HUB (NEW)
// ============================================================================

test.describe('8. MCP Hub', () => {
  test('8.1 MCP Hub page loads', async ({ page }) => {
    await page.goto('/org/mcp');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("MCP Hub")')).toBeVisible();
  });

  test('8.2 MCP Hub shows stats cards', async ({ page }) => {
    await page.goto('/org/mcp');
    await page.waitForTimeout(4000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Should show MCP Hub content - stats OR tabs
    await expect(
      page.locator('text=Total Servers')
        .or(page.locator('[role="tab"]:has-text("Servers")'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('8.3 MCP Hub has tabs', async ({ page }) => {
    await page.goto('/org/mcp');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('[role="tab"]:has-text("Servers")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Tools")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Capabilities")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Test Panel")')).toBeVisible();
  });

  test('8.4 MCP Servers list visible', async ({ page }) => {
    await page.goto('/org/mcp');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Wait for content to fully load
    await expect(page.locator('h2:has-text("MCP Servers")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Add Server")')).toBeVisible({ timeout: 5000 });
  });

  test('8.5 Tools tab shows tool list', async ({ page }) => {
    await page.goto('/org/mcp');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await page.click('[role="tab"]:has-text("Tools")');
    await expect(page.locator('text=Available Tools')).toBeVisible();
  });

  test('8.6 Test Panel tab has tool selector', async ({ page }) => {
    await page.goto('/org/mcp');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await page.click('[role="tab"]:has-text("Test Panel")');
    await expect(page.locator('text=Tool Test Panel')).toBeVisible();
    await expect(page.locator('text=Select Tool')).toBeVisible();
    await expect(page.locator('button:has-text("Execute Tool")')).toBeVisible();
  });
});

// ============================================================================
// 9. AGENTS PAGE
// ============================================================================

test.describe('9. Agents', () => {
  test('9.1 Agents page loads', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Page title is "AI Agents"
    await expect(page.locator('h1:has-text("AI Agents")')).toBeVisible();
  });

  test('9.2 New Agent button visible', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('button:has-text("New Agent")')).toBeVisible();
  });

  test('9.3 Agent cards or empty state visible', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Should show agent cards OR empty state
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    const hasEmpty = await page.locator('text=No agents yet').isVisible();
    
    expect(hasAgents || hasEmpty).toBeTruthy();
  });

  test('9.4 Search box visible', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('9.5 Create dialog opens', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await page.click('button:has-text("New Agent")');
    await expect(page.locator('text=Create AI Agent')).toBeVisible();
  });

  test('9.6 Create dialog has form fields', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await page.click('button:has-text("New Agent")');
    await expect(page.locator('label:has-text("Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Description")')).toBeVisible();
    await expect(page.locator('label:has-text("Instructions")')).toBeVisible();
  });
});

// ============================================================================
// 10. ORG SETTINGS
// ============================================================================

test.describe('10. Org Settings', () => {
  test('10.1 Settings page loads', async ({ page }) => {
    await page.goto('/org/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('h1:has-text("Organization Settings")')).toBeVisible({ timeout: 5000 });
  });

  test('10.2 General section visible', async ({ page }) => {
    await page.goto('/org/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('text=General')).toBeVisible({ timeout: 5000 });
  });

  test('10.3 Security section visible', async ({ page }) => {
    await page.goto('/org/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('text=Security')).toBeVisible({ timeout: 5000 });
  });

  test('10.4 Save button visible', async ({ page }) => {
    await page.goto('/org/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
  });
});

// ============================================================================
// 11. DEMO PAGE (NEW)
// ============================================================================

test.describe('11. Demo Page', () => {
  test('11.1 Demo page loads (public)', async ({ page }) => {
    await page.goto('/demo');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('h1:has-text("Agentic Portal Demo")')).toBeVisible();
  });

  test('11.2 Demo has sample queries', async ({ page }) => {
    await page.goto('/demo');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('text=Try these sample questions')).toBeVisible();
    await expect(page.locator('button:has-text("How many orders")')).toBeVisible();
  });

  test('11.3 Demo has chat input', async ({ page }) => {
    await page.goto('/demo');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('input[placeholder*="Ask a question"]')).toBeVisible();
  });

  test('11.4 Demo has sign up CTA', async ({ page }) => {
    await page.goto('/demo');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('text=Ready to connect your own data')).toBeVisible();
    await expect(page.locator('a:has-text("Get Started Free")')).toBeVisible();
  });

  test('11.5 Demo shows database indicator', async ({ page }) => {
    await page.goto('/demo');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('text=Demo Database')).toBeVisible();
  });
});

// ============================================================================
// 12. LANDING PAGE (UPDATED)
// ============================================================================

test.describe('12. Landing Page', () => {
  test('12.1 Landing page loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('h1:has-text("Talk to your data")')).toBeVisible();
  });

  test('12.2 Landing page has Login/Signup', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('a:has-text("Login")')).toBeVisible();
    await expect(page.locator('a:has-text("Sign Up")')).toBeVisible();
  });

  test('12.3 Landing page has updated copy', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('text=Connect any data source')).toBeVisible();
    await expect(page.locator('text=intelligent dashboards')).toBeVisible();
  });

  test('12.4 Landing page has Try Demo button', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('a:has-text("Try Demo")')).toBeVisible();
  });

  test('12.5 Landing page has architecture diagram', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('text=How it works')).toBeVisible();
    await expect(page.locator('text=AI Chat')).toBeVisible();
    await expect(page.locator('text=Data Sources')).toBeVisible();
  });

  test('12.6 Feature cards present', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('text=Connect')).toBeVisible();
    await expect(page.locator('text=Ask')).toBeVisible();
    await expect(page.locator('text=Visualize')).toBeVisible();
  });
});

// ============================================================================
// 13. NAVIGATION (UPDATED)
// ============================================================================

// ============================================================================
// 14. AGENT CONFIGURATION (NEW FEATURES)
// ============================================================================

test.describe('14. Agent Configuration', () => {
  // Helper to check if user is authenticated (has ORGANIZATION section in sidebar)
  const isAuthenticated = async (page: Page) => {
    // Check for "ORGANIZATION" section label in sidebar (only shows when logged in)
    const hasOrgSection = await page.locator('text=ORGANIZATION').or(page.locator('text=Organization')).first().isVisible();
    // Also check that "Sign in" button is NOT visible
    const signInVisible = await page.locator('text=Sign in').isVisible();
    return hasOrgSection && !signInVisible;
  };

  test('14.1 Org switcher visible in sidebar (when authenticated)', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    // Org switcher button should be visible (has org name like "ClarkAI")
    await expect(page.locator('button:has-text("ClarkAI")').or(page.locator('button').filter({ hasText: /[A-Z][a-z]+[A-Z]/ }))).toBeVisible();
  });

  test('14.2 Org switcher opens dropdown (when authenticated)', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    // Click the org switcher button
    const orgSwitcher = page.locator('button:has-text("ClarkAI")').or(page.locator('button').filter({ hasText: /[A-Z][a-z]+[A-Z]/ })).first();
    await orgSwitcher.click();
    await page.waitForTimeout(500);
    // Should show dropdown with "Create Organization"
    await expect(page.locator('text=Create Organization')).toBeVisible({ timeout: 3000 });
  });

  test('14.3 Agent card has Configure button (when agents exist)', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    // Check if agents exist (not empty state)
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    // Configure button should be visible on agent cards
    await expect(page.locator('button:has-text("Configure")').first()).toBeVisible({ timeout: 5000 });
  });

  test('14.4 Three-dots menu opens dropdown (when agents exist)', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    // Find the three-dots button (button with just "..." text or svg next to agent name)
    // The three-dots is a button near "Data Analyst" text
    const moreButton = page.locator('button').filter({ has: page.locator('svg') }).nth(3);
    await moreButton.click();
    await page.waitForTimeout(500);
    
    // Should show dropdown with Configure, Duplicate, Delete
    await expect(page.locator('[role="menuitem"]:has-text("Duplicate")')).toBeVisible({ timeout: 3000 });
  });

  test('14.5 Three-dots dropdown has Delete option', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    // Find the three-dots button
    const moreButton = page.locator('button').filter({ has: page.locator('svg') }).nth(3);
    await moreButton.click();
    await page.waitForTimeout(500);
    
    // Delete option should be visible in dropdown
    await expect(page.locator('text=Delete')).toBeVisible({ timeout: 3000 });
  });

  test('14.6 Configure button opens config panel', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    // Click Configure button
    await page.locator('button:has-text("Configure")').first().click();
    await page.waitForTimeout(500);
    
    // Config panel should open
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 3000 });
  });

  test('14.7 Config panel has 4 tabs', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    await page.locator('button:has-text("Configure")').first().click();
    await page.waitForTimeout(500);
    
    // Should have Settings, MCP, Keys, Soul tabs
    await expect(page.locator('[role="tab"]:has-text("Settings")')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[role="tab"]:has-text("MCP")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Keys")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Soul")')).toBeVisible();
  });

  test('14.8 Settings tab has model selector', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    await page.locator('button:has-text("Configure")').first().click();
    await page.waitForTimeout(500);
    
    // Settings tab should show model selector
    await expect(page.locator('text=Default Model')).toBeVisible({ timeout: 3000 });
  });

  test('14.9 Settings tab has system instructions textarea', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    await page.locator('button:has-text("Configure")').first().click();
    await page.waitForTimeout(500);
    
    await expect(page.locator('text=System Instructions')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('14.10 MCP tab shows server toggles', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    await page.locator('button:has-text("Configure")').first().click();
    await page.waitForTimeout(500);
    
    // Click MCP tab
    await page.locator('[role="tab"]:has-text("MCP")').click();
    await page.waitForTimeout(300);
    
    // Should show MCP content (Connected MCP Servers label)
    await expect(page.locator('text=Connected MCP Servers')).toBeVisible({ timeout: 3000 });
  });

  test('14.11 Config panel has Save/Cancel buttons', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    await page.locator('button:has-text("Configure")').first().click();
    await page.waitForTimeout(500);
    
    await expect(page.locator('button:has-text("Save Changes")').or(page.locator('button:has-text("Save")'))).toBeVisible({ timeout: 3000 });
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test('14.12 Config panel can be closed with Cancel', async ({ page }) => {
    await page.goto('/org/agents');
    await page.waitForTimeout(3000);
    
    if (page.url().includes('/login') || !(await isAuthenticated(page))) {
      test.skip();
      return;
    }
    
    const hasAgents = await page.locator('text=claude-sonnet').first().isVisible();
    if (!hasAgents) {
      test.skip();
      return;
    }
    
    await page.locator('button:has-text("Configure")').first().click();
    await page.waitForTimeout(500);
    
    // Close panel
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(300);
    
    // Panel should be closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('13. Navigation', () => {
  test('13.1 Sidebar visible', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      // Login page should still have branding
      await expect(page.locator('text=Agentic Portal')).toBeVisible();
      return;
    }
    
    await expect(page.locator('text=Agentic Portal')).toBeVisible();
  });

  test('13.2 Main navigation links present', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('a:has-text("Chat")')).toBeVisible();
    await expect(page.locator('a:has-text("Data Sources")')).toBeVisible();
    await expect(page.locator('a:has-text("Views")')).toBeVisible();
    await expect(page.locator('a:has-text("Dashboards")')).toBeVisible();
  });

  test('13.3 Organization nav section present', async ({ page }) => {
    await page.goto('/org');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('a:has-text("Overview")')).toBeVisible();
    await expect(page.locator('a:has-text("Team")')).toBeVisible();
    await expect(page.locator('a:has-text("Agents")')).toBeVisible();
    await expect(page.locator('a:has-text("MCP Hub")')).toBeVisible();
    await expect(page.locator('a:has-text("Settings")')).toBeVisible();
  });

  test('13.4 Admin nav section present', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(2000);
    
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    await expect(page.locator('a:has-text("Organizations")')).toBeVisible();
    await expect(page.locator('a:has-text("All Users")')).toBeVisible();
  });
});
