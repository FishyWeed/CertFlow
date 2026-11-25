# CertFlow — System Blueprint

This document defines the architecture, tech stack, tools, routes, workflows and extension boundaries for CertFlow. Keep this file current when you change core behaviour or add modules.

---

## 1. Product Scope

CertFlow is a full-lifecycle certificate editor, generator and email distributor organised by event projects.

Core capabilities:
1. User accounts with saved projects per account.
2. Multiple certificate templates per project bound to properties such as Role (for example, Participant or Organiser) and Ranking (for example, Champion or 1st Runner Up).
3. Interactive canvas sandbox to drag, resize, align, snap and style dynamic property placeholders (`{{name}}`, `{{title}}`, `{{role}}`, `{{ranking}}`, `{{email}}` and custom fields), static text, shapes and images.
4. Inline editable table with CSV and Excel (`.csv`, `.xlsx`, `.xls`) import, automatic header detection and manual column-to-property assignment.
5. Batch certificate generation where each certificate exposes a dedicated Properties panel with Certificate Name, Recipient Name, Event Title, Role, Ranking, Email and custom fields.
6. On-demand single and bulk ZIP exports in PDF, PNG and JPG.
7. Bulk email delivery to recipients with an attached email address, via the signed-in account email, a custom Reply-To address or an encrypted SMTP server.

---

## 2. Tech Stack Decisions

| Layer | Choice | Version / Adapter | Reason |
| :--- | :--- | :--- | :--- |
| App Framework | SvelteKit + Svelte 5 (Runes) + TypeScript | `@sveltejs/kit@3.4`, `svelte@5.59`, `typescript@6.0` | Fast compiled reactivity, small bundles and smooth interaction in the canvas editor and data table. |
| Styling and Tokens | Tailwind CSS v4 + CSS Theme Tokens | `tailwindcss@4.3`, `@tailwindcss/vite@4.3` | Utility styles backed by semantic CSS variables in `src/app.css` so a custom design system drops in cleanly later. |
| UI Primitives | Vercel UI SDK + Lucide Icons | `@ui-sdk/svelte@0.1.0-beta.14`, `@ui-sdk/core`, `@lucide/svelte@1.78` | Headless accessible primitives (`dialog`, `color-picker`, `number-input`, `select`, `tabs`, `toggle-group`) with zero visual lock-in. |
| Canvas Sandbox | Konva | `konva@10.10` | 60fps 2D stage with `Transformer` resize handles, word-wrapped text nodes, centre and equal-spacing snap guides and high-DPI export. |
| Export Engine | `pdf-lib` + `jszip` | `pdf-lib@1.17`, `jszip@3.10` | Client-side 300-DPI PNG, JPG and exact-ratio PDF export plus folder-grouped ZIP archives at zero server CPU cost. |
| Spreadsheet Import | PapaParse + SheetJS | `papaparse@5.7`, `xlsx@0.18` | Reliable client parsing for `.csv`, `.xlsx` and `.xls` files before server persistence. |
| Database and ORM | PostgreSQL + Drizzle ORM (`PGlite` in dev) | `drizzle-orm@0.45`, `postgres@4.1`, `@electric-sql/pglite` | Relational integrity with JSONB flexibility for canvas state and custom properties. Portable across PGlite, Docker, Neon, Supabase and Railway. |
| Authentication | Better Auth | `better-auth@1.7` | Native Drizzle PostgreSQL adapter and SvelteKit cookie hooks for email and password authentication. |
| Validation | Zod | `zod@4.6` | Strict runtime schema validation on every API route and form action. |
| Email Delivery | Nodemailer | `nodemailer@10.6` | Supports local file outbox, Mailpit, Brevo or Resend SMTP relay and custom SMTP servers with AES-256-GCM encrypted passwords. |
| Production Hosting (\$0 Target) | Vercel Hobby + Neon Free + Vercel Blob (or R2) + Brevo/User SMTP | `@sveltejs/adapter-auto` (switch to `@sveltejs/adapter-vercel` at deploy) | \$0/month baseline with no surprise overages on Hobby and Neon Free, auto-waking Postgres and Node.js SMTP support. |

---

## 3. Development Tools

| Tool | Role | Command |
| :--- | :--- | :--- |
| `pnpm` (v12) | Package manager (`pnpm-workspace.yaml` allows `esbuild` builds) | `pnpm install`, `pnpm dev` |
| `svelte-check` | TypeScript and Svelte 5 runes verification | `pnpm run check` |
| `vitest` | Unit test runner for routing, parsing, text and snapping logic | `pnpm test` |
| `vite build` | Production SSR and client bundle verification | `pnpm run build` |
| `drizzle-kit` | Database migrations, schema push and visual studio | `pnpm run db:push`, `pnpm run db:studio` |
| Docker Compose | Optional local PostgreSQL 16 (`:5432`) and Mailpit inbox (`:1025`, `:8025`) | `docker compose up -d` |
| CTX-PLINE | Session memory, decisions, facts and task ledger in `.ctx/` | `python .ctx/ctx.py load --slim`, `python .ctx/ctx.py save` |

---

## 4. Complete Route and API Map

### Pages (`src/routes/`)

| Route | Auth | Responsibility |
| :--- | :--- | :--- |
| `/` | Public | Minimal landing page with links to Sign In, Sign Up or Dashboard. |
| `/login` | Public | Email and password Sign In or Sign Up via `authClient`. |
| `/dashboard` | Required | Saved projects grid, colour-coded counts and `CreateProjectModal`. |
| `/settings` | Required | User account info and saved Email Sender Profiles (Reply-To or encrypted SMTP). |
| `/projects/[projectId]` | Owner | Redirects to `/projects/[projectId]/editor`. |
| `/projects/[projectId]/editor` | Owner | Template dropdown and property checklist, toolbox, Konva interactive sandbox and contextual inspector. |
| `/projects/[projectId]/data` | Owner | Editable data table, CSV and Excel import, inline column-to-property dropdowns and live matched template badges. |
| `/projects/[projectId]/certificates` | Owner | Batch generation, role filters, numbered certificate list, Properties inspector and PDF, PNG or JPG single or ZIP export. |
| `/projects/[projectId]/email` | Owner | Sender choice (account email, separate Reply-To or saved SMTP), subject and body editor, format picker and batched dispatch. |
| `/projects/[projectId]/settings` | Owner | Edit project title and description, add custom properties and delete the project. |

### API Endpoints (`src/routes/api/`)

| Endpoint | Methods | Purpose |
| :--- | :--- | :--- |
| `/api/auth/[...all]` | Handled by `hooks.server.ts` | Better Auth sign-up, sign-in, sign-out and session endpoints. |
| `/api/assets` | `POST` | Upload logo, signature or background image assets to `StorageProvider`. |
| `/api/assets/file/[key]` | `GET` | Serve uploaded local assets with ownership and path-traversal checks. |
| `/api/projects/[projectId]/templates` | `POST` | Create a new certificate template inside a project. |
| `/api/projects/[projectId]/templates/[templateId]` | `PATCH`, `DELETE` | Save canvas layout, dimensions, assigned roles and property filters, or delete the template. |
| `/api/projects/[projectId]/recipients` | `POST` | Save table headers, raw rows, mapped property values and column mapping. |
| `/api/projects/[projectId]/certificates/generate` | `POST` | Route each recipient row to its matched template and create certificate records. |
| `/api/projects/[projectId]/certificates/[certificateId]` | `PATCH` | Update individual certificate Properties (`certName`, `recipientName`, `certTitle`, `role`, `ranking`, `email`, `templateId`). |
| `/api/projects/[projectId]/email/send` | `POST` | Send a batch (up to 20) of rendered certificate attachments, log delivery and update email status. |
| `/api/sender-profiles` | `GET`, `POST` | List and create email sender profiles with AES-256-GCM encryption for SMTP passwords. |

---

## 5. Core Workflows

### A. Property and Template Routing (`src/lib/features/import/routing.ts`)
1. Every template specifies optional `assignedRoles`, `rankingRule` and `propertyFilters` checked in the vertical property checklist:
   - Leave a checked property's text input blank to match any filled value.
   - Enter comma-separated values to match specific entries (for example, `Participant, Organiser` or `Champion, 1st Runner Up`).
2. During generation, `matchTemplateForRow()` evaluates property filters and ranks specificity so specific templates win over generic templates and the project default.

### B. Interactive Canvas and On-Demand Export Parity
1. Both the live Konva editor (`CertificateCanvas.svelte`) and the offscreen exporter (`renderer.ts`) call the same pure helpers in `src/lib/features/editor/text-utils.ts` (`resolveElementText`, `buildKonvaFontStyle`, `applyAutoFit`).
2. Placeholder elements (`type: 'placeholder'`) show only the property value (or `fallbackText` when empty). Text boxes (`type: 'text'`) also accept inline `{{property}}` tokens.
3. Resize handles update element `width` and `height` in `EditorState` and reset Konva `scaleX` and `scaleY` to `1`. Word wrap and auto-fit behave identically in preview and exported files.
4. No generated PDF or image binaries sit in Postgres or object storage; each certificate record stays around 2 KB.

### C. Batched Email Distribution
1. The email page renders certificates client-side in batches of 10 in the chosen format (PDF, PNG or JPG).
2. Each batch posts to `/api/projects/[projectId]/email/send` to keep server requests fast and inside serverless timeout limits.
3. The sender skips recipients without an email address and reports them in the summary.

---

## 6. Design System Drop-In Strategy

Current UI uses simple utilitarian styles so you can apply a custom design system later without changes to feature logic:
1. Replace semantic tokens in `src/app.css` (`--color-surface-*`, `--color-border-*`, `--color-ink-*`, `--color-accent*`, `--color-tone-*`).
2. Restyle shared primitives in `src/lib/components/ui/` (`Button.svelte`, `Badge.svelte`, `Modal.svelte`, `EmptyState.svelte`) and `src/lib/components/layout/AppHeader.svelte`.
3. Add new `@ui-sdk/svelte` headless primitives (`select`, `tabs`, `color-picker`, `number-input`, `toggle-group`) inside `src/lib/components/ui/` as thin styled wrappers.

---

## 7. Responsive Layout Criteria (Desktop, Tablet and Mobile)

Every CertFlow page and feature supports three explicit viewport tiers defined in `src/lib/config/layout.ts` with zero horizontal overflow and touch-safe tap targets (>= 24×24px):

| Tier | Width | Layout Behaviour |
| :--- | :--- | :--- |
| **Mobile** | `< 768px` (tested at `375px`) | Single-column flow. The editor pins the auto-fitted Konva canvas on top with a collapsible panel switcher (`Elements`, `Edit Item / Canvas`, `Hide`) below and 13px touch resize handles. Stage tabs and toolbars scroll cleanly inside their own containers. |
| **Tablet** | `768px – 1023px` (tested at `768px`) | Two-column grids for project cards and forms. The editor shows the full-width auto-fitted canvas on top with a 2-column `Toolbox \| Inspector` split below. |
| **Desktop** | `>= 1024px` (tested at `1280px`) | Multi-column grids (3 columns on dashboard). The editor locks to viewport height as a 3-column studio with resizable side panels; only the side panels scroll. |
