# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Acquisition & Operations Platform (`artifacts/acquisition-dashboard`)
- **Type**: react-vite + Clerk auth + Express API server (port 8080)
- **Preview path**: `/`
- **Persistence**: Portfolio state in localStorage; user roles in PostgreSQL (`deal_users`)
- **Auth**: Clerk (Google OAuth + email). First sign-in → buyer role. Role-based routing.
- **Architecture**: Multi-business portfolio operating system

#### Platform Layers
1. **ACQUISITION** — sourcing, NDA, LOI, diligence, deal structure, close readiness
2. **TRANSITION** — close, Day 1, 30-day plan, account transfers, Financial Management activation
3. **OPERATIONS** — Financial Management dashboard, P&L, data source integrations, AI commentary
4. **REPORTING** — 9 report types (Internal/Lender/Investor/Exit Partner), source-traceable
5. **PORTFOLIO** — multi-business command center, leads → active → operating → exited lifecycle

#### Routes
- `/` — public landing (signed out) OR Portfolio Command Center (signed in)
- `/b/:id` — business workspace overview
- `/b/:id/:section` — sections: documents, contacts, financials, finance, lease, license, risks, day1, plan, reports, invoice-inbox, review-queue, entity-setup
- `/admin` — Admin Console (user management, role assignment, section permissions)
- `/sign-in`, `/sign-up` — Clerk auth

#### Key Files
- `src/lib/storage.ts` — Business type, PortfolioState, DashboardState; businessId-aware load/save
- `src/lib/context.tsx` — businessId-aware DashboardProvider
- `src/lib/inferWorkflow.ts` — AI inference engine: takes Business → WorkflowInference (buyer actions, seller requests, readiness scores, risk flags, deal summary, workflow track)
- `src/components/IntakeWizard.tsx` — 6-step intelligent acquisition intake wizard (Business Basics → Deal Structure → People → Documents → Financing/Ops → AI Summary). Also exports LaunchSummary.
- `src/pages/PortfolioHome.tsx` — Portfolio Command Center: business cards with doc/tag indicators, "Add New Opportunity" triggers IntakeWizard, post-submit LaunchSummary screen
- `src/pages/FinancialManagement.tsx` — Post-close financial dashboard; locks until activation checklist done
- `src/pages/Reports.tsx` — 9 report types for internal, lender, investor, exit use cases
- `src/components/Sidebar.tsx` — Business mode sidebar (← Portfolio back link, stage badge, progress)
- `src/pages/AdminConsole.tsx` — User management and per-section permission toggles
- `src/pages/SellerPortal.tsx` — Seller-only document submission view
- `src/pages/EntitySetup.tsx` — New Entity Setup phase for asset purchases: 6-task checklist (LLC, EIN, bank account, tax registration, BAR license, insurance) with blocking status banner, why-this-matters explanations, and notes fields
- `src/pages/InvoiceInbox.tsx` — GM invoice upload zone with AI processing pipeline
- `src/pages/ReviewQueue.tsx` — 3-column document review UI (item list | viewer | controls) with SVG mock thumbnails, classification dropdown, confidence thresholds, large accessible buttons

#### LOI Form + PDF System
- `src/components/LoiDocument.tsx` — @react-pdf/renderer component that generates professional PDF with HAB letterhead, 14 sections, data tables, signature block. Matches real LOI format exactly.
- `src/components/LoiFormModal.tsx` — 3-step modal: (1) Fill form (all 14 LOI fields pre-populated from Business), (2) Preview live PDF + send to seller via API or mailto fallback, (3) Upload signed return → n8n webhook → Drive + marks LOI step complete.
- `src/components/NdaLoiPanel.tsx` — NDA/LOI deal agreements status panel in Documents page. "Fill & Send LOI" button opens LoiFormModal.
- `src/lib/loiTemplate.ts` — Fallback text template (replaced by LoiDocument PDF generator)

#### NDA/LOI Smart Logic
- Uploading `d-loi-nda` (combined doc) auto-marks both `d-nda` and `d-loi` received AND checks off both `p-nda` and `p1` progress items
- Standalone NDA upload → only checks `p-nda`; standalone LOI → only checks `p1`

#### Document Pipeline (N8n)
- Upload → N8n webhook → Google Drive (storage) + Google Sheets (structured data) → AI verification result returned
- Naming: `{BusinessName} - {DocType} - {DocId} - {YYYY-MM-DD}.pdf`
- Extracted data auto-populates downstream workflow steps

#### Integration Config System (Phase 1 — complete)
- **Central config table**: `integration_configs` in PostgreSQL. Schema: `id, key, value, is_active, created_at, updated_at`. Migration runs at API server startup via `src/lib/migrate.ts`.
- **8 required integration keys**: `document_intake_webhook`, `document_retrieval_webhook`, `workflow_updates_webhook`, `financial_ingestion_webhook`, `expense_ingestion_webhook`, `reconciliation_webhook`, `reporting_webhook`, `portfolio_provisioning_webhook`.
- **Client service**: `src/lib/integrationConfig.ts` — typed `INTEGRATION_KEYS` constants, module-level cache, `loadIntegrationConfigs()` (loads from API on auth), `getIntegrationUrl(key)` (synchronous from cache), `saveIntegrationUrl(key, value)` (saves to DB), `testIntegrationUrl(key)` (server-side test), `refreshIntegrationConfigs()`. Legacy localStorage fallback during migration period via `LEGACY_KEY_MAP`.
- **API routes** (all under `/api/integrations`): `GET /` (all configs; buyer gets values, others get isConfigured only), `PUT /:key` (buyer only upsert), `GET /status` (all auth'd), `GET /url/:key` (all auth'd), `POST /test/:key` (buyer only, server-side fetch).
- **documentPipeline.ts**: `getWebhookUrl(legacyKey)` now delegates to the integration config service via `getWebhookUrlByLegacyKey()`. All 10+ existing call sites work without change.
- **IntegrationsPanel.tsx**: Rebuilt with all 8 keys, grouped (Documents / Automation / Financials / Reporting / Infrastructure), DB-backed. Admin-only write UI with "Shield" badge; read-only view for non-buyers. Integration Coverage progress bar.
- **App.tsx**: `loadIntegrationConfigs()` called after user auth resolves.
- `artifacts/api-server/src/routes/email.ts` — POST /api/email/send-loi; nodemailer via Gmail SMTP. Requires GMAIL_USER + GMAIL_APP_PASSWORD env secrets. Falls back to mailto: if not configured.

#### Invoice Inbox + AI Document Processing (Feature 1 — complete)
- **Route**: `/b/:id/invoice-inbox` — drag-and-drop upload zone for PDFs, images (JPG/PNG), and ZIP batches
- **Backend**: POST `/api/documents/upload` (multer, 50 MB limit); writes to `document_uploads` table then calls `processDocumentUpload()`
- **AI Processor**: `documentProcessor.ts` — uses pdftoppm to convert pages → PNGs, sends batches to OpenAI GPT-4o Vision with structured JSON prompt, splits multi-document PDFs, routes by confidence
- **Confidence routing**: ≥80% → extracted to `extracted_documents` + filed via `document_intake_webhook` n8n; <80% → stored in `review_queue_items` with split PDF as base64 for later filing
- **Key libs**: `pdfUtils.ts` (pdftoppm, pdf-lib splitting, thumbnails), `integrationKeys.ts` (server-side constants), `adm-zip` (ZIP extraction)
- **New DB tables**: `document_uploads`, `extracted_documents`, `review_queue_items`

#### Review Queue (Feature 2 — complete)
- **Route**: `/b/:id/review-queue` — split-panel interface for reviewing low-confidence documents
- **Left panel**: filterable item list with thumbnails, confidence pills, status badges
- **Right panel**: document image viewer with zoom + annotation tools (highlight, text note, mark region), AI explanation box (amber), reviewer notes textarea, 4 large action buttons
- **Actions**: Approve & File (sends PDF to n8n Drive webhook), Split & File (enter custom page ranges per sub-document), File Manually (mark resolved, no Drive upload), Resubmit to AI (re-runs GPT-4o with reviewer context)
- **Sidebar badge**: Review Queue nav item shows pending count, polls every 30 seconds; always visible to buyers
- **Backend routes**: `GET /api/review-queue` (list + count), `GET /api/review-queue/count`, `GET /api/review-queue/:id`, `PATCH /api/review-queue/:id`, `POST /api/review-queue/:id/action`

#### KPI Targets (True Blue Auto Care)
Revenue $200K/mo · Cars 200/mo · ARO $1,000 · GP 70% · Net Profit 17% ($34K/mo)

#### Deal Details
True Blue Auto Care Inc · Seller: Saj Zoghet · Buyer: Heath Blake / HAB Enterprises 3 LLC
Price: $300K · Rent: $8K/mo · Seller Note: $2,250/mo · Target Close: Jul 16, 2026
