# Agentic Portal Tests

## Directory Structure

```
tests/
├── ui-tests/           # Playwright UI/E2E tests
│   ├── comprehensive.spec.ts    # Full test suite
│   ├── utils/
│   │   └── test-helpers.ts      # Shared utilities
│   ├── reports/        # HTML test reports
│   └── results/        # Test artifacts (screenshots, videos)
├── api-tests/          # (Future) API integration tests
└── README.md
```

## Running UI Tests

### Prerequisites

1. Install Playwright browsers (first time only):
   ```bash
   npx playwright install
   ```

2. Ensure the app is deployed/running:
   - Production: https://agentic-portal-web-production.up.railway.app
   - Local: http://localhost:3000

### Commands

```bash
# Run all UI tests (headless)
npm run test:ui

# Run with browser visible
npm run test:ui:headed

# Run in debug mode (step through tests)
npm run test:ui:debug

# View HTML report
npm run test:ui:report
```

### Configuration

Edit `playwright.config.ts` to change:
- `baseURL` - Target environment
- `timeout` - Test timeout
- `retries` - Retry failed tests

### Test Environment

By default, tests run against production. To test locally:

```bash
TEST_BASE_URL=http://localhost:3000 npm run test:ui
```

## Test Coverage

### 1. Authentication
- Login page loads
- Login/Register tabs visible
- Email and password fields exist
- Sign In button exists

### 2. Data Sources
- Data Sources page loads
- Add Data Source button visible
- Shows existing data sources or empty state

### 3. Chat / AI Query
- Chat page loads
- Data source selector visible

### 4. Views
- Views list page loads
- Create View page loads
- View builder has SQL/NL tabs

### 5. Dashboards
- Dashboard list
- Create Dashboard page loads
- Dashboard detail with widgets
- Add Widget dialog opens
- Chart rendering

### 6. Organization
- Overview with stats
- Team members list
- Agents page loads
- Settings page loads

### 7. Platform Admin
- Admin dashboard
- Organizations list
- Users list
- Data sources (admin view)
- Platform settings (tabs)
- AI model configuration

### 8. MCP Hub (NEW)
- MCP Hub page loads
- Stats cards (Total Servers, Active, Tools)
- Tabs: Servers, Tools, Capabilities, Test Panel
- Server list visible
- Tools tab shows tool list
- Test Panel has tool selector

### 9. Agents (NEW)
- Agents page loads
- Create Agent button visible
- Agent list shows agents
- Settings tab with model selector
- Branding tab
- API Keys tab shows providers (Anthropic, OpenAI, etc.)
- Soul & Memory tab with editors

### 10. Org Settings - LLM Keys (NEW)
- LLM Keys tab visible
- Shows all LLM providers
- Key hierarchy info displayed

### 11. Demo Page (NEW)
- Demo page loads (public, no login required)
- Sample query buttons
- Chat input field
- Sign up CTA
- Demo Database indicator

### 12. Landing Page (UPDATED)
- Landing page loads
- Login/Signup buttons
- Updated copy (data source, intelligent dashboards)
- Try Demo button
- Architecture diagram
- Feature cards

### 13. Navigation
- Sidebar visibility
- Main nav links (Chat, Data Sources, Views, Dashboards)
- Organization section (Overview, Team, Agents, MCP Hub, Settings)
- Admin nav section

## Writing New Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('Test case description', async ({ page }) => {
    await page.goto('/path');
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

### Best Practices

1. **Use unique names** for test data:
   ```typescript
   const name = `Test Item ${Date.now()}`;
   ```

2. **Wait for network** before assertions:
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

3. **Use flexible selectors**:
   ```typescript
   // Good - handles multiple possible texts
   await expect(page.locator('text=/Login|Sign in/i')).toBeVisible();
   
   // Good - handles element variations
   const button = page.locator('button:has-text("Submit"), input[type="submit"]');
   ```

4. **Handle conditional UI**:
   ```typescript
   const button = page.locator('button:has-text("Add")');
   if (await button.isVisible()) {
     await button.click();
   }
   ```

## Continuous Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run UI Tests
  run: |
    npx playwright install --with-deps
    npm run test:ui
  
- name: Upload Test Report
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: tests/ui-tests/reports/
```

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if the target URL is accessible
- Verify network connectivity

### Element not found
- Use more flexible selectors
- Add explicit waits: `await page.waitForTimeout(2000)`
- Check if element is inside an iframe

### Flaky tests
- Add retries: `retries: 2` in config
- Increase action timeout
- Wait for network idle before actions
