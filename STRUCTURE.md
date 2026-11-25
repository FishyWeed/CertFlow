# CertFlow Structure Guide

Use this map to place each new file in its fixed folder.

## Top-Level Folders

| Path | Purpose |
| :--- | :--- |
| `.ctx/` | Project memory managed by CTX-PLINE (`digest.md`, `ledger.json`, `sessions/`). |
| `docs/` | System blueprint (`BLUEPRINT.md`) and development log (`DEV_TRAIL.md`). |
| `src/env.ts` | Typed environment variable definitions (`@sveltejs/kit/env`). |
| `src/hooks.server.ts` | Request hooks for Better Auth sessions. |
| `src/app.css` | Tailwind CSS v4 entry and semantic design tokens for future design system swaps. |
| `src/routes/` | SvelteKit pages, layouts, server loaders, form actions and API endpoints. Pages arrange feature components. |
| `src/lib/config/` | Static configuration split by topic (`canvas.ts`, `criteria.ts`, `email.ts`, `layout.ts`, `navigation.ts`). |
| `src/lib/types/` | Pure TypeScript domain types (`certflow.ts`). |
| `src/lib/components/ui/` | Reusable UI primitives (`Button.svelte`, `Badge.svelte`, `Modal.svelte`, `EmptyState.svelte`, `ScrubNumberInput.svelte`, `ImageCropResizeModal.svelte`, `image-crop.ts`, `SignaturePad.svelte`) built with `@ui-sdk/svelte`. |
| `src/lib/components/layout/` | Shared page chrome (`AppHeader.svelte`). |
| `src/lib/features/projects/` | Dashboard project cards and the project creation modal. |
| `src/lib/features/editor/` | Konva interactive sandbox (`editor-state.svelte.ts`, `text-utils.ts`, `snapping.ts`, `CertificateCanvas.svelte`, `EditorToolbox.svelte`, `ElementInspector.svelte`, `TemplateBar.svelte`). |
| `src/lib/features/import/` | CSV and Excel parsing (`parser.ts`), template routing (`routing.ts`) and inline editable table (`EditableDataTable.svelte`). |
| `src/lib/features/certificates/` | Offscreen PDF, PNG, JPG and ZIP renderer (`renderer.ts`) and `CertificatePropertiesPanel.svelte`. |
| `src/lib/templates/` | Starter certificate template layouts (`starter.ts`). |
| `src/lib/server/db/` | PostgreSQL connection (`index.ts`) and Drizzle schema (`schema.ts`). |
| `src/lib/server/` | Server-only modules (`auth.ts`, `crypto.ts`, `storage.ts`, `projects.ts`, `mail.ts`). |

## Rules for New Work

1. Add reusable headless UI controls in `src/lib/components/ui/` with `@ui-sdk/svelte` primitives and semantic tokens from `src/app.css`.
2. Put feature components inside `src/lib/features/<feature>/`, with one component per file.
3. Put constants and defaults in `src/lib/config/<topic>.ts`, never inline inside pages.
4. Keep secrets in `.env` and declare them in `src/env.ts`.
5. Support all three responsive tiers (Mobile `< 768px`, Tablet `768px–1023px`, Desktop `>= 1024px`) with `src/lib/config/layout.ts`, zero horizontal overflow and touch-safe targets.
6. Write all UI copy, documentation and comments in fully British English without an Oxford comma, as defined in `AGENTS.md`.
7. Update `STRUCTURE.md` and `docs/DEV_TRAIL.md` whenever you add a new folder, route or milestone.
