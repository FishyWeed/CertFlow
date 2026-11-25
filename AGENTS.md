<!-- CTX-PLINE -->
## Project memory (CTX-PLINE)
This project keeps session memory in `.ctx/`.
- Start of session: run `python .ctx/ctx.py load --slim` (skip it if a hook already added "# Slim context" or "# Project context").
- Before each new task: run `python .ctx/ctx.py recall <task words>` for the decisions and facts that apply (skip it if a hook
  already added "Project context that may apply to this prompt").
- Look up past items: `python .ctx/ctx.py find <words>` or `python .ctx/ctx.py show <ID>`.
- End of session / milestone: run `python .ctx/ctx.py next`, then save with `python .ctx/ctx.py save` (`--file`, `--text`, or stdin):
  `Summary:` + tagged lines `D:` decision · `F:` fact · `T:` task · `I:` issue · `X: ID1, ID2 <why>` · `F~N: updated fact`.
- Never edit `.ctx/digest.md` or `ledger.json` by hand.
<!-- CTX-PLINE -->

## English and style rules (CertFlow)

Apply these rules to all text you write in this project: UI copy, documentation, default templates, user messages, code comments and commit messages.

- Use fully British English throughout the project:
  - Spell with `-ise`, `-yse` and `-isation` (`organise`, `organiser`, `customise`, `normalise`, `analyse`, `organisation`). Keep words that take `z` in British English (`size`, `resize`, `prize`, `zone`, `zoom`).
  - Use `-our` (`colour`, `behaviour`, `honour`), `-re` (`centre`, `centred`) and doubled `l` (`labelled`, `cancelled`, `modelling`).
  - Use British forms such as `grey`, `catalogue` and `dialogue` in prose.
- Do not use an Oxford comma: write "red, white and blue", not "red, white, and blue".
- Follow ASD-STE100 Simplified Technical English:
  - Use common words in one meaning only. Keep terms consistent everywhere (`folder`, `Property`, `template`, `recipient`, `certificate`, `project`).
  - Write one instruction per sentence in the imperative with at most 20 words.
  - Write descriptions with at most 25 words per sentence. Keep one topic per paragraph with at most 6 sentences.
  - Use the active voice and simple tenses (present, past, future).
  - Avoid `-ing` words as verbs where a simple verb works.
  - Use a single verb instead of a phrasal verb (`start`, not `fire up`). Avoid slang, jargon and idioms.
  - Do not stack more than 3 nouns.
  - Keep `the`, `a` and `an`. Put conditions first (`If X, do Y`). Use lists for steps.
  - Write warnings first as clear commands with the reason.
- Match tone to context:
  - Technical docs, code comments, commit messages and app UI: neutral, medium formality, low energy. Write plain, exact English with no emoji.
  - Public landing page (`/`): clear, confident and short text with no emoji.
- Do not rename code identifiers, CSS properties (`color`, `text-center`), Konva enum values (`'center'`, `'capitalize'`), commands, file paths, quotes or protocol tokens.

## Visual QA and Demo Screenshots (Playwright MCP)

- This workspace includes the `certflow-playwright` plugin (`.agents/plugins/certflow-playwright/mcp_config.json`) exposing the Playwright MCP server (`@playwright/mcp@latest`).
- Use Playwright MCP during local development to visually verify UI and design-system changes in both light mode and dark mode before pushing to GitHub.
- Follow `.agents/plugins/certflow-playwright/skills/capture-demo-screenshots/SKILL.md` when generating product screenshots, landing-page media (`static/demo/`) or slide assets (`docs/media/`).
