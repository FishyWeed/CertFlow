# CertFlow — Development Trail

This log records each milestone, architectural decision, file group, check result and open gap in chronological order. Read this file alongside `.ctx/digest.md` before you continue development.

---

## Milestone 1 — Foundation, Database Schema and Auth (2026-11-24)

### What Was Built
- Scaffolded SvelteKit 3.4, Svelte 5.59 (Runes), TypeScript 6 and Tailwind CSS v4.
- Configured SvelteKit 3 typed environment variables in `src/env.ts` (`@sveltejs/kit/env`, imported via `$app/env/private`).
- Defined the PostgreSQL relational schema in `src/lib/server/db/schema.ts` with Drizzle ORM:
  - Better Auth tables: `user`, `session`, `account`, `verification`.
  - Domain tables: `sender_profiles`, `projects`, `templates`, `assets`, `recipients`, `certificates`, `email_jobs`, `email_logs`.
- Connected Better Auth (`src/lib/server/auth.ts`, `src/hooks.server.ts`, `src/lib/auth-client.ts`).
- Built an AES-256-GCM encryption helper (`src/lib/server/crypto.ts`) for custom SMTP passwords and a pluggable `StorageProvider` (`src/lib/server/storage.ts`).
- Added an optional Docker stack in `docker-compose.yml` (PostgreSQL 16 and Mailpit) and `.env.example`.
- Created the landing (`/`), sign-in/sign-up (`/login`) and Projects Dashboard (`/dashboard`) routes.

### Decisions and Reasons
- Chose SvelteKit 3 and Svelte 5 over Next.js for fast runtime performance and small client bundles.
- Added `pnpm-workspace.yaml` with `allowBuilds: { esbuild: true }` to satisfy pnpm 12 build policy.
- Chose on-demand certificate export instead of stored PDFs because public verification links are out of scope.

### Verification
- `pnpm run check`: 0 errors and 0 warnings.
- `pnpm run build`: SSR and client builds succeeded.

---

## Milestone 2 — Vercel UI SDK, Modular Structure and Hosting Strategy (2026-11-24)

### What Was Built
- Installed and tested Vercel UI SDK (`@ui-sdk/svelte@0.1.0-beta.14` and `@ui-sdk/core`).
- Built reusable `Modal.svelte` on `@ui-sdk/svelte/dialog` with `closeOnOutsidePress={false}` so form edits do not close accidentally.
- Split configuration into topic files (`src/lib/config/canvas.ts`, `src/lib/config/criteria.ts`, `src/lib/config/email.ts`).
- Extracted layout and project components (`AppHeader.svelte`, `ProjectCard.svelte`, `CreateProjectModal.svelte`) so pages only arrange components.
- Initialised CTX-PLINE memory in `.ctx/` and created `STRUCTURE.md`.
- Selected **Vercel Hobby + Neon Free + Vercel Blob (or R2) + Brevo/User SMTP** as the \$0/month production target.

### Verification
- `pnpm run check`: 0 errors and 0 warnings.
- `pnpm run build`: SSR (3.11s) and client (3.61s) builds succeeded.

---

## Milestone 3 — Workspace, Konva Editor, Import, Properties and Email (2026-11-24)

### What Was Built
- **Design Tokens and UI Primitives**: Added semantic tokens in `src/app.css`, navigation config in `src/lib/config/navigation.ts` and simple UI primitives (`Button.svelte`, `Badge.svelte`, `EmptyState.svelte`).
- **Interactive Konva Editor (`src/lib/features/editor/`)**:
  - `text-utils.ts`: Shared placeholder resolution, text case transforms, Konva fontStyle mapping and auto-fit sizing.
  - `editor-state.svelte.ts`: Reactive Svelte 5 document store with 40-step Undo/Redo history, zoom, preview toggle, layer order and alignment helpers.
  - `CertificateCanvas.svelte`: Konva `Stage`, `Layer`, `Transformer` resize and rotate handles, centre X/Y snap guides, scale-to-width normalisation and keyboard shortcuts (Ctrl+Z/Y, Delete, Arrow nudge).
  - `EditorToolbox.svelte`: Property placeholders, static text and shape buttons, image upload controls and layer list.
  - `ElementInspector.svelte`: Contextual inspector for font, size, colour, bold, italic, underline, case, alignment, word wrap, auto-fit, ellipsis, line height, letter spacing and exact geometry.
  - `TemplateBar.svelte`: Template switcher, add/edit modals, Undo/Redo, zoom, preview toggle, save and quick PDF, PNG or JPG export.
- **CSV and Excel Import (`src/lib/features/import/` and `/projects/[projectId]/data`)**:
  - `parser.ts`: CSV (`papaparse`) and Excel (`xlsx`) parsing plus alias-based header auto-matching.
  - `routing.ts`: Deterministic template matcher (`matchTemplateForRow`).
  - `data/+page.svelte` and `POST /api/projects/[projectId]/recipients`.
- **Certificates, Properties Panel and Export (`src/lib/features/certificates/` and `/projects/[projectId]/certificates`)**:
  - `renderer.ts`: Offscreen Konva 2.5x high-DPI renderer for PNG, JPG, `pdf-lib` PDF and `jszip` bulk ZIP archives.
  - `CertificatePropertiesPanel.svelte`: Per-certificate inspector for Assigned Template, Certificate Name, Recipient Name, Event Title, Role, Ranking and Email.
  - `certificates/+page.svelte`, `POST .../certificates/generate` and `PATCH .../certificates/[certificateId]`.
- **Bulk Email and Sender Profiles (`src/lib/server/mail.ts`, `/projects/[projectId]/email`, `/settings`)**:
  - `mail.ts`: Nodemailer transport for Account Email (Reply-To), Custom Reply-To and AES-256-GCM decrypted Custom SMTP.
  - `email/+page.svelte` and `POST .../email/send` (batches of 10 certs per request, skips missing emails, records `email_jobs` and `email_logs`).
  - `/settings` and `/api/sender-profiles` for saved sender profiles.
  - `/projects/[projectId]/settings` for project details, custom properties and deletion.

---

## Milestone 4 — Zero-Docker Local Dev, Asset Uploads and Integration Tests (2026-11-24)

### What Was Built
- **Zero-Docker Local PostgreSQL (`PGlite`)**: Updated `src/lib/server/db/index.ts` and `drizzle.config.ts` to switch automatically between embedded `PGlite` (`./.local/pgdata`) and `postgres.js` for `postgresql://` URLs.
- **Local Email Outbox**: Added `SMTP_HOST="local-outbox"` mode in `src/lib/server/mail.ts` to save email previews to `./.local/outbox/` locally while keeping Mailpit, Brevo, Resend and encrypted user SMTP active.
- **Asset Upload and Serve API**: Added `POST /api/assets` and `GET /api/assets/file/[key]` with ownership checks, MIME and size validation and path-traversal guards. Connected `EditorToolbox.svelte` to upload logos, signatures and backgrounds.
- **Google Fonts Loader**: Loaded certificate fonts (`Cinzel`, `Cormorant Garamond`, `Great Vibes`, `Inter`, `Lora`, `Montserrat`, `Playfair Display`) in `src/app.html` and added `await document.fonts.ready` inside `renderer.ts`.
- **Unit Test Suite (`Vitest`)**: Added unit tests across `routing.spec.ts`, `parser.spec.ts` and `text-utils.spec.ts`.
- **Bug Fix**: Coerced optional `FormData` fields with `String(formData.get(...) ?? '')` in `dashboard/+page.server.ts` and `projects/[projectId]/settings/+page.server.ts`.

### Verification
- `pnpm test`: 3 test files, 11/11 tests passed.
- `pnpm db:push --force`: Applied all 12 tables, 5 enums and 16 indexes to embedded `PGlite`.
- Live HTTP, SSR and DB integration test passed end to end (sign-up, project creation, all 5 workspace tabs, Organiser template creation, PNG upload/read, 5-row CSV import, certificate generation, role routing, `PATCH` Properties update, sender profiles, batched email send to `.local/outbox/` and project deletion).

---

## Milestone 5 — Desktop, Tablet and Mobile Responsive Architecture (2026-11-24)

### What Was Built
- Defined 3-tier viewport breakpoints (`mobile < 768px`, `tablet 768px–1023px`, `desktop >= 1024px`) in `src/lib/config/layout.ts`.
- Updated `CertificateCanvas.svelte` with `ResizeObserver` auto-fit zoom, `m-auto` scroll container, `touch-action: none` and 13px touch resize handles on mobile.
- Built single-mounted 3-tier editor layout in `src/routes/projects/[projectId]/editor/+page.svelte` to eliminate duplicate DOM IDs.
- Fixed mobile modal centring in `Modal.svelte` (`presentation="dialog"` with `inset-x-4 mx-auto`).

### Verification
- `uicheck` on `/` and `/login` at `375px`, `768px` and `1280px`: 0 serious issues and 0 warnings.
- Headless browser audit across all 7 authenticated routes at `375px`, `768px` and `1280px` (21 checks): 21/21 passed with 0 overflow, 0 small tap targets and 0 unlabelled inputs.

---

## Milestone 6 — Editor UX Refinements, Property Checklist and British English Standards (2026-11-25)

### What Was Built
- **Viewport-Locked Desktop Studio and Resizable Side Panels**: Locked the desktop editor to `h-dvh` so only side panels scroll, and added draggable vertical dividers to resize both side panels.
- **Smart Snapping (`snapping.ts` and `snapping.spec.ts`)**: Added midpoint equal-spacing snapping between siblings, neighbour gap rhythm snapping and sibling alignment while large border frames stay ignored.
- **Sandbox Ergonomics**: Added `Ctrl+Scroll` sandbox zoom, `Ctrl+0` fit reset, click-outside and `Escape` deselection, drag-to-reorder layers and drag-and-drop `{{property}}` tokens onto both the canvas and Text Content boxes.
- **Editable Data Table (`EditableDataTable.svelte`)**: Replaced the separate column mapper with an always-visible editable spreadsheet table with inline `Property:` dropdowns, add/rename/delete columns, add/delete rows and an overwrite confirmation modal on CSV/Excel import.
- **Pure Placeholders and Property Checklist**: Removed hidden prefix/suffix text from placeholders so `{{property}}` shows only its value or fallback. Replaced template rule dropdowns with a vertical property checkbox list where unchecked rows disable text input.
- **British English and ASD-STE100 Style**: Standardised all project documentation, UI copy, default templates, user messages and code comments to fully British English without Oxford commas, and recorded the rules in `AGENTS.md`.

### Open Tasks
1. **Custom Design System Pass**: Swap semantic tokens in `src/app.css` and primitives in `src/lib/components/ui/` once the final design system is ready.
2. **S3 / Cloudflare R2 Storage Driver**: Implement `STORAGE_DRIVER="s3"` in `src/lib/server/storage.ts` for stateless cloud hosts such as Render Free Tier.

---

## Milestone 7 — 114-Font Catalogue, Image Cropping, Signatures, Rich Text and Production Railway Launch (2026-11-25)

### What Was Built
- **114-Font Searchable Catalogue (`FontPicker.svelte`, `fonts.ts`)**: Added lazy Google Font stylesheet loading, DOM face pinning and inline `<font=...>` extraction across live canvas and offscreen exports.
- **Image Cropping & Signatures (`ImageCropResizeModal.svelte`, `SignaturePad.svelte`)**: Added interactive crop/zoom/aspect modal with quality-0.92 WebP optimisation and freehand or uploaded signature support.
- **Rich Text & Conditional Rules (`rich-text.ts`, `ElementInspector.svelte`)**: Unified text and rule-based text elements with inline bold, italic, underline, colour, font and size formatting plus multi-condition rules.
- **Railway Production Deployment**: Migrated to `@sveltejs/adapter-node`, added `scripts/start.mjs` auto-migrations, `/api/health`, Brevo and Resend HTTPS API email delivery and deployed live to Railway (`https://cert-flow.up.railway.app`).

---

## Milestone 8 — Email Delivery Tracker, Starter Templates, Dark Mode and Storage Quotas (2026-11-25)

### What Was Built
- **Email Delivery Tracker & Send Remaining (`/projects/[projectId]/email`)**: Added per-recipient delivery status table with click-to-sort columns, live batch progress bar with Stop button and **Send Remaining** quota resumption.
- **Six Starter Templates (`src/lib/templates/starter.ts`)**: Added `Classic Academic`, `Modern Executive`, `Gold Gala Award`, `Minimalist Editorial`, `Tech & Hackathon` and `Formal Diploma` with SVG previews and dimension-aware undo/redo.
- **Light & Dark Mode (`ThemeToggle.svelte`, `theme.svelte.ts`, `src/app.css`)**: Added zero-FOUC theme toggle with complete dark semantic tokens while keeping canvas and signature pads light-accurate via `.preserve-light`.
- **Resource Limits & Asset Cleanup (`limits.ts`, `asset-cleanup.ts`, `/api/account/storage/cleanup`)**: Enforced 10 projects, 30 MB per account and 10 MB per upload with automatic disk cleanup on delete/save and smooth no-flicker saves on Project Settings.

---

## Milestone 9 — Multi-Platform Self-Hosting, Portable Releases and Top Editor Toolbar (2026-11-26)

### What Was Built
- **Self-Hosted Runtime Config & `/setup` Wizard (`runtime-config.ts`, `src/routes/setup/`)**: Persists `/data/config.json` (mode `0600`) with automatic first-run setup for Docker and portable launches, gated off on Railway, Render and local dev.
- **One-Click Cloud, Docker & Portable Release Pipelines**:
  - `render.yaml` Render Blueprint + **Deploy to Render** button and **Deploy on Railway** button in `README.md`.
  - `railway.json` Railway config-as-code, `docker-compose.yml` (local build), `docker-compose.ghcr.yml` (prebuilt GHCR image) and `.github/workflows/docker-publish.yml`.
  - `scripts/package-portable.mjs` + `.github/workflows/release-portable.yml` with zero-symlink hoisted production dependencies (`nodeLinker: hoisted`), published live as GitHub Release `v1.0.0` (`win-x64`, `darwin-arm64`, `darwin-x64`, `linux-x64`).
  - `.github/workflows/ci.yml` + `scripts/verify-pipelines.mjs` (`pnpm run verify`) and `docs/PIPELINES.md`.
- **Unified Top Editor Toolbar (`EditorToolbar.svelte`)**: Moved all text, typography, spacing, wrap and alignment controls (including `Centre: Horizontal | Vertical` and rich-text `Justify`) into a fixed-height top bar that automatically styles highlighted words (including per-word font family and font size) in Text Content or any Conditional Rule.
- **Cleanup & Hardening**: Removed unused `@sveltejs/adapter-auto`, aligned `src/env.ts` and `.env.example`, routed local outbox through `CERTFLOW_DATA_DIR`, added graceful shutdown to `scripts/start.mjs` and added already-running detection to portable launchers.
