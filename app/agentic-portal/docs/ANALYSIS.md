# Agenticledger-prod Analysis: Reuse vs Rebuild

## Executive Summary

Your existing codebase has **solid infrastructure** for data connections and some good patterns for reporting. The datasources module is production-ready and should be **heavily reused**. The portal/dashboard system is more complex and mixed - some parts are valuable, others are over-engineered for a simpler vision.

---

## 1. DATASOURCES MODULE ✅ REUSE

**Location:** `server/routes/externalDataSources.ts` + `server/services/`

### What It Does Well

| Feature | Status | Notes |
|---------|--------|-------|
| **PostgreSQL connections** | ✅ Excellent | Full CRUD, connection testing, table listing, schema discovery |
| **BigQuery support** | ✅ Excellent | Clean service class, cost estimation, dry runs |
| **Google Sheets OAuth** | ✅ Excellent | Complete OAuth flow, token encryption, refresh handling |
| **CSV upload** | ✅ Good | GCS storage, schema inference |
| **Credential encryption** | ✅ Excellent | GCP KMS envelope encryption, secure storage |
| **Connection pooling** | ✅ Good | Per-request pools with timeouts |
| **Schema discovery** | ✅ Good | Auto-detect columns and types |

### Code Quality Assessment

```
✅ TypeScript with good typing
✅ Error handling with meaningful messages
✅ Security: CSRF protection, credential encryption
✅ Multi-tenant: organizationId filtering throughout
✅ Async/await patterns
✅ Logging for debugging
```

### Recommendation: **Port This Wholesale**

The datasources code is ~2900 lines of battle-tested infrastructure. Extract and modularize:

```
datavis-platform/
├── src/
│   ├── datasources/
│   │   ├── connections/          # From externalDataSources.ts
│   │   │   ├── postgres.ts
│   │   │   ├── bigquery.ts
│   │   │   ├── google-sheets.ts
│   │   │   └── csv.ts
│   │   ├── services/
│   │   │   ├── bigquery.ts       # Direct port
│   │   │   └── schema-discovery.ts
│   │   └── encryption/           # KMS utilities
```

---

## 2. PORTAL/REPORTING MODULE ⚠️ PARTIAL REUSE

**Location:** `client/src/components/reporting/` + `client/src/pages/SharedReportingPortal.tsx`

### Components Analysis

| Component | Verdict | Reason |
|-----------|---------|--------|
| **ChartWidget.tsx** | ✅ Reuse | Clean Recharts wrapper, multi-chart support |
| **ReportingChat.tsx** | ⚠️ Simplify | Over-engineered 3-mode system, extract NL→SQL core |
| **DashboardTab.tsx** | ⚠️ Rebuild | Complex state management, tied to agent model |
| **SharedReportingPortal.tsx** | ❌ Rebuild | 2400+ lines, deeply coupled to agenticledger concepts |
| **types.ts** | ✅ Reuse | Good type definitions for charts, tiles, widgets |

### ChartWidget - Evaluate

Ore's feedback: "felt limited/clunky" — may have been other factors, but worth scrutiny.

```typescript
// What it supports:
- bar, line, area, pie, scatter
- Multiple Y-axis support
- Custom tooltips
- Legend customization
- Color palette system
```

**Decision:** Port for MVP, but be ready to swap to ECharts or Tremor if limitations hit. Keep the **widget pattern** (select table vs chart vs metric card) — that's solid.

### ReportingChat - Extract the Core

The natural language → SQL pipeline has good bones:

1. **Schema Context Loading** - Gets table structure for LLM
2. **Column Mapping** - Maps NL terms to actual columns
3. **SQL Generation** - LLM generates query
4. **Execution** - Runs against data source

**Problem:** Over-complicated with 3 modes (standard, coding, code_editor)

**Recommendation:** Extract phase 1-2-3 pipeline, simplify to single mode

### Portal Sharing - Too Complex

Current system has:
- ACL (access control lists)
- Password protection
- Demo mode with scope restrictions
- Public viewer

**For MVP:** Just need public URL + optional password

---

## 3. TECH STACK ASSESSMENT

### Current Stack (agenticledger-prod)

| Layer | Tech | Keep? |
|-------|------|-------|
| Frontend | React + Vite | ⚠️ Consider Next.js |
| UI Components | shadcn/ui + Tailwind | ✅ Yes |
| Charting | Recharts | ✅ Yes |
| State | React Query | ✅ Yes |
| Backend | Express | ⚠️ Consider Next.js API |
| ORM | Drizzle | ✅ Yes |
| Database | PostgreSQL | ✅ Yes |
| Auth | Custom + Clerk | ⚠️ Simplify |

### Recommended Stack (DataVis Platform)

| Layer | Tech | Reason |
|-------|------|--------|
| Framework | **Next.js 14** | App router, API routes, server components |
| UI | **shadcn/ui + Tailwind** | Already using, keep it |
| Charting | **Recharts** | Port ChartWidget directly |
| State | **React Query** | Works great |
| ORM | **Drizzle** | Already familiar |
| Database | **PostgreSQL** (Supabase) | Managed, auth built-in |
| Auth | **Supabase Auth** | Simple, Google OAuth |
| AI | **Claude API** | Schema-aware SQL generation |

---

## 4. WHAT TO BUILD FROM SCRATCH

### New: Dashboard Builder UX

Current portal is **view-focused**, not **builder-focused**. Need:

```
┌────────────────────────────────────────────────────┐
│ 🔧 Dashboard: Q4 Sales Analysis                    │
├────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐        │
│ │ + Add Tile       │  │ Natural language │        │
│ │                  │  │ query box        │        │
│ │ "Total revenue   │  │                  │        │
│ │  by region..."   │  │ [Ask anything]   │        │
│ └──────────────────┘  └──────────────────┘        │
│                                                    │
│ ┌─────────────────────────────────────────────┐   │
│ │ 📊 Revenue by Region        [Bar ▼] [⋮]    │   │
│ │ ┌─────────────────────────────────────┐     │   │
│ │ │    ████                              │     │   │
│ │ │    ████  ███                         │     │   │
│ │ │    ████  ███  ██                     │     │   │
│ │ └─────────────────────────────────────┘     │   │
│ └─────────────────────────────────────────────┘   │
│                                                    │
│ [+ Add Row] [Save Dashboard] [Share]              │
└────────────────────────────────────────────────────┘
```

### New: Simpler AI Query Flow

```
User types: "Show me sales by product category"
     │
     ▼
┌─────────────────────────────────────────┐
│ AI (with schema context)                │
│ • Understands: sales table, category col│
│ • Generates: SELECT category, SUM(...)  │
└─────────────────────────────────────────┘
     │
     ▼
Execute query → Display results → Auto-suggest chart type
     │
     ▼
User: "As a pie chart" → Transform (no re-query)
```

---

## 5. MIGRATION PLAN

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Next.js project with shadcn/ui
- [ ] Port datasources module (postgres, bigquery connections)
- [ ] Port credential encryption utilities
- [ ] Basic auth with Supabase

### Phase 2: Core Query (Week 3-4)
- [ ] Build NL → SQL pipeline with Claude
- [ ] Port ChartWidget for visualizations
- [ ] Basic table + chart display

### Phase 3: Dashboard Builder (Week 5-6)
- [ ] Dashboard creation UI
- [ ] Tile management (add, remove, resize)
- [ ] Save/load dashboards
- [ ] Public sharing

### Phase 4: Polish (Week 7-8)
- [ ] Multiple data sources per dashboard
- [ ] Alerts (optional)
- [ ] Embedded dashboards

---

## 6. CODE TO EXTRACT NOW

### Priority 1: Copy These Files

```
agenticledger-prod/server/routes/externalDataSources.ts
  → Rename: src/lib/datasources/routes.ts

agenticledger-prod/server/services/bigquery.ts
  → Copy: src/lib/datasources/bigquery.ts

agenticledger-prod/server/utils/credentialEncryption.ts
  → Copy: src/lib/encryption/credentials.ts
```

### Priority 2: Extract Patterns

```
agenticledger-prod/client/src/components/reporting/ChartWidget.tsx
  → Port: src/components/charts/ChartWidget.tsx

agenticledger-prod/client/src/components/reporting/types.ts
  → Port: src/types/dashboard.ts
```

### Priority 3: Reference Only

```
agenticledger-prod/client/src/components/reporting/ReportingChat.tsx
  → Extract NL→SQL logic only, rebuild UI
```

---

## 7. DECISION SUMMARY

| Component | Decision | Effort |
|-----------|----------|--------|
| Datasources backend | **REUSE** | 1 week to port |
| BigQuery service | **REUSE** | 2 days to port |
| Encryption utilities | **REUSE** | 1 day to port |
| ChartWidget | **REUSE** | 3 days to port |
| Chart types (types.ts) | **REUSE** | 1 day to port |
| ReportingChat | **EXTRACT** | 1 week to extract core |
| Portal/Dashboard | **REBUILD** | 2-3 weeks new |
| Auth/Sharing | **REBUILD** | 1 week (simpler) |

**Total estimated effort:** 6-8 weeks for MVP

---

## 8. DECISIONS (Confirmed by Ore)

| Question | Decision |
|----------|----------|
| **Hosting** | Railway |
| **Multi-tenant** | Yes, with separate Org Admin vs Platform Admin pages |
| **Real-time** | No — refresh on page load + manual refresh button |
| **Charting** | Start with Recharts, evaluate if limitations hit |
| **Architecture** | 3 layers: Data Sources → Views → Widgets |
| **Save/Rerun** | Yes — port from ReportingChat |

---

*Analysis completed: Feb 11, 2026*
*Based on agenticledger-prod codebase review*
