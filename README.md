# Shapyeditor

Python editor library that packages Ace, Pyodide, and Skulpt tooling through a Vite build.

## Quick Start
- `npm install` to pull dependencies.
- `npm run dev` to serve the demo at `http://localhost:5173/htmls/demo.html`.
- `npm run build` to generate library bundles in `dist/`.

## Using `<web-ide>` in your page

Load the bundled module and drop the custom element where you need a Python playground:

```html
<script type="module" src="https://cdn.example.com/shapyeditor/web-ide.es.js"></script>

<web-ide></web-ide>
```

By default the element downloads all required workers, Ace modules, and styles relative to the script location. If you host the assets yourself, point the element (or all instances globally) at your base directory:

```html
<web-ide assets-path="https://my.cdn.com/shapyeditor/"></web-ide>
```

Or call the helper once after importing the module:

```js
import { configureWebIde } from 'shapyeditor';

configureWebIde({ assetsBaseUrl: 'https://my.cdn.com/shapyeditor/' });
```

## Contributing
See [Repository Guidelines](AGENTS.md) for workflow, testing, and review expectations.
