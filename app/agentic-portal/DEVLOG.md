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
