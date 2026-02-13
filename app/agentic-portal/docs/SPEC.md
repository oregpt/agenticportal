# Agentic Portal - Product Specification

## Vision
> "The application layer will not matter. It will just be DATA, VISUALIZATION, and AGENTS."

Finance teams will have all their data in databases and interact with potentially dynamic visualizations that are savable as static dashboards. Natural language is the interface.

---

## Core Decisions (Confirmed)

| Decision | Choice | Notes |
|----------|--------|-------|
| **Hosting** | Railway | More control than Vercel |
| **Multi-tenant** | Yes | Separate Org Admin vs Platform Admin pages (must-have) |
| **Real-time** | No | Refresh on page load + manual refresh button |
| **Framework** | Next.js 14 | App router, server components, API routes |
| **UI** | shadcn/ui + Tailwind | Already proven |
| **ORM** | Drizzle | Familiar from agenticledger |
| **Database** | Supabase PostgreSQL | Managed, auth included |
| **Auth** | Supabase Auth | Google OAuth |
| **AI** | Claude API | Schema-aware SQL generation |

---

## Architecture

### 4-Layer Model

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 4: AI CHAT (Conversational Interface)            │
│  "Why did revenue drop in Q3?"                          │
│  "Show me customers with >$10k spend"                   │
│  → Ad-hoc questions against your data                   │
│  → Uses NL→SQL under the hood                           │
│  → Can create Views/Widgets from conversation           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  LAYER 3: WIDGETS (Display Layer)                       │
│  Table | Bar Chart | Line Chart | Pie | Metric Card    │
│  → Each widget uses a View as its data source           │
│  → Widget = View + Visualization Config                 │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  LAYER 2: VIEWS (Queryable Layer)                       │
│  Saved queries, reusable across widgets                 │
│  → Define columns, joins, filters                       │
│  → Created via AI or manual SQL                         │
│  → Like "saved queries" but visual                      │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  LAYER 1: DATA SOURCES (Foundation)                     │
│  PostgreSQL | BigQuery | Google Sheets | CSV            │
│  → Connection credentials, schema discovery             │
│  → Port from agenticledger-prod wholesale               │
└─────────────────────────────────────────────────────────┘
```

### AI Usage (Two Modes)

| Mode | Purpose | Example |
|------|---------|---------|
| **AI for Building** | NL → SQL → Creates structured Views/Widgets | "Create a view showing top 10 customers by revenue" → Generates SQL → Saves as View → User picks chart type |
| **AI for Querying** | Ad-hoc conversational analysis | "Why did revenue drop in Q3?" → AI queries data, synthesizes answer, maybe shows supporting chart |

Both modes use **NL → SQL** under the hood, but:
- **Building** produces persistent artifacts (Views, Widgets, Dashboards)
- **Querying** produces ephemeral answers (can be promoted to artifacts)

### Widget Types

| Type | Description |
|------|-------------|
| **Table** | Paginated data grid |
| **Bar Chart** | Vertical/horizontal bars |
| **Line Chart** | Time series, trends |
| **Area Chart** | Filled line |
| **Pie/Donut** | Category breakdown |
| **Scatter** | Correlation plots |
| **Metric Card** | Single KPI number |
| **Pivot Table** | Cross-tab aggregations |

### Admin Separation (Must-Have)

```
/admin/platform   → Platform Admin (superuser)
                    - All organizations
                    - System settings
                    - User management across orgs

/admin/org        → Org Admin (per-organization)
                    - Org-specific settings
                    - Org users
                    - Org data sources
                    - Org dashboards
```

---

## Features

### 1. Data Sources (Port from agenticledger-prod)

✅ **Port wholesale** (~2900 lines):
- PostgreSQL connections
- BigQuery service
- Google Sheets OAuth
- CSV upload
- Credential encryption (KMS)
- Schema discovery
- Connection testing

### 2. Views (Build New)

Views = reusable queries that can feed multiple widgets

```typescript
interface View {
  id: string;
  organizationId: string;
  name: string;
  dataSourceId: string;
  
  // Query definition
  sql?: string;              // Raw SQL (power users)
  naturalLanguageQuery?: string; // NL that generated this
  
  // Schema
  columns: ViewColumn[];
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**User Flow:**
1. Select data source
2. Either: Write SQL OR ask in natural language
3. AI generates SQL from NL
4. Preview results
5. **Save as View** ← Key feature
6. View is now reusable across dashboards

### 3. Saved Reports / Rerun

From agenticledger-prod ReportingChat — keep this pattern:

```typescript
interface SavedReport {
  id: string;
  organizationId: string;
  viewId: string;          // Links to a View
  name: string;
  description?: string;
  
  // Source tracking
  naturalLanguageQuery?: string;
  sql: string;
  
  // Parameters (for rerunning with different inputs)
  parameters?: ReportParameter[];
  
  createdBy: string;
  createdAt: Date;
}
```

**Rerun Flow:**
1. Open saved report
2. Optionally modify parameters (date range, filters)
3. Click "Run" → Executes query → Fresh results
4. Can update visualization or save as new

### 4. Dashboard Builder

```
┌────────────────────────────────────────────────────────┐
│ 🔧 Dashboard: Q4 Sales Analysis           [Save] [Share]│
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │ 💰 Total Revenue    │  │ 📈 Growth Rate      │     │
│  │ $1,234,567          │  │ +23.4%              │     │
│  └─────────────────────┘  └─────────────────────┘     │
│                                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 📊 Revenue by Region                [🔄] [⋮]    │  │
│  │                                                  │  │
│  │    ████████████████                              │  │
│  │    ██████████                                    │  │
│  │    ████████                                      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  [+ Add Widget]                                        │
└────────────────────────────────────────────────────────┘
```

**Key UX:**
- Drag-and-drop widget placement
- Resize handles
- Each widget has: View selector, viz type picker, config options
- Manual refresh button per widget + global refresh
- Auto-refresh on page load

### 5. Natural Language → SQL

Simplified pipeline (from ReportingChat, cleaned up):

```
User: "Show me top 10 customers by revenue last quarter"
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ 1. Schema Context                                    │
│    - Load selected data source schema                │
│    - Include column names, types, descriptions       │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ 2. Claude API                                        │
│    - System prompt with schema                       │
│    - User's natural language question                │
│    - Generate SQL                                    │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ 3. Execute + Display                                 │
│    - Run SQL against data source                     │
│    - Display results in table                        │
│    - Auto-suggest chart type                         │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
         [Save as View] [Save as Report]
```

### 6. Charting (Evaluate)

**ChartWidget from agenticledger-prod:** Felt limited/clunky. Options:

| Library | Pros | Cons |
|---------|------|------|
| **Recharts** (current) | Already integrated, React-native | Limited customization |
| **Apache ECharts** | Very powerful, many chart types | Steeper learning curve |
| **Chart.js** | Simple, lightweight | Less flexible |
| **Tremor** | Beautiful defaults, shadcn-like | Limited chart types |
| **Nivo** | D3-based, animations | Heavy |

**Recommendation:** Start with Recharts (port ChartWidget for MVP), evaluate ECharts for v2 if limitations hit.

---

## Code Reuse Summary

### ✅ Port Wholesale

| File | Lines | Notes |
|------|-------|-------|
| `externalDataSources.ts` | 2900 | All data source connections |
| `services/bigquery.ts` | 220 | BigQuery service class |
| `credentialEncryption.ts` | ~150 | KMS utilities |
| `reporting/types.ts` | ~300 | Type definitions |

### ⚠️ Extract Patterns Only

| File | What to Extract |
|------|-----------------|
| `ReportingChat.tsx` | NL → SQL pipeline, Save Report logic |
| `ChartWidget.tsx` | Widget structure pattern (may rebuild) |

### ❌ Rebuild

| Component | Reason |
|-----------|--------|
| SharedReportingPortal | Too coupled to agents |
| DashboardTab | Tied to agent model |
| Auth/sharing | Simpler with Supabase |

---

## Database Schema (Draft)

```sql
-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (via Supabase Auth, extended)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  is_platform_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Sources
CREATE TABLE data_sources (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'postgres', 'bigquery', 'google_sheets', 'csv'
  config JSONB NOT NULL, -- encrypted credentials
  schema_cache JSONB,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Views (queryable layer)
CREATE TABLE views (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  data_source_id UUID REFERENCES data_sources(id),
  name TEXT NOT NULL,
  sql TEXT NOT NULL,
  natural_language_query TEXT,
  columns JSONB NOT NULL,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved Reports
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  view_id UUID REFERENCES views(id),
  name TEXT NOT NULL,
  description TEXT,
  parameters JSONB,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboards
CREATE TABLE dashboards (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  public_slug TEXT UNIQUE,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard Widgets
CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id),
  view_id UUID REFERENCES views(id),
  widget_type TEXT NOT NULL, -- 'table', 'bar', 'line', 'pie', etc.
  config JSONB NOT NULL, -- visualization config
  position JSONB NOT NULL, -- {x, y, width, height}
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 1 (MVP) - 6-8 Weeks

### Week 1-2: Foundation
- [ ] Initialize Next.js 14 project with shadcn/ui
- [ ] Set up Supabase (auth + database)
- [ ] Port `externalDataSources.ts` → PostgreSQL connections
- [ ] Port `bigquery.ts` service
- [ ] Port credential encryption utilities
- [ ] Basic auth flow (Google OAuth)
- [ ] **Org Admin vs Platform Admin pages**

### Week 3-4: Core Query Engine
- [ ] Build schema discovery UI
- [ ] Implement NL → SQL with Claude API
- [ ] **Views system** (save queries as views)
- [ ] Basic table display
- [ ] **Save Report + Rerun**

### Week 5-6: Dashboard Builder
- [ ] Dashboard creation/editing UI
- [ ] Widget system (view + viz config)
- [ ] Drag-and-drop layout
- [ ] Chart visualizations (start with Recharts)
- [ ] Save/load dashboards

### Week 7-8: Polish & Deploy
- [ ] Public sharing (URL-based)
- [ ] Error handling + loading states
- [ ] Refresh on load + manual refresh
- [ ] Deploy to Railway
- [ ] Landing page

---

## Open Questions

1. **Charting:** Stick with Recharts or evaluate alternatives?
2. **Views vs direct queries:** How much abstraction do users need?
3. **Parameters:** How sophisticated should parameterized reports be?

---

*Document updated: Feb 11, 2026*
*Incorporates Ore's feedback on multi-tenancy, Views layer, Save/Rerun*
