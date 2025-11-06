const pyWorkerUrl = new URL('./pyodide-worker.js', import.meta.url).pathname;

export class workerObj {
  constructor() {
    this.worker = null;
    this.workerReady = false;
    this.waitUntilReady = Promise.resolve(false);
    this.waitUntilReadyResolver = null;
    this.waitUntilReadyTimeout = null;
    this.configureResolver = null;
    this.configureTimeout = null;
    this.pendingRuns = new Map();
    this.lastRunId = 0;
    this.interruptBuffer = null;
    this.activeRunId = null;
    this.runOutputs = new Map();
    this.currentOutput = '';
    this.runTerminationWaitMs = 500;
  }

  /**
   * Общий обработчик сообщений от воркера. Фан-аут по типу сообщения.
   */
  handleWorkerMessage = (event) => {
    const data = event.data || {};
    const {result} = data;
    switch (result) {
      case 'workerReady':
        this.workerReady = true;
        if (this.waitUntilReadyTimeout) {
          clearTimeout(this.waitUntilReadyTimeout);
          this.waitUntilReadyTimeout = null;
        }
        if (data.interruptBuffer) {
          try {
            this.interruptBuffer = new Int32Array(data.interruptBuffer);
          } catch (err) {
            console.warn('Unable to use interrupt buffer', err);
            this.interruptBuffer = null;
          }
        } else {
          this.interruptBuffer = null;
        }
        this.activeRunId = null;
        this.runOutputs.clear();
        this.currentOutput = '';
        if (this.waitUntilReadyResolver) {
          this.waitUntilReadyResolver(true);
          this.waitUntilReadyResolver = null;
        }
        break;
      case 'workerFailed':
        this.workerReady = false;
        if (this.waitUntilReadyTimeout) {
          clearTimeout(this.waitUntilReadyTimeout);
          this.waitUntilReadyTimeout = null;
        }
        this.interruptBuffer = null;
        if (data.error) {
          console.error('Worker failed to start', data.error);
        }
        if (this.waitUntilReadyResolver) {
          this.waitUntilReadyResolver(false);
          this.waitUntilReadyResolver = null;
        }
        this.activeRunId = null;
        this.runOutputs.clear();
        this.currentOutput = '';
        break;
      case 'configured': {
        if (this.configureTimeout) {
          clearTimeout(this.configureTimeout);
          this.configureTimeout = null;
        }
        if (this.configureResolver) {
          const resolver = this.configureResolver;
          this.configureResolver = null;
          resolver(true);
        }
        break;
      }
      case 'configureError': {
        if (this.configureTimeout) {
          clearTimeout(this.configureTimeout);
          this.configureTimeout = null;
        }
        if (this.configureResolver) {
          const resolver = this.configureResolver;
          this.configureResolver = null;
          resolver(false);
        }
        break;
      }
      case 'output':
      case 'getOutput': {
        const targetRunId = data.runId ?? this.activeRunId;
        const value = data.value || {};
        const chunk = typeof value.chunk === 'string' ? value.chunk : '';
        const reportedOutput = typeof value.output === 'string' ? value.output : null;
        const previousOutput = (targetRunId != null ? this.runOutputs.get(targetRunId) : undefined) ?? this.currentOutput ?? '';
        let nextOutput = previousOutput;
        if (reportedOutput != null) {
          nextOutput = reportedOutput;
        } else if (chunk) {
          nextOutput += chunk;
        }
        if (targetRunId != null) {
          this.runOutputs.set(targetRunId, nextOutput);
        }
        if (targetRunId == null || targetRunId === this.activeRunId) {
          this.currentOutput = nextOutput;
        }
        break;
      }
      case 'success':
      case 'error':
      case 'notEnoughInputData':
      case 'interrupted': {
        const {runId} = data;
        if (typeof data.value?.output === 'string') {
          this.currentOutput = data.value.output;
        }
        if (this.activeRunId === runId) {
          this.activeRunId = null;
        }
        this.runOutputs.delete(runId);
        const runState = this.pendingRuns.get(runId);
        if (runState) {
          if (runState.timeoutId) {
            clearTimeout(runState.timeoutId);
            runState.timeoutId = null;
          }
          if (!runState.completed) {
            runState.completed = true;
            runState.resolve(data);
          }
          if (runState.completionResolver) {
            runState.completionResolver(data);
            runState.completionResolver = null;
          }
          this.pendingRuns.delete(runId);
        }
        break;
      }
      default:
        break;
    }
  };

  /**
   * Если worker ещё не готов, то создаём его и ждём подтверждения готовности.
   */
  init = (timeout = 10000) => {
    if (!this.worker) {
      this.workerReady = false;
      this.worker = new Worker(pyWorkerUrl, {type: 'classic'});
      this.worker.onmessage = this.handleWorkerMessage;
      this.waitUntilReady = new Promise((resolve) => {
        this.waitUntilReadyResolver = resolve;
      });
      this.waitUntilReadyTimeout = setTimeout(() => {
        if (this.waitUntilReadyResolver) {
          this.waitUntilReadyResolver(false);
          this.waitUntilReadyResolver = null;
        }
      }, timeout);
    }
  };

  /**
   * Отправить запрос worker'у на конфигурацию.
   * Если воркер не ответил за указанное время, считаем, что всё плохо.
   */
  configure = (options, timeout = 500) => {
    if (!this.worker) {
      return {error: 'workerKilled'};
    }
    if (this.configureResolver) {
      // предыдущая конфигурация ещё не завершилась
      return Promise.resolve(false);
    }
    const packages = options?.packages;
    let hasInstallRequests = false;
    if (Array.isArray(packages)) {
      hasInstallRequests = packages.length > 0;
    } else if (typeof packages === 'string') {
      hasInstallRequests = packages.trim().length > 0;
    }
    const effectiveTimeout = hasInstallRequests ? Math.max(timeout, 30000) : timeout;
    this.worker.postMessage({action: 'configure', options});
    return new Promise((resolve) => {
      this.configureResolver = resolve;
      this.configureTimeout = setTimeout(() => {
        if (this.configureResolver) {
          this.configureResolver = null;
          resolve(false);
        }
        this.configureTimeout = null;
      }, effectiveTimeout);
    });
  };

  /**
   * Запуск кода в воркере
   * @param {string} code - код
   * @param {number} [timeout = 1000] - макс. время выполнения кода (ms)
   */
  run = (code, timeout) => {
    const DEFAULT_TIMEOUT = 1000;

    if (!this.worker) {
      return {error: 'workerKilled'};
    }

    const runId = ++this.lastRunId;
    this.activeRunId = runId;
    this.runOutputs.set(runId, '');
    this.currentOutput = '';

    let runState = null;
    const runPromise = new Promise((resolve) => {
      const timeoutMs = timeout || DEFAULT_TIMEOUT;
      runState = {
        resolve,
        timeoutId: null,
        completed: false,
        runId,
        completionResolver: null,
        completionPromise: null,
        timedOut: false,
      };
      runState.completionPromise = new Promise((completionResolve) => {
        runState.completionResolver = completionResolve;
      });
      runState.timeoutId = setTimeout(() => {
        if (!runState || runState.completed) {
          return;
        }
        runState.completed = true;
        runState.timedOut = true;
        const snapshot = this.runOutputs.get(runId);
        if (typeof snapshot === 'string') {
          this.currentOutput = snapshot;
        }
        resolve({result: 'timeout', runId});
      }, timeoutMs);

      this.pendingRuns.set(runId, runState);
    });

    this.worker.postMessage({action: 'run', code, runId});

    return runPromise;
  };

  waitForRunCompletion = (runId, timeoutMs = this.runTerminationWaitMs) => {
    const runState = this.pendingRuns.get(runId);
    if (!runState || !runState.completionPromise) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      let finished = false;
      let timeoutHandle = null;
      const complete = () => {
        if (finished) {
          return;
        }
        finished = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        resolve(true);
      };
      runState.completionPromise.then(complete).catch(complete);
      if (typeof timeoutMs === 'number' && timeoutMs >= 0) {
        timeoutHandle = setTimeout(() => {
          if (finished) {
            return;
          }
          finished = true;
          resolve(false);
        }, timeoutMs);
      }
    });
  };

  /**
   * Получить текущий output в worker'е.
   * Бывает полезно, если программа ещё не завершилась или упала
   * @returns {Promise<string>}
   */
  getOutput = () => {
    if (this.activeRunId != null && this.runOutputs.has(this.activeRunId)) {
      return Promise.resolve(this.runOutputs.get(this.activeRunId));
    }
    return Promise.resolve(this.currentOutput);
  };

  kill = () => {
    if (this.worker) {
      this.workerReady = false;
      this.worker.terminate();
      this.worker = null;
      this.interruptBuffer = null;
      if (this.waitUntilReadyResolver) {
        this.waitUntilReadyResolver(false);
        this.waitUntilReadyResolver = null;
      }
      if (this.waitUntilReadyTimeout) {
        clearTimeout(this.waitUntilReadyTimeout);
        this.waitUntilReadyTimeout = null;
      }
      if (this.configureResolver) {
        this.configureResolver(false);
        this.configureResolver = null;
      }
      for (const [runId, runState] of this.pendingRuns.entries()) {
        const snapshot = this.runOutputs.get(runId);
        const output = typeof snapshot === 'string' ? snapshot : (this.currentOutput || '');
        if (runState.timeoutId) {
          clearTimeout(runState.timeoutId);
          runState.timeoutId = null;
        }
        if (!runState.completed) {
          runState.completed = true;
          runState.resolve({result: 'interrupted', value: {output}, runId});
        }
        if (runState.completionResolver) {
          runState.completionResolver({result: 'interrupted', value: {output}, runId});
          runState.completionResolver = null;
        }
        this.currentOutput = output;
      }
      this.pendingRuns.clear();
      this.runOutputs.clear();
      this.activeRunId = null;
      this.waitUntilReady = Promise.resolve(false);
    }
  };

  interrupt = () => {
    if (this.worker) {
      if (this.interruptBuffer) {
        try {
          Atomics.store(this.interruptBuffer, 0, 2);
          Atomics.notify(this.interruptBuffer, 0);
        } catch (err) {
          console.warn('Failed to use interrupt buffer', err);
          this.interruptBuffer = null;
        }
      }
      this.worker.postMessage({action: 'interrupt'});
      if (!this.interruptBuffer && this.activeRunId != null) {
        this.kill();
      }
    }
  };

  /**
   * Убедиться в готовности воркера, настроить ему окружение, запустить код с фиксированным таймаутом,
   * дождаться окончания, вернуть ответ
   * @param interpreterConfig — настройки для интерпретатора
   * @param code — код (см. метод run)
   * @param timeout — таймаут (см. метод run)
   * @returns {{result: ...}}
   */
  runCode = async (interpreterConfig, code, timeout) => {
    let configured = false;
    // Мы даём несколько попыток воркеру прийти в состояние, когда он отвечает на запрос «Настройся».
    for (let resets = 0; resets < 3; resets++) {
      this.init();
      const workerIsReady = await this.waitUntilReady;
      if (!workerIsReady) {
        this.kill();
        continue;
      }
      // В этом месте worker совершенно точно инициирован. Но, возможно, он там занимается
      // какими-то своими делами (сволочь). Мы ему шлём сообщение «Настройся» и ждём ответа 1 секунду
      // Если он за секунду не ответил, то придётся его убить и начать с начала
      configured = await this.configure(interpreterConfig);
      if (!configured) {
        this.kill();
      } else {
        break;
      }
    }
    if (!configured) {
      return {
        result: 'error',
        value: {output: this.currentOutput, errorText: 'Failed to initialize Python environment'},
      };
    }
    // В этом месте worker совершенно точно настроен и готов работать.
    const result = await this.run(code, timeout);
    // Если таймаут, то шлём воркеру сообщение, что дальше можно ничего не делать
    if (result.result === 'timeout') {
      const runId = result.runId;
      const snapshot = this.runOutputs.get(runId);
      if (typeof snapshot === 'string') {
        this.currentOutput = snapshot;
      }
      this.interrupt();
      const finishedGracefully = await this.waitForRunCompletion(runId);
      if (!finishedGracefully) {
        this.kill();
      }
    }
    return result;
  };
}
