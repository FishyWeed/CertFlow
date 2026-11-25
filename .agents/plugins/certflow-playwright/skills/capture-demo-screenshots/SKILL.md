---
name: capture-demo-screenshots
description: Use Playwright MCP to capture crisp CertFlow product screenshots, visual QA captures and demo slide images across light mode, dark mode, desktop and mobile viewports.
---

# Capture Demo Screenshots and Visual QA (Playwright MCP)

Use the `playwright` MCP server whenever you verify UI changes locally, review a new design system or generate demo images and slides for CertFlow.

## Standard Viewports
- **Desktop showcase**: `1440 x 900` (primary viewport for README, landing page and pitch slides).
- **Tablet**: `1024 x 768` (verify responsive editor panels and sticky headers).
- **Mobile**: `390 x 844` (verify mobile header wrapping, tabs and forms).

## Recommended Capture Set
1. `/` — Public landing page (hero preview, capabilities, deploy guide and footer) in both Light Mode and Dark Mode.
2. `/dashboard` — Projects overview with sample projects.
3. `/projects/<id>/editor` — Design Editor with gridded sandbox, top formatting toolbar, selected text element and Inspector panel.
4. `/projects/<id>/data` — Data & Mapping table showing matched template badges.
5. `/projects/<id>/certificates` — Side-by-side recipient list and live certificate preview.
6. `/projects/<id>/email` — Bulk email composer and recipient delivery tracker.
7. `/settings` — Account settings, Sender Profile Setup Guide and Portable App Updates card.

## Where to Save Assets
- **Public site and README demo images**: `static/demo/<slug>-light.png` and `static/demo/<slug>-dark.png`.
- **Documentation and presentation slides**: `docs/media/<slug>.png`.
- **Temporary QA captures**: keep in the conversation artifact directory rather than committing to Git.

## Workflow Steps
1. Start the local server (`pnpm dev` on `http://localhost:5678` or `pnpm preview`).
2. Navigate with Playwright MCP, wait for fonts (`document.fonts.ready`) and canvas rendering to finish.
3. Capture clean screenshots with no console errors and inspect them before pushing changes to GitHub.
