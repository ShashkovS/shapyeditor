// ruffFormatterWorker.js

// Default CDNs; can be overridden by setting self.RUFF_WASM_WEB_URLS = [...]
// before the worker is created.
const DEFAULT_RUFF_WASM_WEB_URLS = (() => {
  try {
    const localUrl = new URL('./ruff/ruff_wasm.js', import.meta.url).href;
    return [localUrl];
  } catch (error) {
    return [];
  }
})();

const globalScope = self;

// Lazy, memoized state
let formatterModulePromise = null;
let workspaceCache = {
  key: null,
  workspace: null,
};

// --- Utilities ---------------------------------------------------------------

function getCandidateUrls() {
  const custom = globalScope.RUFF_WASM_WEB_URLS;
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return DEFAULT_RUFF_WASM_WEB_URLS;
}

function normalizeOptions(opts = {}) {
  // Sensible defaults; align with your project prefs.
  const lineWidth = Number.isFinite(opts.lineWidth) ? opts.lineWidth : 160;
  const indentWidth = Number.isFinite(opts.indentWidth) ? opts.indentWidth : 4;

  // Map friendly options to Ruff’s config keys
  // Ref: Ruff formatter config keys (browser)
  const indentStyle =
    opts.indentStyle === 'tab' ? 'tab' : 'space';

  const quoteStyle =
    opts.quoteStyle === 'double' ? 'double' : 'single';

  // Build the ruff workspace config
  return {
    // top-level options
    'line-length': lineWidth,
    'indent-width': indentWidth,
    format: {
      'indent-style': indentStyle, // 'space' | 'tab'
      'quote-style': quoteStyle,   // 'single' | 'double'
    },
    // you can add lint config here too if desired:
    // lint: { select: ['E4', 'E7', 'E9', 'F'] }
  };
}

function optionsKey(config) {
  // Stable key to reuse the workspace when options are unchanged
  return JSON.stringify(config);
}

async function tryImportRuff(url) {
  const mod = await import(url);
  // Browser API typically exposes default init() and Workspace
  const init = typeof mod.default === 'function'
    ? mod.default
    : (typeof mod.init === 'function' ? mod.init : null);

  if (!init) {
    throw new Error('Ruff WASM module missing init() / default initializer');
  }
  await init();
  if (typeof mod.Workspace !== 'function') {
    throw new Error('Ruff WASM module missing Workspace class');
  }
  return mod;
}

async function loadFormatterModule() {
  if (!formatterModulePromise) {
    formatterModulePromise = (async () => {
      const urls = getCandidateUrls();
      let lastError;
      for (const url of urls) {
        try {
          return await tryImportRuff(url);
        } catch (err) {
          console.error('Failed to load Ruff formatter from', url, err);
          lastError = err;
        }
      }
      throw lastError || new Error('Unable to load Ruff formatter');
    })().catch((e) => {
      formatterModulePromise = null;
      throw e;
    });
  }
  return formatterModulePromise;
}

function getOrCreateWorkspace(mod, config) {
  const key = optionsKey(config);
  if (workspaceCache.workspace && workspaceCache.key === key) {
    return workspaceCache.workspace;
  }
  const ws = new mod.Workspace(config);
  workspaceCache = {key, workspace: ws};
  return ws;
}

function fallbackFormat(code) {
  if (typeof code !== 'string') return '';
  // Trim trailing whitespace on each line
  let out = code.replace(/[ \t]+$/gm, '');
  // Collapse 3+ blank lines to 2
  out = out.replace(/\n{3,}/g, '\n\n');
  // Remove trailing whitespace at EOF (incl. non-breaking space)
  out = out.replace(/[\s\u00A0]+$/u, '');
  // Ensure newline at EOF
  if (out && !out.endsWith('\n')) out += '\n';
  return out;
}

// --- Message handling --------------------------------------------------------

async function handleFormatRequest(event) {
  const {id, code, options} = event.data || {};
  if (!id) return;

  try {
    const mod = await loadFormatterModule();
    const config = normalizeOptions(options);
    const ws = getOrCreateWorkspace(mod, config);

    // Ruff’s browser API: synchronous .format(code) returning a string
    const formatted = ws.format(String(code ?? ''));
    globalScope.postMessage({type: 'format-result', id, result: formatted});
  } catch (error) {
    console.error('Formatting via Ruff failed', error);
    try {
      const formatted = fallbackFormat(code);
      globalScope.postMessage({
        type: 'format-result',
        id,
        result: formatted || String(code ?? ''),
      });
    } catch (fallbackError) {
      globalScope.postMessage({
        type: 'format-error',
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

globalScope.addEventListener('message', (event) => {
  const {type, id} = event.data || {};
  if (type === 'format' && id) {
    handleFormatRequest(event);
  }
});
