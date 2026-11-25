# CertFlow — System Blueprint

This document defines the architecture, tech stack, routes, core workflows, deployment targets and extension boundaries for CertFlow. Keep this file current when you change core behaviour or add modules.

---

## 1. Product Scope

CertFlow is a full-lifecycle certificate editor, generator and bulk email distributor organised by event projects.

Core capabilities:
1. User accounts with saved projects per account (up to 10 projects and 30 MB asset quota per account on hosted instances).
2. Six custom starter templates (`Classic Academic`, `Modern Executive`, `Gold Gala Award`, `Minimalist Editorial`, `Tech & Hackathon`, `Formal Diploma`) plus multiple templates per project routed automatically by Role, Rank or any custom Property.
3. Interactive Konva canvas editor with a unified top **Editor Toolbar** (114 live-preview Google and system fonts, font size, colour, bold, italic, underline, horizontal/vertical alignment, justify, text case, spacing, word wrap and canvas centring), smart equal-spacing snap guides, marquee multi-selection, grouping, image cropping, freehand or uploaded signatures and conditional text rules with per-word inline font, size, colour and style formatting.
4. Always-visible inline editable data table with CSV and Excel (`.csv`, `.xlsx`, `.xls`) import/export, search, sort, filter, drag-to-reorder rows and columns and live matched template badges.
5. Batch certificate generation with side-by-side live preview, expandable view, per-certificate Property overrides and client-side PNG, JPG, PDF and role-grouped ZIP exports.
6. Bulk email delivery with saved per-project drafts, live batch progress and Stop button, per-recipient delivery status tracking, **Send Remaining** quota resumption and encrypted sender profiles (Brevo API, Resend API or custom SMTP).
7. Light and dark mode with zero-flash persistence while preserving exact certificate colours on canvas and signature pads.
8. Six delivery pipelines: local dev, Railway production, Railway self-deploy, Render Blueprint, Docker Compose / GHCR and zero-install portable desktop `.zip` releases.

---

## 2. Tech Stack Decisions

| Layer | Choice | Version / Adapter | Reason |
| :--- | :--- | :--- | :--- |
| App Framework | SvelteKit + Svelte 5 (Runes) + TypeScript | `@sveltejs/kit@3.4`, `svelte@5.59`, `typescript@6.0` | Fast compiled reactivity, small bundles and smooth interaction in the canvas editor and data table. |
| Server Adapter | `@sveltejs/adapter-node` | `@sveltejs/adapter-node@6.0` | Single portable Node 22 server bundle shared across Railway, Render, Docker and Portable ZIP builds. |
| Styling and Tokens | Tailwind CSS v4 + CSS Theme Tokens | `tailwindcss@4.3`, `@tailwindcss/vite@4.3` | Utility styles backed by light and dark semantic CSS variables in `src/app.css` so a custom design system drops in cleanly later. |
| UI Primitives | Vercel UI SDK + Lucide Icons | `@ui-sdk/svelte@0.1.0-beta.14`, `@ui-sdk/core`, `@lucide/svelte@1.78` | Headless accessible primitives with zero visual lock-in. |
| Canvas Sandbox | Konva | `konva@10.10` | 60fps 2D stage with `Transformer` resize handles, rich-text word layout, centre and equal-spacing snap guides and high-DPI export. |
| Export Engine | `pdf-lib` + `jszip` | `pdf-lib@1.17`, `jszip@3.10` | Client-side 2.5x high-DPI PNG, JPG and exact-ratio PDF export plus folder-grouped ZIP archives at zero server CPU cost. |
| Spreadsheet Import | PapaParse + SheetJS | `papaparse@5.7`, `xlsx@0.18` | Reliable client parsing for `.csv`, `.xlsx` and `.xls` files before server persistence. |
| Database and ORM | PostgreSQL + Drizzle ORM (`PGlite` embedded) | `drizzle-orm@0.45`, `postgres@4.1`, `@electric-sql/pglite@0.5` | Relational integrity with JSONB canvas state and zero-dependency WASM Postgres for local dev and portable apps. |
| Authentication | Better Auth | `better-auth@1.7` | Native Drizzle PostgreSQL adapter and SvelteKit cookie hooks for email and password authentication. |
| Validation | Zod | `zod@4.6` | Strict runtime schema validation on every API route and form action. |
| Email Delivery | Nodemailer + Brevo / Resend HTTPS APIs | `nodemailer@10.6` | Supports HTTPS APIs over port 443 (Railway/Render compatible), local file outbox, Mailpit and AES-256-GCM encrypted custom SMTP. |
| Hosting and Packaging | Railway, Render, Docker/GHCR and Portable ZIPs | `Dockerfile`, `railway.json`, `render.yaml`, `scripts/package-portable.mjs` | One codebase runs in cloud PaaS, self-hosted containers and zero-install offline desktop bundles. |

---

## 3. Development Tools

| Tool | Role | Command |
| :--- | :--- | :--- |
| `pnpm` (v12) | Package manager (`pnpm-workspace.yaml` allows `esbuild` builds) | `pnpm install`, `pnpm dev` |
| Full Quality Gate | Pipeline checks, unit tests, type check and production build | `pnpm run verify` |
| `svelte-check` | TypeScript and Svelte 5 runes verification | `pnpm run check` |
| `vitest` | Unit test runner (10 suites, 48 tests) | `pnpm test` |
| `drizzle-kit` | Database migrations, schema push and visual studio | `pnpm run db:generate`, `pnpm run db:push`, `pnpm run db:studio` |
| Docker Compose | Local-build stack (`docker-compose.yml`) or prebuilt GHCR stack (`docker-compose.ghcr.yml`) | `pnpm run docker:up`, `pnpm run docker:ghcr` |
| Portable Packager | Cross-platform desktop `.zip` bundler | `pnpm run release:portable` |
| CTX-PLINE | Session memory, decisions, facts and task ledger in `.ctx/` | `python .ctx/ctx.py load --slim`, `python .ctx/ctx.py save` |

---

## 4. Complete Route and API Map

### Pages (`src/routes/`)

| Route | Auth | Responsibility |
| :--- | :--- | :--- |
| `/` | Public | Minimal landing page with links to Sign In, Sign Up or Dashboard. |
| `/setup` | Self-hosted only | First-run one-step account creation wizard (with collapsible Advanced Settings) that locks permanently once complete. |
| `/login` | Public | Email and password Sign In or Sign Up via `authClient`. |
| `/dashboard` | Required | Saved projects grid, colour-coded counts and `CreateProjectModal`. |
| `/settings` | Required | Account info, Account Usage & Storage cleanup card and saved Email Sender Profiles (Brevo, Resend or encrypted SMTP). |
| `/projects/[projectId]` | Owner | Redirects to `/projects/[projectId]/editor`. |
| `/projects/[projectId]/editor` | Owner | `TemplateBar`, top `EditorToolbar`, `EditorToolbox`, Konva `CertificateCanvas` and `ElementInspector` (Text Content, Conditional Rules, Geometry and Starter Templates). |
| `/projects/[projectId]/data` | Owner | Inline `EditableDataTable`, CSV/Excel import and export, column-to-property mapping and matched template badges. |
| `/projects/[projectId]/certificates` | Owner | Batch generation, role filters, matched-height numbered list, live preview pane, Properties inspector and PNG, JPG, PDF or ZIP export. |
| `/projects/[projectId]/email` | Owner | Sender profile selector, saved per-project draft editor, live batch progress with Stop, sortable Delivery Tracker and **Send Remaining** resumption. |
| `/projects/[projectId]/settings` | Owner | Smooth no-flicker project details editor, custom property manager and inline project deletion confirmation. |

### API Endpoints (`src/routes/api/`)

| Endpoint | Methods | Purpose |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health probe returning `ok`, `setup_required` or `503` (used by Railway, Render, Docker and portable launchers). |
| `/api/auth/[...all]` | Handled by `hooks.server.ts` | Better Auth sign-up, sign-in, sign-out and session endpoints. |
| `/api/account/storage/cleanup` | `POST` | Scans user projects and removes unreferenced uploaded images from disk and DB. |
| `/api/assets` | `POST` | Upload logo, signature or background image assets with MIME, 10 MB file and 30 MB account quota checks. |
| `/api/assets/file/[key]` | `GET` | Serve uploaded local assets with ownership and path-traversal checks. |
| `/api/projects/[projectId]/templates` | `POST` | Create a new certificate template inside a project. |
| `/api/projects/[projectId]/templates/[templateId]` | `PATCH`, `DELETE` | Save canvas layout, dimensions and property filters (auto-pruning stale assets), or delete the template. |
| `/api/projects/[projectId]/recipients` | `POST` | Save table headers, raw rows, mapped property values and column mapping. |
| `/api/projects/[projectId]/certificates/generate` | `POST` | Route each recipient row to its matched template and create certificate records. |
| `/api/projects/[projectId]/certificates/[certificateId]` | `PATCH` | Update individual certificate Properties (`certName`, `recipientName`, `certTitle`, `role`, `ranking`, `email`, `templateId`). |
| `/api/projects/[projectId]/email/draft` | `PUT` | Save per-project email subject, body, format and sender profile selection. |
| `/api/projects/[projectId]/email/send` | `POST` | Send a batch of rendered certificate attachments, log per-recipient delivery and update email status. |
| `/api/sender-profiles` | `GET`, `POST` | List and create email sender profiles with AES-256-GCM encryption for API keys and SMTP passwords. |
| `/api/sender-profiles/[profileId]` | `PATCH`, `DELETE` | Update or delete a saved sender profile. |

---

## 5. Core Workflows

### A. Property and Template Routing (`src/lib/features/import/routing.ts`)
1. Every template specifies optional `assignedRoles`, `rankingRule` and `propertyFilters` selected in the vertical property checklist.
2. During generation, `matchTemplateForRow()` evaluates property filters and ranks specificity so specific templates win over generic templates and the project default.

### B. Interactive Canvas, Rich Text and Export Parity
1. Both the live Konva editor (`CertificateCanvas.svelte`) and the offscreen exporter (`renderer.ts`) share `text-utils.ts`, `rich-text.ts` and `fonts.ts`.
2. Highlighting words inside **Text Content** or any **Conditional Rule** switches the top `EditorToolbar` to per-word styling (`<font=...>`, `<size=...>`, `<color=...>`, `**bold**`, `*italic*`, `<u>underline</u>`) while keeping alignment, case, wrap and spacing scoped to the element.
3. No generated PDF or image binaries sit in PostgreSQL or object storage; each certificate record stays around 2 KB.

### C. Batched Email Distribution and Quota Resumption
1. The email page renders certificates client-side in batches of 10 in the chosen format (PDF, PNG or JPG) with a live progress bar and Stop button.
2. Per-recipient status (`Sent`, `Failed`, `Not Sent`, `No Email`) is tracked in `email_logs` and displayed in a sortable table.
3. **Send Remaining** skips already-sent recipients so large lists can resume across daily provider quotas (such as Brevo's 300 emails/day free limit).

---

## 6. Design System Drop-In Strategy

Current UI uses semantic CSS variables in `src/app.css` (with full light and dark theme tokens) so a custom design system can be applied without touching feature logic:
1. Replace semantic tokens in `src/app.css` (`--color-surface-*`, `--color-border-*`, `--color-ink-*`, `--color-accent*`, `--color-tone-*`).
2. Restyle shared primitives in `src/lib/components/ui/` and `src/lib/components/layout/AppHeader.svelte`.
3. Keep `.preserve-light` on `CertificateCanvas` and `SignaturePad` so user artwork never inverts in dark mode.

---

## 7. Responsive Layout Criteria (Desktop, Tablet and Mobile)

Every page supports three explicit viewport tiers defined in `src/lib/config/layout.ts` with zero horizontal overflow and touch-safe tap targets (>= 24×24px):

| Tier | Width | Layout Behaviour |
| :--- | :--- | :--- |
| **Mobile** | `< 768px` (tested at `375px`) | Single-column flow. The editor pins the top toolbar and auto-fitted Konva canvas on top with a collapsible panel switcher below and 13px touch resize handles. |
| **Tablet** | `768px – 1023px` (tested at `768px`) | Two-column grids for project cards and forms. The editor shows the full-width canvas on top with a 2-column `Toolbox \| Inspector` split below. |
| **Desktop** | `>= 1024px` (tested at `1280px`) | Multi-column grids (3 columns on dashboard). The editor locks to viewport height as a 3-column studio with resizable side panels and a fixed-height top formatting toolbar. |

---

## 8. Known Limitations and Future Development Plans

### Current Limitations
1. **Local Disk Storage Only (`STORAGE_DRIVER=local`):** S3 / Cloudflare R2 object storage is stubbed in `src/lib/server/storage.ts`. On Render Free Tier (no persistent disk), uploaded images reset on redeploy unless a Persistent Disk or S3/R2 driver is attached.
2. **Client-Side Raster PDF Rendering:** Exported PDFs embed a crisp 2.5x high-DPI PNG inside `pdf-lib` rather than selectable vector text paths. This guarantees 100% parity across all 114 Google Fonts and rich-text layouts, at the cost of slightly larger PDF file sizes (~300–900 KB) and non-selectable PDF text.
3. **Browser-Driven Batch Emailing:** Bulk email rendering runs in the browser tab in batches of 10 so server CPU stays near zero. Closing the browser tab pauses the batch (resumable via **Send Remaining**).
4. **Embedded `PGlite` Single-Process Concurrency:** Ideal for local dev and single-user portable desktop use; multi-user team deployments should use PostgreSQL (Docker Compose, Railway or Render).
5. **OS Unsigned Binary Prompts (Portable Edition):** Portable launchers are unsigned scripts and Node binaries, so Windows SmartScreen or macOS Gatekeeper may show a first-run confirmation prompt.
6. **Cloud Free-Tier Outbound SMTP Blocks:** Railway Free/Hobby and Render block outbound SMTP ports `465`/`587`; users on those hosts must use Brevo or Resend HTTPS API profiles.

### Future Development Roadmap
1. **S3 / Cloudflare R2 Storage Driver:** Implement the `s3` adapter in `src/lib/server/storage.ts` so Render Free Tier and multi-replica deployments store images permanently in object storage.
2. **Custom Design System Pass (`T-9`):** Swap semantic tokens in `src/app.css` and restyle `src/lib/components/ui/` primitives once the final brand system is ready.
3. **Public Certificate Verification & QR Codes (Optional):** Add an optional QR code canvas element and `/verify/[certCode]` public verification page.
4. **Server-Side Background Email Queue:** Optional durable background sending so large 500+ recipient batches continue even if the organiser closes their browser tab.
5. **Rich HTML Email Templates & Custom Attachments:** Support formatted HTML email bodies and inline logo banners alongside plain text.
6. **Team Workspaces & Role Permissions:** Share projects across multiple committee members on one organisation account.
7. **Code-Signed Installers / Native Packaging:** Optionally sign Windows/macOS portable builds to remove OS first-run warnings.
