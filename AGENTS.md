# Repository Guidelines

## Project Overview
Shapyeditor ships a drop-in `<web-ide>` custom element that embeds a Python playground entirely in-browser. Ace powers the editor, Pyodide handles execution with Skulpt as a lightweight fallback, and Ruff runs in a worker for formatting. Everything is bundled as a Vite library so consumers can load either ES modules or an IIFE build from `dist/`.

## Project Structure & Module Organization
`src/htmls/demo.html` is the served entry that showcases multiple `<web-ide>` instances. Runtime code and assets live in `src/s/`: `cssNjs` contains `pyide.js`, `pyideCore_v4.js`, and formatting helpers; `ace` and `aceMods` ship the editor builds and extensions; `pyodideMods` plus `skulpt` cover execution workers; `katex` adds math rendering. Place new static files beside similar assets so the static copy plugin picks them up. Builds land in `dist/`, while Playwright specs and helpers are under `tests/`; keep `test-results/` untracked.

## Build, Test, and Development Commands
- `npm install` – install Playwright, Vite, and runtime tooling.
- `npm run dev` – start Vite for local authoring (`http://localhost:5173/htmls/demo.html`).
- `npm run build` – emit `py-editor-lib.es.js` and `py-editor-lib.iife.js` plus copied assets.
- `npm test` – run the Playwright suite headless via `tests/dev-server.js`.
- `npm run testh` / `npm run testui` – execute tests headed or inspect runs interactively.

## Architecture & Runtime Notes
`pyide.js` registers `<web-ide>` and lazy-loads `pyideCore_v4.js` when a panel opens. `pyideCore` wires Ace to the Python execution workers, coordinates run/format events, and updates the UI. Execution flows through `pyodide-worker-manager.js` into `pyodide-worker.js`; formatting delegates to `ruffFormatterWorker.js`. Keep additions async-friendly so the UI thread stays responsive.

## Coding Style & Naming Conventions
Two-space indentation with semicolons is the norm. Prefer ES modules for browser code, keep CommonJS for Node utilities like `tests/dev-server.js`, and name browser modules in camelCase (`src/s/cssNjs/python-formatter.js`). Specs follow Playwright conventions with descriptive `*.spec.ts` filenames.

## Testing Guidelines
`playwright.config.ts` sets 30 s timeouts and auto-starts `tests/dev-server.js` on port 63343 with a `/healthz` probe. Keep new scenarios close to the features they cover and write assertions tolerant of worker startup timing. Run `npm test` before every PR and attach useful artifacts from `test-results/`.

## Commit & Pull Request Guidelines
Use short, imperative commit subjects (`add ruff formatter retry`). Reference issues or tickets in the body, note any new assets under `src/s`, and document build or server changes. PRs should outline user-visible impact, link Playwright evidence (trace, screenshot, or recording), and call out follow-up work if coverage is deferred.
