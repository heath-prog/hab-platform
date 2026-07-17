# CLAUDE.md — Machine Asset Manager (→ HAB Platform base repo)

Guide for coding agents working in this repo. Read this fully before changing anything.

## What this repo is

Heath Blake's (HAB Enterprises) **buyer-side business-acquisition dashboard** ("Healthy Auto Business" on Replit: `replit.com/@heath03/Machine-Asset-Manager`) — deal pipeline, due-diligence workspace, LOI generation, AI invoice/document filing.

**Strategic direction (decided 2026-07-16):** this repo is the **base of the unified HAB Platform** — one app covering the whole shop lifecycle: **Acquire** (this codebase today) / **Operate** (CRM, KPIs) / **Train** (HAB Academy curriculum, roleplay) / **Comply** / **Exit** (due-diligence data room), multi-tenant (portfolio shops + paying SaaS clients), single Postgres. The separate `hab-academy` repo is being retired; only its `content/` files migrate here. See `outputs/HAB_PLATFORM_VISION.md` (master architecture, RBAC, schema plan, re-prioritized roadmap) and `outputs/REPLIT_STATUS_AND_BACKLOG.md` (audit + WP0–WP12 backlog). Do not rebuild Acquire features while adding platform modules — Acquire is used in live deals.

## Stack

- **pnpm workspaces** monorepo, TypeScript 5.9, Node 24 (`.replit` modules: nodejs-24, postgresql-16)
- **API:** Express 5 (`artifacts/api-server`), esbuild CJS bundle, pino logging, port **8080**
- **Frontend:** React 19 + Vite 7 + Tailwind 4 + Radix/shadcn (`artifacts/acquisition-dashboard`), TanStack Query, framer-motion
- **Auth:** Clerk (`@clerk/express`, Google OAuth + email). Roles: buyer / seller / agent / pending / super_admin
- **DB:** Replit PostgreSQL + Drizzle ORM (`lib/db`) — but see "Schema reality" below
- **Validation:** Zod (`zod/v4`) + `drizzle-zod`; **API codegen:** Orval from OpenAPI spec (`lib/api-spec` → `lib/api-client-react`, `lib/api-zod`)
- **AI:** OpenAI GPT-4o Vision document pipeline (`documentProcessor.ts`, `pdftoppm` + `pdf-lib`, 20-page batching, ≥80 confidence auto-file, <80 → review queue)
- **Email:** nodemailer via Gmail SMTP (LOI + invites) — currently unconfigured, see Known bugs
- **Deployment:** Replit Autoscale (configured in `.replit`), currently **Draft / not published**

## Layout

```
artifacts/acquisition-dashboard/   React SPA. src/pages (PortfolioHome, Overview, Documents,
                                   Contacts, Financials, FinancialManagement, Finance, Lease,
                                   License, Risks, Day1, Plan, Reports, InvoiceInbox, ReviewQueue,
                                   EntitySetup, SellerPortal, AdminConsole, JoinPage, Landing,
                                   BillingSuspended), src/components (IntakeWizard, LoiDocument,
                                   LoiFormModal, NdaLoiPanel, Sidebar, ui/*), src/lib (storage.ts,
                                   context.tsx, auth.ts, apiFetch.ts, documentPipeline.ts,
                                   integrationConfig.ts, inferWorkflow.ts, financials.ts, reports.ts)
artifacts/api-server/              Express API. src/routes (admin, dealStructure, documents, email,
                                   health, integrations, portfolio, reviewQueue, users), src/lib
                                   (db.ts, migrate.ts, documentProcessor.ts, pdfUtils.ts,
                                   integrationKeys.ts, logger.ts), src/middlewares
                                   (clerkProxyMiddleware.ts)
artifacts/mockup-sandbox/          Scratch — ignore
lib/db/                            Drizzle package. drizzle.config.ts + src/schema/index.ts
lib/api-spec/, lib/api-zod/, lib/api-client-react/   OpenAPI spec + generated clients
lib/integrations/*                 Reserved workspace glob for integration adapter packages
                                   (QuickBooks/NetSuite/Tekmetric/Gmail/Drive — planned, see vision doc)
scripts/                           post-merge.sh etc.
replit.md                          Replit agent's own detailed feature inventory — good reference,
                                   but trust code over replit.md when they disagree
```

## Commands (pnpm ONLY — `preinstall` hard-blocks npm/yarn)

```bash
pnpm install
pnpm run typecheck                                    # full typecheck, all packages
pnpm run build                                        # typecheck + build all
pnpm --filter @workspace/api-server run dev           # run API locally (builds then starts)
pnpm --filter @workspace/acquisition-dashboard run dev  # Vite dev server
pnpm --filter @workspace/db run push                  # push Drizzle schema changes (dev only)
pnpm --filter @workspace/api-spec run codegen         # regen API hooks/zod from OpenAPI spec
```
Dependency versions are pinned via `pnpm-workspace.yaml` **catalog:** entries — add shared deps there, reference `"catalog:"` in package.json.

## Schema reality (important)

`lib/db/src/schema/index.ts` is an **empty stub**. Actual tables are created by **raw SQL in `artifacts/api-server/src/lib/migrate.ts`**, which runs at API startup: `integration_configs`, `document_uploads`, `extracted_documents`, `review_queue_items`, `invite_tokens`, `portfolios`, `businesses` (JSONB payload), `payment_appeals`, plus `deal_users`. `migrate.ts` also embeds large demo-seed SVG thumbnails and Heath's super_admin promotion.

Direction: port these tables into Drizzle under `lib/db/src/schema/` (one file per table family), move demo seeds to a dev-only seed script, then extend with the platform schema (tenants/accounts/advisors/etc. from `outputs/CRM_DATA_MODEL.md` §7 and `HAB_PLATFORM_VISION.md` §5.2). Any schema change must be a reversible migration — this DB backs live deals.

## Known bugs / open work (from the 2026-07-16 audit — verify against code before fixing)

1. **Dual data layer:** `BusinessWorkspace` reads **localStorage** (`src/lib/storage.ts`), not the DB → businesses break on a new device. Highest-priority fix (WP12-a).
2. **super_admin promotion timing:** promotion runs at server startup, so a fresh sign-in gets `buyer` until next restart; Admin Console redirects Heath away. Fix: promote at sign-in (WP12-b).
3. **requireBuyer guard blocks super_admin** on `GET /api/users` → 403 via `useAllDealUsers` (WP12-c).
4. **Email never sends:** `GMAIL_USER`/`GMAIL_APP_PASSWORD` secrets were never set; invite/LOI emails fall back to mailto/console. Set creds or swap to Resend (WP12-d).
5. **n8n webhooks never configured:** "filed" documents sit as `pending_sync`; Approve/Split show success but skip Drive upload. Replace n8n with direct Drive adapter + in-app event bus (WP12-e / vision §6.2).
6. **Reports page is a UI shell** — 6+ report types, all permanently "no-data".
7. **Sidebar flicker** on load (full sidebar flashes then disappears).
8. Unverified in code: soft-delete/Trash lifecycle (10-day retention), "deal structure analyzer" (`routes/dealStructure.ts` exists — verify wiring), "bank-ready/PE-structured" doc tool.
9. Document upload pipeline was Heath's recurring pain point ("document failed unauthorized", etc.) — exercise end-to-end after any change to `documents.ts`/`documentProcessor.ts`.

## Conventions

- TypeScript strict, ESM (`"type": "module"`); API bundles to CJS via `build.mjs`.
- Zod imports from `zod/v4`. Drizzle tables get `createInsertSchema` + inferred types per the pattern documented in `lib/db/src/schema/index.ts`.
- New API surface: define in `lib/api-spec` OpenAPI first, run codegen, consume via `lib/api-client-react` hooks — don't hand-write fetch clients (legacy `apiFetch.ts` exists; don't extend it).
- Frontend components follow shadcn/Radix patterns in `src/components/ui`. Brand: navy `#1B3358`, gold `#C8A75C`, cream `#FAF4E4`.
- Prefer server-derived data over localStorage; every new feature must be DB-backed and tenant-scopable.
- One focused feature per agent session (see backlog WP structure); keep diffs reviewable.

## Rules

- **NEVER commit secrets.** All credentials live in **Replit Secrets** (deployment) — currently: Clerk keys, `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`. Local dev uses a gitignored `.env`. Env vars referenced in code: `APP_URL`, `BASE_PATH`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `LOG_LEVEL`, `NODE_ENV`, `OPENAI_API_KEY`, `PORT`, `SENDER_NAME`. Never print secret values to logs, chat, or commit messages.
- **pnpm only** — npm/yarn are blocked by the preinstall hook; don't remove that hook.
- Don't edit generated output (`dist/`, `lib/*/dist`, Orval-generated files) — regenerate instead.
- Don't break live-deal paths (Acquire workspace, documents, LOI) without a tested fallback; Heath uses this during real closings.
- `replit.md` is maintained by the Replit agent; update it when architecture changes, but this file (CLAUDE.md) is the authoritative agent guide.
