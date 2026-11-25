# CertFlow Structure Guide

Use this map to place each new file in its fixed folder.

## Top-Level Folders and Files

| Path | Purpose |
| :--- | :--- |
| `.ctx/` | Project memory managed by CTX-PLINE (`digest.md`, `ledger.json`, `sessions/`). |
| `.github/workflows/` | Automated pipelines: CI quality gate (`ci.yml`), multi-arch GHCR Docker publish (`docker-publish.yml`) and portable desktop ZIP releases (`release-portable.yml`). |
| `docs/` | System blueprint (`BLUEPRINT.md`), six-pipeline guide (`PIPELINES.md`) and chronological development log (`DEV_TRAIL.md`). |
| `drizzle/` | Generated SQL migrations and snapshots applied automatically on server boot. |
| `scripts/` | Production boot and migrator (`start.mjs`), cross-platform portable ZIP packager (`package-portable.mjs`) and pipeline verifier (`verify-pipelines.mjs`). |
| `Dockerfile` | Multi-stage Alpine Node 22 image compatible with Railway, Render and self-hosted Docker. |
| `railway.json` | Railway config-as-code (Dockerfile build, start command, `/api/health` check and restart policy). |
| `render.yaml` | Render Blueprint for one-click web service and PostgreSQL deployment. |
| `docker-compose.yml` | Local-build Docker Compose stack (CertFlow + PostgreSQL 18 + optional Mailpit). |
| `docker-compose.ghcr.yml` | Prebuilt Docker Compose stack pulling `ghcr.io/fishyweed/certflow:latest`. |
| `Start-CertFlow.bat` / `Start-CertFlow.command` | Double-click Docker launchers for Windows and macOS. |
| `src/env.ts` | Typed environment variable definitions (`@sveltejs/kit/env`). |
| `src/hooks.server.ts` | Request hooks for first-run `/setup` gating and Better Auth sessions. |
| `src/app.css` | Tailwind CSS v4 entry, light/dark semantic tokens and dark-mode adaptive rules. |
| `src/routes/` | SvelteKit pages, layouts, server loaders, form actions and API endpoints. Pages arrange feature components. |
| `src/lib/config/` | Static configuration split by topic (`canvas.ts`, `criteria.ts`, `email.ts`, `layout.ts`, `limits.ts`, `navigation.ts`). |
| `src/lib/stores/` | Client reactive state stores (`theme.svelte.ts` for light/dark persistence). |
| `src/lib/types/` | Pure TypeScript domain types (`certflow.ts`). |
| `src/lib/components/ui/` | Reusable UI primitives (`Button.svelte`, `Badge.svelte`, `Modal.svelte`, `EmptyState.svelte`, `ScrubNumberInput.svelte`, `ImageCropResizeModal.svelte`, `image-crop.ts`, `SignaturePad.svelte`, `ThemeToggle.svelte`) built with `@ui-sdk/svelte`. |
| `src/lib/components/layout/` | Shared page chrome (`AppHeader.svelte`). |
| `src/lib/features/projects/` | Dashboard project cards and the project creation modal. |
| `src/lib/features/editor/` | Konva interactive sandbox (`editor-state.svelte.ts`, `text-utils.ts`, `rich-text.ts`, `wysiwyg.ts`, `fonts.ts`, `snapping.ts`, `CertificateCanvas.svelte`, `EditorToolbar.svelte`, `EditorToolbox.svelte`, `ElementInspector.svelte`, `RichTextEditor.svelte`, `FontPicker.svelte`, `TemplateBar.svelte`). |
| `src/lib/features/import/` | CSV and Excel parsing (`parser.ts`), template routing (`routing.ts`), table helpers (`table-ops.ts`) and inline editable spreadsheet (`EditableDataTable.svelte`). |
| `src/lib/features/certificates/` | Offscreen PDF, PNG, JPG and ZIP renderer (`renderer.ts`), `CertificatePreviewPane.svelte` and `CertificatePropertiesPanel.svelte`. |
| `src/lib/templates/` | Six starter certificate template presets (`starter.ts`). |
| `src/lib/server/db/` | PostgreSQL / PGlite connection (`index.ts`) and Drizzle schema (`schema.ts`). |
| `src/lib/server/` | Server-only modules (`runtime-config.ts`, `portable-updater.ts`, `auth.ts`, `crypto.ts`, `storage.ts`, `asset-cleanup.ts`, `projects.ts`, `mail.ts`). |

## Rules for New Work

1. Add reusable headless UI controls in `src/lib/components/ui/` with `@ui-sdk/svelte` primitives and semantic tokens from `src/app.css`.
2. Put feature components inside `src/lib/features/<feature>/`, with one component per file.
3. Put constants and defaults in `src/lib/config/<topic>.ts`, never inline inside pages.
4. Keep secrets in `.env` (local) or platform variables (cloud) and declare them in `src/env.ts` and `.env.example`.
5. Support all three responsive tiers (Mobile `< 768px`, Tablet `768px–1023px`, Desktop `>= 1024px`) with `src/lib/config/layout.ts`, zero horizontal overflow and touch-safe targets.
6. Write all UI copy, documentation and comments in fully British English without an Oxford comma, as defined in `AGENTS.md`.
7. Run `pnpm run verify` before committing and update `STRUCTURE.md`, `docs/PIPELINES.md` and `docs/DEV_TRAIL.md` whenever you add a new folder, route, pipeline or milestone.
