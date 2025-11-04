// python-formatter.js
const workerUrl = new URL('./ruffFormatterWorker.js', import.meta.url);

let formatterWorker = null;
let lastRequestId = 0;
const pendingRequests = new Map();

function terminateWorker() {
  if (formatterWorker) {
    formatterWorker.terminate();
    formatterWorker = null;
  }
  for (const { reject } of pendingRequests.values()) {
    reject(new Error('Formatter worker terminated'));
  }
  pendingRequests.clear();
}

function ensureWorker() {
  if (!formatterWorker) {
    formatterWorker = new Worker(workerUrl, { type: 'module' });

    formatterWorker.addEventListener('message', (event) => {
      const { type, id, result, error } = event.data || {};
      if (!id || !pendingRequests.has(id)) return;

      const { resolve, reject } = pendingRequests.get(id);
      pendingRequests.delete(id);

      if (type === 'format-result') {
        resolve(result);
      } else if (type === 'format-error') {
        reject(new Error(error || 'Formatting failed'));
      }
    });

    const handleWorkerError = (event) => {
      console.error('Formatter worker error', event);
      terminateWorker();
    };
    formatterWorker.addEventListener('error', handleWorkerError);
    formatterWorker.addEventListener('messageerror', handleWorkerError);
  }
  return formatterWorker;
}

/**
 * options example:
 * {
 *   lineWidth: 160,
 *   indentWidth: 4,
 *   indentStyle: 'space' | 'tab',
 *   quoteStyle: 'single' | 'double',
 * }
 */
export const pythonFormatter = (text, options = {
  lineWidth: 160,
  indentWidth: 4,
  indentStyle: 'space',
  quoteStyle: 'single',
}) => {
  const worker = ensureWorker();
  return new Promise((resolve, reject) => {
    const id = ++lastRequestId;
    pendingRequests.set(id, { resolve, reject });
    try {
      worker.postMessage({ type: 'format', id, code: text, options });
    } catch (error) {
      pendingRequests.delete(id);
      reject(error);
    }
  });
};

export const destroyPythonFormatter = () => terminateWorker();
