# Agentic Portal - Development Log

## 2026-02-12 - Data Sources & Connectors Sprint

### Session Summary
Major work on data source connectors and UI improvements.

---

### ✅ Features Built

#### 1. Google OAuth Flow for Sheets (Initial)
- `/api/auth/google/start` - initiates OAuth
- `/api/auth/google/callback` - handles token exchange
- Fixed redirect URI to use canonical production domain

#### 2. Test Connection Buttons
- Added "Test" button for **BigQuery** connector
- Added "Test" button for **PostgreSQL** connector
- `/api/datasources/test-connection` - tests connection before saving
- Shows success/failure with detailed error messages

#### 3. Google Sheets Live (BigQuery External Tables)
- **New approach:** Query Google Sheets via BigQuery SQL
- User shares sheet with platform service account
- Creates BigQuery external table pointing to the sheet
- Real-time SQL queries (no data sync needed)

**Endpoints:**
- `/api/google-sheets-live/service-account` - returns service account email
- `/api/google-sheets-live/test-connection` - tests external table creation
- `/api/datasources` POST with `type: google_sheets_live`

**Adapter:** `src/lib/datasources/adapters/google-sheets-live.ts`

#### 4. Sync Endpoint
- `/api/datasources/[id]/sync` - refreshes schema for a data source
- Was missing, causing "Sync" button to fail

#### 5. Delete Data Source
- Delete button (trash icon) in data sources list
- Confirmation dialog with big warning
- "This action cannot be undone. All associated views, dashboards, and cached data will be permanently removed."

---

### 🔧 Configuration

**Railway Environment Variables:**
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `EDS_GCP_SERVICE_ACCOUNT_KEY` - Full JSON for BigQuery external tables

**Service Account:** `agenticportal@aerial-acre-477412-a7.iam.gserviceaccount.com`
- Needs BigQuery Admin role in GCP IAM

---

### 📁 Files Modified/Created

```
src/app/api/auth/google/start/route.ts          # OAuth start
src/app/api/auth/google/callback/route.ts       # OAuth callback
src/app/api/datasources/test-connection/route.ts # Test connection API
src/app/api/datasources/[id]/sync/route.ts      # Sync endpoint
src/app/api/google-sheets-live/service-account/route.ts
src/app/api/google-sheets-live/test-connection/route.ts
src/app/(dashboard)/datasources/page.tsx        # UI updates
src/lib/datasources/adapters/google-sheets-live.ts
src/lib/datasources/index.ts                    # Register adapter
src/lib/datasources/types.ts                    # Add type
src/lib/google-oauth.ts                         # OAuth helpers
```

---

### 🐛 Bugs Fixed

1. **OAuth redirect URI mismatch** - hardcoded production URL
2. **Sync failing** - missing `/sync` endpoint
3. **Google Sheets "Coming Soon"** - form wasn't rendering (type mismatch)
4. **BigQuery TypeScript error** - added type assertion for createTable

---

### 📋 Next Steps

- [ ] Add more data source types (MySQL, Snowflake)
- [ ] Implement Views feature
- [ ] Implement Dashboards feature
- [ ] Add proper authentication/session management
- [ ] Encrypt sensitive config in database

## 2026-02-15 - IA Refactor, Filters, Explorer, and Output UX

### Session Summary
Focused stabilization + product UX pass to improve information architecture, cross-entity navigation, filtering, and output definition clarity.

---

### Features Built

#### 1. Information Architecture Refactor
- Added top-level section navigation in header:
  - `Pipeline`
  - `Organization`
  - `Platform Admin`
- Sidebar now shows section-scoped internal navigation only.
- Role-aware visibility for admin sections remains enforced.

#### 2. Workstream Context Across Entity Pages
- Added shared workstream filter bar and URL-persisted filtering on:
  - Data Sources
  - Views
  - Dashboards
  - Outputs
- Added dependent page filters:
  - Data Sources: source type
  - Views: data source
  - Dashboards: widget state
  - Outputs: dashboard

#### 3. Phase 2 Filtering
- Multi-select filters added for dependent filters.
- Saved filter presets added (local per browser/user) with save/apply/delete.

#### 4. Relationship Explorer
- Added new route: `/relationship-explorer`.
- Supports:
  - Workstream-scoped relationship traversal
  - Click-through to entity pages
  - Expand/collapse related upstream/downstream nodes
  - Column view + draggable mind-map view with animated edges

#### 5. Output UX Clarification
- Added explicit `On-demand` schedule option.
- Added explicit output content definition:
  - Full dashboard snapshot
  - Top widgets summary
  - Custom AI summary prompt
- Added editable output definition controls on output detail page.
- Added `PATCH /api/outputs/[id]` for updating output configuration.

---

### API/Backend Updates
- `GET /api/datasources` now supports `workstreamId` filtering.
- `GET /api/views` now supports `workstreamId` filtering.
- `GET /api/dashboards` now includes `widgetCount`.
- `PATCH /api/outputs/[id]` added for updates.
- Output run endpoint now reflects on-demand labeling and content mode metadata in generated email body.

---

### Files Added

```
src/components/filters/WorkstreamFilterBar.tsx
src/components/filters/MultiSelectDropdown.tsx
src/components/filters/FilterPresetManager.tsx
src/app/(dashboard)/relationship-explorer/page.tsx
```

### Files Updated (major)

```
src/components/layout/AppLayout.tsx
src/components/layout/Sidebar.tsx
src/app/(dashboard)/datasources/page.tsx
src/app/(dashboard)/views/page.tsx
src/app/(dashboard)/dashboards/page.tsx
src/app/(dashboard)/outputs/page.tsx
src/app/(dashboard)/outputs/[id]/page.tsx
src/app/workstream-canvas/[id]/page.tsx
src/app/api/datasources/route.ts
src/app/api/views/route.ts
src/app/api/dashboards/route.ts
src/app/api/outputs/[id]/route.ts
src/app/api/outputs/[id]/run/route.ts
playwright.config.ts
tests/ui-tests/canvas-end-to-end-flow.spec.ts
```

---

### Validation
- Lint on touched files: no errors.
- Canvas E2E template regression: passing after updates.

## 2026-02-15 - Railway Dev/Prod Split + Build Stabilization

### Session Summary
Completed environment separation on Railway, switched deployment source to the new GitHub repo, and resolved all blocking Next.js build errors so `npm run build` passes.

---

### Infrastructure and Branching

#### 1. Git + Branch Strategy
- New canonical repo configured: `https://github.com/oregpt/agenticportal`
- Branch model enabled:
  - `main` for production
  - `main_dev` for development/testing
- Pushed both branches to the new repo and aligned them to latest fix commit.

#### 2. Railway Environment Split
- Confirmed separate Railway environments:
  - `production`
  - `development`
- Wired deployment triggers:
  - `production` -> `main`
  - `development` -> `main_dev`
- Fixed Railway service instance `rootDirectory` to:
  - `app/agentic-portal`
  This resolved Railpack root detection failures.

---

### Build/TypeScript Fixes

#### 1. Data Source Schema Cast Failure
- Fixed compile blocker in:
  - `src/app/api/datasources/route.ts`
- Adjusted strict cast for filtered schema table selection.

#### 2. Dashboard Detail Grid Typing
- Fixed type mismatches in:
  - `src/app/(dashboard)/dashboards/[id]/page.tsx`
- Changes:
  - `formatCellValue` boolean normalization to string
  - corrected `Layout` typing (array type alias misuse)
  - migrated grid props to new `react-grid-layout` v2 API (`gridConfig`, `dragConfig`, `resizeConfig`)

#### 3. Next.js 16 Suspense Prerender Requirements
- Wrapped `useSearchParams()` pages in `Suspense` where missing:
  - `src/app/(dashboard)/dashboards/page.tsx`
  - `src/app/(dashboard)/outputs/page.tsx`
  - `src/app/(dashboard)/relationship-explorer/page.tsx`
  - `src/app/(dashboard)/views/page.tsx`

---

### Validation
- Local build status:
  - `npm run build` completed successfully.
- Route generation finished without prerender errors after suspense and typing fixes.

---

### Commit
- `b543441` - `Fix Next 16 build blockers for datasources and dashboard pages`
