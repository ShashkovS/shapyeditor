/**
 * Web Worker для исполнения Python-кода через Pyodide.
 */

const PYODIDE_VERSION = 'v0.28.2';
const PYODIDE_BASE_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

let usingSkulpt = false;

try {
  importScripts(`${PYODIDE_BASE_URL}pyodide.js`);
} catch (error) {
  usingSkulpt = true;
  console.warn('Failed to load Pyodide from CDN, falling back to Skulpt.', error);
  importScripts('../skulpt/skulpt.min.js', '../skulpt/skulpt-stdlib.js');
}

let pyodide = null;
let skulptConfigured = false;
let skulptWorkerData = null;
let printed = '';
let inputValue = null;
let inputLines = [];
let isInterrupted = false;
let interruptBuffer = null;
let supportsInterrupt = false;
let currentRunId = null;
let pendingStdout = '';
let sawRawStdout = false;
const preservedPyGlobals = [
  '__name__',
  '__doc__',
  '__package__',
  '__loader__',
  '__spec__',
  '__builtins__',
  '__annotations__',
  '_worker_data',
];
const preservedPyGlobalsPython = `{${preservedPyGlobals
  .map((name) => `\'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}\'`)
  .join(', ')}}`;

const installedPackages = new Set();

const normalizePackageList = (value) => {
  if (!value) {
    return [];
  }
  let candidates = [];
  if (Array.isArray(value)) {
    candidates = value
      .map((pkg) => (typeof pkg === 'string' ? pkg.trim() : ''))
      .filter((pkg) => pkg.length > 0);
  } else if (typeof value === 'string') {
    candidates = value
      .split(/[,\s]+/)
      .map((pkg) => pkg.trim())
      .filter((pkg) => pkg.length > 0);
  }
  return [...new Set(candidates)];
};

const installPackagesWithPyodide = async (packages) => {
  if (!packages || packages.length === 0) {
    return;
  }
  const target = packages.length === 1 ? packages[0] : packages;
  await pyodide.loadPackage(target);
};

const installPackagesWithMicropip = async (packages) => {
  if (!packages || packages.length === 0) {
    return;
  }
  await pyodide.loadPackage('micropip');
  const micropip = pyodide.pyimport('micropip');
  try {
    for (const pkg of packages) {
      await micropip.install(pkg);
    }
  } finally {
    if (typeof micropip.destroy === 'function') {
      micropip.destroy();
    }
  }
};

const ensurePackagesAvailable = async (packages, method = 'auto') => {
  if (!pyodide || usingSkulpt) {
    return;
  }
  const normalizedPackages = normalizePackageList(packages);
  const missingPackages = normalizedPackages.filter((pkg) => !installedPackages.has(pkg));
  if (missingPackages.length === 0) {
    return;
  }

  const methodKey = method === 'pip' ? 'micropip' : method;

  if (methodKey === 'micropip') {
    await installPackagesWithMicropip(missingPackages);
  } else if (methodKey === 'pyodide') {
    await installPackagesWithPyodide(missingPackages);
  } else {
    try {
      await installPackagesWithPyodide(missingPackages);
    } catch (pyodideError) {
      console.warn('Pyodide package load failed, falling back to micropip.', pyodideError);
      await installPackagesWithMicropip(missingPackages);
    }
  }

  for (const pkg of missingPackages) {
    installedPackages.add(pkg);
  }
};

const sanitizeErrorMessage = (message) => {
  console.error({message});
  if (!message) {
    return '';
  }
  const text = message.toString().trim();
  if (!text.includes('_pyodide')) {
    return text.trim();
  }
  const lines = text.split('\n');
  const cleanedLines = [];
  let skipIndentedBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*File "[^"]*_pyodide\//.test(line)) {
      skipIndentedBlock = true;
      continue;
    }
    if (skipIndentedBlock) {
      if (/^\s{2,}File /.test(line)) {
        skipIndentedBlock = false;
      } else {
        continue;
      }
    }
    cleanedLines.push(line);
  }

  return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const formatError = (error) => {
  if (!error) {
    return '';
  }
  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }
  if (error.message) {
    return sanitizeErrorMessage(error.message);
  }
  if (error.toString) {
    return sanitizeErrorMessage(error.toString());
  }
  try {
    return sanitizeErrorMessage(JSON.stringify(error));
  } catch (e) {
    return sanitizeErrorMessage('' + error);
  }
};

const pushOutputChunk = (chunk) => {
  if (!chunk) {
    return;
  }
  printed += chunk;
  if (currentRunId != null) {
    postMessage({
      result: 'output',
      value: {chunk},
      runId: currentRunId,
    });
  }
};

const handleRawOutput = (text) => {
  if (text == null) {
    return;
  }
  sawRawStdout = true;
  let chunk = text.toString();
  if (!chunk) {
    return;
  }
  chunk = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (pendingStdout) {
    chunk = pendingStdout + chunk;
    pendingStdout = '';
  }
  const parts = chunk.split('\n');
  pendingStdout = parts.pop();
  for (const part of parts) {
    pushOutputChunk(`${part}\n`);
  }
};

const handleBatchedOutput = (text) => {
  if (text == null || sawRawStdout) {
    return;
  }
  let chunk = text.toString();
  if (!chunk) {
    return;
  }
  if (!chunk.endsWith('\n')) {
    chunk += '\n';
  }
  pushOutputChunk(chunk);
};

const flushPendingStdout = () => {
  if (!pendingStdout) {
    return;
  }
  pushOutputChunk(pendingStdout);
  pendingStdout = '';
};

const resetPyodideGlobals = async () => {
  if (!pyodide) {
    return;
  }
  const resetCode = `import builtins\nglobals()['__builtins__'] = builtins\n_keep = ${preservedPyGlobalsPython}\nfor _key in list(globals().keys()):\n    if _key not in _keep:\n        del globals()[_key]\n`;
  await pyodide.runPythonAsync(resetCode);
};

const configureInput = (value) => {
  inputValue = value != null ? value : null;
  inputLines = inputValue != null ? value.split('\n') : [];
  if (!usingSkulpt && pyodide) {
    if (inputValue != null) {
      pyodide.setStdin({
        stdin: () => {
          if (inputLines.length === 0) {
            inputValue = null;
            return null;
          }
          const line = inputLines.shift();
          return `${line}\n`;
        },
      });
    } else {
      pyodide.setStdin({
        stdin: () => {
          return null;
        },
      });
    }
  }
};

const isNoInputError = (error) => {
  const msg = formatError(error);
  return msg.includes('noInputValue')
    || /EOFError/i.test(msg)
    || msg.includes('EOF when reading a line')
    || msg.includes('I/O error');
};

const isKeyboardInterrupt = (error) => {
  const msg = formatError(error);
  return msg.includes('KeyboardInterrupt');
};

const handleSkulptOutput = (text) => {
  if (text == null) {
    return;
  }
  pushOutputChunk(text.toString());
};

const skulptRead = (filename) => {
  if (!self.Sk || !Sk.builtinFiles || !Sk.builtinFiles.files[filename]) {
    throw new Error(`File not found: '${filename}'`);
  }
  return Sk.builtinFiles.files[filename];
};

const setupSkulpt = () => {
  if (!usingSkulpt || skulptConfigured || !self.Sk) {
    return;
  }
  Sk.configure({
    output: handleSkulptOutput,
    read: skulptRead,
    inputfun: () => {
      if (inputLines.length === 0) {
        inputValue = null;
        throw new Sk.builtin.EOFError('EOF when reading a line');
      }
      const line = inputLines.shift();
      return `${line}\n`;
    },
    inputfunTakesPrompt: false,
  });
  Sk.globals = Sk.globals || new Sk.builtin.dict([]);
  skulptConfigured = true;
};

const interpreterReadyPromise = (async () => {
  if (usingSkulpt) {
    try {
      setupSkulpt();
      interruptBuffer = null;
      supportsInterrupt = false;
      postMessage({
        result: 'workerReady',
        interruptBuffer: null,
      });
    } catch (error) {
      console.error('Failed to initialize Skulpt fallback', error);
      postMessage({
        result: 'workerFailed',
        error: formatError(error),
        interruptBuffer: null,
      });
      throw error;
    }
    return;
  }
  try {
    pyodide = await loadPyodide({indexURL: PYODIDE_BASE_URL});
    pyodide.setStdout({batched: handleBatchedOutput});
    pyodide.setStderr({batched: handleBatchedOutput});
    if (typeof SharedArrayBuffer !== 'undefined') {
      try {
        interruptBuffer = new Int32Array(new SharedArrayBuffer(4));
        pyodide.setInterruptBuffer(interruptBuffer);
        supportsInterrupt = true;
      } catch (interruptError) {
        interruptBuffer = null;
        supportsInterrupt = false;
        console.warn('SharedArrayBuffer is not available, interrupts may be limited.', interruptError);
      }
    } else {
      interruptBuffer = null;
      supportsInterrupt = false;
      console.warn('SharedArrayBuffer is not available, interrupts may be limited.');
    }
    postMessage({
      result: 'workerReady',
      interruptBuffer: interruptBuffer ? interruptBuffer.buffer : null,
    });
  } catch (error) {
    console.error('Failed to load Pyodide', error);
    postMessage({
      result: 'workerFailed',
      error: formatError(error),
      interruptBuffer: null,
    });
    throw error;
  }
})();

const configure = async (options = {}) => {
  try {
    await interpreterReadyPromise;
    printed = '';
    pendingStdout = '';
    sawRawStdout = false;
    const {
      inputValue: providedInput = null,
      dataForWorker = null,
      packages: requestedPackages = null,
      packageInstallMethod = 'auto',
    } = options;
    const packagesToInstall = normalizePackageList(requestedPackages);
    if (!usingSkulpt && pyodide && packagesToInstall.length > 0) {
      await ensurePackagesAvailable(packagesToInstall, packageInstallMethod);
    } else if (usingSkulpt && packagesToInstall.length > 0) {
      console.warn('Package installation is not supported when falling back to Skulpt.');
    }
    configureInput(providedInput);
    // Делаем данные доступными из Python-кода (и на всякий случай из JS).
    self.workerData = dataForWorker;
    if (usingSkulpt) {
      skulptWorkerData = dataForWorker;
      if (self.Sk && Sk.globals) {
        try {
          const targetDict = typeof Sk.globals.set === 'function' ? Sk.globals : Sk.globals['$d'];
          if (targetDict && typeof targetDict.set === 'function') {
            targetDict.set(new Sk.builtin.str('_worker_data'), Sk.ffi.remapToPy(dataForWorker ?? null));
          } else if (targetDict && typeof targetDict.mp$setitem === 'function') {
            targetDict.mp$setitem(new Sk.builtin.str('_worker_data'), Sk.ffi.remapToPy(dataForWorker ?? null));
          }
        } catch (setError) {
          console.warn('Failed to expose worker data in Skulpt', setError);
        }
      }
    } else if (pyodide) {
      pyodide.globals.set('_worker_data', dataForWorker ?? null);
    } else {
      postMessage({result: 'configureError'});
      return;
    }
    postMessage({result: 'configured'});
  } catch (error) {
    console.error('Worker configure error', error);
    postMessage({result: 'configureError', error: formatError(error)});
  }
};

const run = async (code, runId) => {
  try {
    await interpreterReadyPromise;
  } catch (error) {
    postMessage({
      result: 'error',
      value: {output: printed, errorText: formatError(error)},
      runId,
    });
    return;
  }
  if (!usingSkulpt && !pyodide) {
    postMessage({
      result: 'error',
      value: {output: '', errorText: 'Pyodide is not available'},
      runId,
    });
    return;
  }

  currentRunId = runId;
  isInterrupted = false;
  printed = '';
  pendingStdout = '';
  sawRawStdout = false;
  if (!usingSkulpt && supportsInterrupt && interruptBuffer) {
    Atomics.store(interruptBuffer, 0, 0);
  }

  try {
    if (usingSkulpt) {
      if (!self.Sk) {
        throw new Error('Skulpt is not available');
      }
      if (Sk.globals) {
        try {
          const targetDict = typeof Sk.globals.set === 'function' ? Sk.globals : Sk.globals['$d'];
          const value = Sk.ffi.remapToPy(skulptWorkerData ?? null);
          if (targetDict && typeof targetDict.set === 'function') {
            targetDict.set(new Sk.builtin.str('_worker_data'), value);
          } else if (targetDict && typeof targetDict.mp$setitem === 'function') {
            targetDict.mp$setitem(new Sk.builtin.str('_worker_data'), value);
          }
        } catch (assignError) {
          console.warn('Failed to update Skulpt worker data', assignError);
        }
      }
      await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, code, true));
      if (!isInterrupted) {
        postMessage({
          result: 'success',
          value: {output: printed},
          runId,
        });
      }
    } else {
      await resetPyodideGlobals();
      await pyodide.runPythonAsync(code);
      flushPendingStdout();
      if (!isInterrupted) {
        postMessage({
          result: 'success',
          value: {output: printed},
          runId,
        });
      }
    }
  } catch (error) {
    flushPendingStdout();
    const output = printed;
    if (isInterrupted || isKeyboardInterrupt(error)) {
      isInterrupted = true;
      postMessage({
        result: 'interrupted',
        value: {output},
        runId,
      });
    } else if (isNoInputError(error)) {
      postMessage({
        result: 'notEnoughInputData',
        value: {output},
        runId,
      });
    } else {
      postMessage({
        result: 'error',
        value: {output, errorText: formatError(error)},
        runId,
      });
    }
  } finally {
    if (!usingSkulpt && supportsInterrupt && interruptBuffer) {
      Atomics.store(interruptBuffer, 0, 0);
    }
    currentRunId = null;
  }
};

const interrupt = () => {
  isInterrupted = true;
  if (supportsInterrupt && interruptBuffer) {
    Atomics.store(interruptBuffer, 0, 2);
    Atomics.notify(interruptBuffer, 0);
  }
};

const getOutput = () => {
  flushPendingStdout();
  postMessage({
    result: 'getOutput',
    value: {output: printed},
    runId: currentRunId,
  });
};

addEventListener('message', (event) => {
  const {action, options, code, runId} = event.data || {};
  switch (action) {
    case 'configure':
      configure(options);
      break;
    case 'run':
      run(code, runId);
      break;
    case 'interrupt':
      interrupt();
      break;
    case 'getOutput':
      getOutput();
      break;
    default:
      break;
  }
});
