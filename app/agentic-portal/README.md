# Agentic Portal - Product Overview

Agentic Portal is a multi-tenant data workspace for non-technical and technical users to connect data, create Views, and build reusable dashboards.

## Core User Journey

1. Connect data sources.
2. Create Views (saved queries).
3. Build dashboards from those Views.
4. Reuse dashboards and outputs over time.

## Current UX Direction

- Home section is labeled `Overview`.
- Pipeline flow is still preserved functionally (`Data Sources -> Views -> Dashboards -> Outputs`), but copy is being simplified for non-technical users.
- Canvas mode now supports browse-first behavior:
  - Default right pane opens Relationship Explorer in embedded mode.
  - Left canvas sections are compact and collapsible.
  - Global `Show all` / `Collapse all` plus per-section `Open` / `Hide`.
  - Top-right controls include `Back to Overview` and `Exit Canvas`.

## Main Areas

- `Overview` (`/workstreams`)
- `Data Sources` (`/datasources`)
- `Views` (`/views`)
- `Dashboards` (`/dashboards`)
- `Outputs` (`/outputs`)
- `Data Relationships` (`/relationship-explorer`)
- `AI Chat` (`/chat`)
- `Organization` (`/org`)

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Branching and Deployment

- `main`: production branch
- `main_dev`: development branch

Both branches are actively used and typically kept in sync after validated changes.
