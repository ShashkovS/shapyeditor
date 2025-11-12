let pythonIDE = null;
let pythonIDELoadPromise = null;

function loadPythonIDE() {
  if (pythonIDE !== null) {
    return Promise.resolve(pythonIDE);
  }
  if (!pythonIDELoadPromise) {
    pythonIDELoadPromise = import('./pyideCore.js')
      .then((pyideCore) => {
        pythonIDE = pyideCore.pythonIDE;
        return pythonIDE;
      })
      .catch((err) => {
        pythonIDELoadPromise = null;
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(err);
        } else if (typeof alert === 'function') {
          alert(err);
        } else {
          console.error(err);
        }
        throw err;
      });
  }
  return pythonIDELoadPromise;
}

function createIDEhere($container, $examples, probName, installConfig = null, initialCode = '') {
  if (pythonIDE === null) {
    return loadPythonIDE().then((PythonIDE) => new PythonIDE($container, $examples, probName, installConfig, initialCode));
  }
  return new pythonIDE($container, $examples, probName, installConfig, initialCode);
}

class WebIdeElement extends HTMLElement {
  static _idCounter = 0;

  static _nextId() {
    WebIdeElement._idCounter += 1;
    return WebIdeElement._idCounter;
  }

  constructor() {
    super();
    this._isOpen = false;
    this._ideInitialized = false;
    this._label = null;
    this._toggleButton = null;
    this._content = null;
    this._hasSetup = false;
    this._installConfig = null;
    this._initialCode = '';
    this._storageKey = '';
    this._IDE = null;
    this._ideInitPromise = null;
    window.shapyide = this;
  }

  connectedCallback() {
    if (this._hasSetup) {
      return;
    }
    this._hasSetup = true;

    this._initialCode = this._extractInitialCode();
    const initialContent = this.textContent?.trim();
    const labelAttribute = this.getAttribute('label') || this.getAttribute('title');
    const hasInitialCode = this._initialCode.length > 0;
    const fallbackLabel = !hasInitialCode && initialContent ? initialContent : '';
    this._label = labelAttribute && labelAttribute.length > 0
      ? labelAttribute
      : (fallbackLabel && fallbackLabel.length > 0 ? fallbackLabel : 'IDE');

    this._storageKey = this._computeStorageKey();

    this.classList.add('web-ide');
    this.textContent = '';

    this._toggleButton = document.createElement('span');
    this._toggleButton.className = 'spoiler_title web-ide__toggle';
    this._toggleButton.setAttribute('role', 'button');
    this._toggleButton.setAttribute('tabindex', '0');
    this._toggleButton.setAttribute('aria-expanded', 'false');

    this._content = document.createElement('div');
    this._content.className = 'web-ide__content';
    this._content.style.display = 'none';

    this.appendChild(this._toggleButton);
    this.appendChild(this._content);

    this._toggleButton.addEventListener('click', () => this._toggle());
    this._toggleButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this._toggle();
      }
    });
    this._installConfig = this._extractInstallConfig();
    this._updateToggleButton();
  }

  _toggle() {
    this._isOpen = !this._isOpen;
    this._content.style.display = this._isOpen ? '' : 'none';
    this._toggleButton.setAttribute('aria-expanded', this._isOpen ? 'true' : 'false');
    this.classList.toggle('web-ide--open', this._isOpen);

    if (this._isOpen && !this._ideInitialized) {
      if (this._ideInitPromise) {
        this._updateToggleButton();
        return this._ideInitPromise;
      }
      const hostSection = this._findHostSection();
      const examples = hostSection ? hostSection.getElementsByClassName('example') : [];
      const createdIDE = createIDEhere(this._content, examples, this._storageKey, this._installConfig, this._initialCode);
      if (createdIDE && typeof createdIDE.then === 'function') {
        this._ideInitPromise = createdIDE
          .then((ideInstance) => {
            this._IDE = ideInstance;
            this._ideInitialized = true;
            return ideInstance;
          })
          .catch((err) => {
            this._ideInitPromise = null;
            throw err;
          });
      } else {
        this._IDE = createdIDE || null;
        this._ideInitialized = this._IDE !== null;
        this._ideInitPromise = Promise.resolve(this._IDE);
      }
      this._updateToggleButton();
      return this._ideInitPromise;
    }

    this._updateToggleButton();
    return this._IDE;
  }

  _findHostSection() {
    return this.closest('.problem')
      || this.closest('.theory')
      || this.closest('article')
      || this.parentElement
      || this;
  }

  _computeStorageKey() {
    const problemSection = this.closest('.problem') || this.closest('.probNav');
    if (problemSection) {
      const probNameNode = problemSection.getElementsByClassName('prob_name')[0];
      const probName = probNameNode?.innerText?.trim();
      if (probName) {
        return probName;
      }
    }

    const suffix = WebIdeElement._nextId();

    const theorySection = this.closest('.theory');
    if (theorySection) {
      const heading = theorySection.querySelector('h1, h2, h3, h4, h5, h6');
      const headingText = heading?.textContent?.trim();
      if (headingText) {
        return `${headingText}__${suffix}`;
      }
    }

    const label = this._label?.trim();
    if (label) {
      return `${label}__${suffix}`;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const probId = urlParams.get('prob_id');
    if (probId) {
      `web-ide-${probId}-${suffix}`;
    }

    return `web-ide-${suffix}`;
  }

  _extractInstallConfig() {
    const attributeConfigs = [
      {name: 'micropip', method: 'micropip'},
      {name: 'pip', method: 'micropip'},
      {name: 'install', method: 'auto'},
    ];

    for (const {name, method} of attributeConfigs) {
      if (!this.hasAttribute(name)) {
        continue;
      }
      const rawValue = this.getAttribute(name);
      const normalizedValue = typeof rawValue === 'string' ? rawValue : '';
      const packages = normalizedValue
        .split(/[,\s]+/)
        .map((pkg) => pkg.trim())
        .filter((pkg) => pkg.length > 0);
      const uniquePackages = [...new Set(packages)];
      if (uniquePackages.length === 0) {
        continue;
      }
      return {packages: uniquePackages, method};
    }

    return null;
  }

  _extractInitialCode() {
    const attributeCode = this.getAttribute('code') || this.getAttribute('initial-code');
    if (typeof attributeCode === 'string' && attributeCode.trim().length > 0) {
      return attributeCode.replace(/\r\n?/g, '\n');
    }
    const rawContent = this.textContent;
    if (typeof rawContent !== 'string') {
      return '';
    }
    if (!rawContent.includes('\n')) {
      return '';
    }
    const normalized = rawContent.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    if (lines.length === 0) {
      return '';
    }
    let minIndent = null;
    for (const line of lines) {
      if (line.trim() === '') {
        continue;
      }
      const match = line.match(/^[ \t]*/);
      const indentLength = match ? match[0].length : 0;
      if (minIndent === null || indentLength < minIndent) {
        minIndent = indentLength;
      }
    }
    if (!minIndent) {
      return lines.join('\n');
    }
    return lines.map((line) => line.slice(Math.min(minIndent, line.length))).join('\n');
  }

  _updateToggleButton() {
    const icon = this._isOpen ? '▲' : '▼';
    this._toggleButton.textContent = `${this._label} ${icon}`;
  }
}

customElements.define('web-ide', WebIdeElement);
