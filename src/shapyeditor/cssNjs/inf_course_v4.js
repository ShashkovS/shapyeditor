// Скрипты для курса

// File watchers
// npm install --g terser
// terser.cmd
// $FileName$ --compress passes=2 --mangle --ecma2018 -o $FileNameWithoutExtension$.min.js
// $FileNameWithoutExtension$.min.js
// $FileDir$


const toggle_spoiler = (ev) => {
  const cur = ev.target;
  cur.parentNode.classList.toggle('spoiler_open');
  const curdiv = cur.parentNode.getElementsByTagName('div')[0];
  if (curdiv.style.display === 'block') {
    curdiv.style.display = 'none';
  } else {
    curdiv.style.display = 'block';
  }
};

const translit = {
  "Ё": "YO",
  "Й": "I",
  "Ц": "TS",
  "У": "U",
  "К": "K",
  "Е": "E",
  "Н": "N",
  "Г": "G",
  "Ш": "SH",
  "Щ": "SCH",
  "З": "Z",
  "Х": "H",
  "Ъ": "",
  "ё": "yo",
  "й": "i",
  "ц": "ts",
  "у": "u",
  "к": "k",
  "е": "e",
  "н": "n",
  "г": "g",
  "ш": "sh",
  "щ": "sch",
  "з": "z",
  "х": "h",
  "ъ": "",
  "Ф": "F",
  "Ы": "I",
  "В": "V",
  "А": "a",
  "П": "P",
  "Р": "R",
  "О": "O",
  "Л": "L",
  "Д": "D",
  "Ж": "ZH",
  "Э": "E",
  "ф": "f",
  "ы": "i",
  "в": "v",
  "а": "a",
  "п": "p",
  "р": "r",
  "о": "o",
  "л": "l",
  "д": "d",
  "ж": "zh",
  "э": "e",
  "Я": "Ya",
  "Ч": "CH",
  "С": "S",
  "М": "M",
  "И": "I",
  "Т": "T",
  "Ь": "",
  "Б": "B",
  "Ю": "YU",
  "я": "ya",
  "ч": "ch",
  "с": "s",
  "м": "m",
  "и": "i",
  "т": "t",
  "ь": "",
  "б": "b",
  "ю": "yu"
};
const transliterate = (text) => {
  return text.split('').map(char => translit[char] || char).join("");
};

const headerToLink = (text) => {
  text = transliterate(text.replace(/^\s+/, '').replace(/\s+$/, ''));
  text = text.replace(/[^a-zA-Z0-9_]+/g, '_');
  return text;
};

const createContent = () => {
  let $elemToAddContent = document.getElementById("content");
  if (!$elemToAddContent) {
    return;
  }
  let $article = document.createElement('article');
  $article.className = "theory";
  $article.innerHTML = '<h2>Contents</h2>\n';
  $elemToAddContent.insertBefore($article, $elemToAddContent.firstChild);
  let html, contHtml, newHtml, $el, match, text, id;
  for ($el of document.querySelectorAll("h1, h2, h3")) {
    if ($el.classList.contains('contIgnore')) {
      continue;
    } else if ($el.offsetParent === null)  // Игнорируем невидимые (в спойлерах) элементы
    {
      continue;
    }
    if ($el.classList.contains('prob_name')) {
      // Задача
      html = $el.innerHTML;
      match = html.match(/(\W*)([a-zA-Z0-9\u{2605}*\u{00B0}]{1,4})(\s*[:.]?\s*)(.*$)/u); // id задачи  ★*°
      if (match !== null) {
        const taskId = match[2].replace(/[^a-zA-Z0-9_]/g, '');
        contHtml = '<a class="contProblem" href="#prob_' + taskId + '">' + taskId + ': ' + match[4] + '</a>;<br/>\n';
        newHtml = '<a id="prob_' + taskId + '" href="#prob_' + taskId + '">' + taskId + '</a>: ' + match[4];
        $el.innerHTML = newHtml;
        $article.insertAdjacentHTML("beforeEnd", contHtml);
      }
    } else {
      // Просто оглавление
      html = $el.innerHTML;
      html = html.replace(/<span class="danger">(.*?)<\/span>/, '$1');
      text = $el.innerText;
      id = headerToLink(text);
      contHtml = '<a class="contTheory" href="#' + id + '">' + html + '</a>;<br>\n';
      newHtml = '<a id="' + id + '" href="#' + id + '">#</a> ' + html;
      $el.innerHTML = newHtml;
      $article.insertAdjacentHTML("beforeEnd", contHtml);
    }
  }
};
const copyToClipboard = (ev) => {
  let $el = ev.target;
  // Ищем предка, у которого стоит data-атрибут copyit
  while ($el && $el.dataset.copyit !== '1') $el = $el.parentNode;
  if (!$el) return;
  const pixelWidth = parseFloat(getComputedStyle($el).fontSize);
  const coords = $el.getBoundingClientRect();
  if (ev.clientY < coords.top + pixelWidth * 1.2 + 10) { // см. стили .input:before
    const text = $el.innerText.replace(/^\n+/, '');
    navigator.clipboard.writeText(text)
      .then(() => {
        // Чтобы показать успех, заменим значок копирования на 300мс
        const $dv = document.createElement('div');
        $dv.style.position = 'fixed';
        $dv.style.left = parseInt((coords.left + coords.right) / 2 + pixelWidth * 1.7) + 'px';
        $dv.style.top = (coords.top - pixelWidth * 1.5) + 'px';
        $dv.style.color = 'green';
        $dv.innerText = '✔ copied';
        document.body.appendChild($dv);
        setTimeout(($dv) => document.body.removeChild($dv), 400, $dv);
      });
  }
};
const createInputOuputListeners = () => {
  for (const $el of document.querySelectorAll(".input, .output, .optionAns, .comment, .pyVS, .bashVS, .cppVS, .jsVS, .justblock, .sqlVS, .rustVS")) {
    $el.addEventListener("click", copyToClipboard);
    $el.dataset.copyit = '1';
  }
};

const updateSpoilers = () => {
  for (let spoilerClass of ['spoiler', 'spoiler2']) {
    for (let $el of document.getElementsByClassName(spoilerClass)) {
      let $spoiler_title = $el.firstChild;
      let $spanNode = document.createElement('span');
      $spanNode.setAttribute('class', spoilerClass + '_title');
      $spanNode.addEventListener("click", toggle_spoiler, false);
      if ($spoiler_title.wholeText !== undefined) {
        $spanNode.appendChild(document.createTextNode($spoiler_title.wholeText));
      } else {
        $spanNode.innerHTML = $spoiler_title.innerHTML;
      }
      $el.replaceChild($spanNode, $spoiler_title);

    }
  }
};
// Оглавление мы можем создать сразу благодаря тому, что модуль всегда выполняется после загрузки html'я
createContent();
// Спойлеры
updateSpoilers();
// Копирование по input/output
createInputOuputListeners();


// А вот теперь то, что зависит от внешних библиотек
const runSyntaxHighlighting = () => {
  for (let lang of ['python', 'cpp', 'tex', 'sql', 'js', 'rust', 'bash', 'pyVS', 'bashVS', 'cppVS', 'jsVS', 'sqlVS', 'rustVS']) {
    for (let $code of document.getElementsByClassName(lang)) {
      if (lang.endsWith('VS')) {
        lang = lang.slice(0, -2);
        if (lang === 'py') lang = 'python';
        if (lang === 'js') lang = 'javascript';
      }
      $code.innerHTML = hljs.highlight($code.innerText, {language: lang, ignoreIllegals: true}).value;
    }
  }
};
const onDOMContentLoaded = () => {
  // KaTeX
  renderMathInElement(document.body, {
    delimiters: [
      {left: "$$", right: "$$", display: true},
      {left: "\\[", right: "\\]", display: true},
      {left: "$", right: "$", display: false},
      {left: "\\(", right: "\\)", display: false}
    ]
  });
  // Подсветка синтаксиса
  runSyntaxHighlighting();
};
document.addEventListener("DOMContentLoaded", onDOMContentLoaded);


/**
 * A collection of Web Components for declarative data visualization.
 * This module defines custom elements that wrap popular JS visualization libraries,
 * enabling their use directly in HTML without manual script loading.
 *
 * Libraries are lazy-loaded from a CDN only when their respective
 * component is used on the page.
 *
 * Components defined:
 * - <svg-js-visualization> for SVG.js
 * - <chartist-js-chart> for Chartist.js
 * - <uplot-chart> for uPlot
 * - <mermaid-diagram> for Mermaid
 * - <d3-js-visualization> for d3.js
 */

// --- Centralized Lazy Loader for Libraries ---

class LibraryLoader {
  constructor() {
    this.promises = new Map();
  }

  load(name, url, type = 'script') {
    if (!this.promises.has(name)) {
      const promise = new Promise((resolve, reject) => {
        if (type === 'script') {
          import(url).then(resolve).catch(reject);
        } else if (type === 'style') {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          link.onload = () => resolve();
          link.onerror = () => reject(new Error(`Failed to load stylesheet: ${url}`));
          document.head.appendChild(link);
        }
      });
      this.promises.set(name, promise);
    }
    return this.promises.get(name);
  }
}

const loader = new LibraryLoader();

// --- 1. SVG.js Component ---

class SvgJsVisualization extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    const width = this.getAttribute('width') || '400px';
    const height = this.getAttribute('height') || '300px';
    const scriptContent = this.querySelector('script')?.textContent || '';
    this.shadowRoot.innerHTML = `<style>:host { display: block; }</style><div class="container"></div><slot name="caption"></slot>`;
    const container = this.shadowRoot.querySelector('.container');
    try {
      const { SVG } = await loader.load('svg.js', 'https://cdn.jsdelivr.net/npm/@svgdotjs/svg.js@3/+esm');
      const draw = SVG().addTo(container).size(width, height);
      new Function('draw', scriptContent)(draw);
    } catch (error) {
      container.textContent = `Error loading or executing svg.js script: ${error.message}`;
      console.error(error);
    }
  }
}

class ChartistJsChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    const type = this.getAttribute('type') || 'Line';
    const width = this.getAttribute('width') || '100%';
    const height = this.getAttribute('height') || '400px';

    const dataScript = this.querySelector('script[data-type="data"]');
    const optionsScript = this.querySelector('script[data-type="options"]');

    // FIX: Inject the <link> tag directly into the shadow DOM template.
    this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/chartist@1/dist/index.min.css">
            <style>
                :host { display: block; }
                .ct-chart { width: ${width}; height: ${height}; }
            </style>
            <slot name="title"></slot>
            <div class="ct-chart"></div>
            <slot name="caption"></slot>
        `;

    const container = this.shadowRoot.querySelector('.ct-chart');

    try {
      // No longer need to load CSS via the loader.
      const chartistModule = await loader.load(
        'chartist-js',
        'https://cdn.jsdelivr.net/npm/chartist@1/+esm'
      );

      const data = dataScript ? JSON.parse(dataScript.textContent) : {};
      const options = optionsScript
        ? new Function(`return (${optionsScript.textContent})`)()
        : {};

      const constructorName = type + 'Chart';
      const ChartConstructor = chartistModule[constructorName];

      if (typeof ChartConstructor !== 'function') {
        throw new Error(`Chartist chart type "${type}" (looked for "${constructorName}") not found.`);
      }

      new ChartConstructor(container, data, options);

    } catch (error) {
      container.textContent = `Error loading or creating Chartist chart: ${error.message}`;
      console.error(error);
    }
  }
}

class UplotChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    const width = this.getAttribute('width') || '800';
    const height = this.getAttribute('height') || '400';

    const dataScript = this.querySelector('script[data-type="data"]');
    const optionsScript = this.querySelector('script[data-type="options"]');

    // FIX: Inject the <link> tag directly into the shadow DOM template.
    this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/uplot@1/dist/uPlot.min.css">
            <style>:host { display: block; }</style>
            <slot name="title"></slot>
            <div class="uplot-container"></div>
            <slot name="caption"></slot>
        `;

    const container = this.shadowRoot.querySelector('.uplot-container');

    try {
      // No longer need to load CSS via the loader.
      const uPlot = (await loader.load(
        'uplot-js',
        'https://cdn.jsdelivr.net/npm/uplot@1/+esm'
      )).default;

      const data = dataScript ? JSON.parse(dataScript.textContent) : [];
      const baseOptions = optionsScript
        ? new Function(`return (${optionsScript.textContent})`)()
        : {};

      const finalOptions = {
        ...baseOptions,
        width: parseInt(width),
        height: parseInt(height)
      };

      new uPlot(finalOptions, data, container);
    } catch (error) {
      container.textContent = `Error creating uPlot chart: ${error.message}`;
      console.error(error);
    }
  }
}

// --- 4. Mermaid Component ---

class MermaidDiagram extends HTMLElement {
  constructor() {
    super();
    // DO NOT attach a shadow root. We will render directly into the component.
  }

  async connectedCallback() {
    const preElement = this.querySelector('pre');
    const diagramText = preElement ? preElement.textContent.trim() : '';

    // We will manage the component's direct inner HTML.
    // First, let's preserve the slots by moving them temporarily.
    const slots = Array.from(this.querySelectorAll('[slot]'));

    // Setup the inner structure directly in the Light DOM.
    this.innerHTML = `
            <style>
                /* These styles are now global, so we scope them to the component tag */
                mermaid-diagram {
                    display: block;
                    text-align: center;
                }
                mermaid-diagram .mermaid {
                    visibility: hidden; /* Hide until rendered */
                }
            </style>
            <div class="mermaid-container"></div>
        `;

    // Re-append slots
    const container = this.querySelector('.mermaid-container');
    slots.forEach(slot => container.appendChild(slot));

    // Create the div that Mermaid will target
    const mermaidDiv = document.createElement('div');
    mermaidDiv.className = 'mermaid';

    // 3. Set the fully sanitized string as the content for Mermaid.
    mermaidDiv.textContent = diagramText;
    container.appendChild(mermaidDiv);

    try {
      const mermaid = (await loader.load(
        'mermaid',
        'https://cdn.jsdelivr.net/npm/mermaid@11/+esm'
      )).default;

      mermaid.initialize({ startOnLoad: false, theme: 'default' });

      // The setTimeout is still a good practice to ensure the element is in the main DOM.
      setTimeout(async () => {
        try {
          // Let Mermaid find and render the element.
          // We don't need to pass nodes, it will find elements with class="mermaid".
          // However, to be specific, we can target our div.
          await mermaid.run({ nodes: [mermaidDiv] });
        } catch (renderError) {
          // For debugging, show the original source the user provided.
          const userProvidedCode = preElement ? preElement.textContent.trim() : 'Source not found.';
          mermaidDiv.innerHTML = `Error rendering Mermaid diagram: ${renderError.message}<br><br><b>Original Code:</b><pre style="text-align: left; display: inline-block;">${userProvidedCode}</pre>`;
          console.error(renderError);
        } finally {
          mermaidDiv.style.visibility = 'visible';
        }
      }, 0);

    } catch (initError) {
      mermaidDiv.textContent = `Error initializing Mermaid: ${initError.message}`;
      mermaidDiv.style.visibility = 'visible';
      console.error(initError);
    }
  }
}
// --- 5. d3.js Component ---

class D3JsVisualization extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    const width = this.getAttribute('width') || 600;
    const height = this.getAttribute('height') || 400;

    const dataScript = this.querySelector('script[data-type="data"]');
    const codeScript = this.querySelector('script:not([data-type])');

    this.shadowRoot.innerHTML = `<style>:host { display: block; }</style><slot name="title"></slot><div class="container"></div><slot name="caption"></slot>`;
    const container = this.shadowRoot.querySelector('.container');

    try {
      const d3 = await loader.load('d3', 'https://cdn.jsdelivr.net/npm/d3@7/+esm');
      const data = dataScript ? JSON.parse(dataScript.textContent) : null;
      const userCode = codeScript?.textContent || '';

      const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgElement.setAttribute('width', width);
      svgElement.setAttribute('height', height);
      container.appendChild(svgElement);
      const svg = d3.select(svgElement);

      new Function('d3', 'svg', 'data', userCode)(d3, svg, data);

    } catch (error) {
      container.textContent = `Error executing d3.js script: ${error.message}`;
      console.error(error);
    }
  }
}

// --- Register All Components ---

customElements.define('svg-js-visualization', SvgJsVisualization);
customElements.define('chartist-js-chart', ChartistJsChart);
customElements.define('uplot-chart', UplotChart);
customElements.define('mermaid-diagram', MermaidDiagram);
customElements.define('d3-js-visualization', D3JsVisualization);