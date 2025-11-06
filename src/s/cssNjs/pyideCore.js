import {pythonFormatter} from './python-formatter.js';
import {initAceEditors} from '../aceMods/init-ace-ide.js';
import {workerObj} from '../pyodideMods/pyodide-worker-manager.js';
import {translateError} from '../aceMods/errors-translator.js';
import {
  getAssetsBaseUrl,
  normalizeAssetsBaseUrl,
  resolveAssetUrlFrom,
} from './asset-path.js';

const allIDEs = [];

const translit = {
  "Ё": "YO", "Й": "I", "Ц": "TS", "У": "U", "К": "K", "Е": "E", "Н": "N", "Г": "G", "Ш": "SH", "Щ": "SCH", "З": "Z", "Х": "H", "Ъ": "", "ё": "yo", "й": "i",
  "ц": "ts", "у": "u", "к": "k", "е": "e", "н": "n", "г": "g", "ш": "sh", "щ": "sch", "з": "z", "х": "h", "ъ": "", "Ф": "F", "Ы": "I", "В": "V", "А": "a",
  "П": "P", "Р": "R", "О": "O", "Л": "L", "Д": "D", "Ж": "ZH", "Э": "E", "ф": "f", "ы": "i", "в": "v", "а": "a", "п": "p", "р": "r", "о": "o", "л": "l",
  "д": "d", "ж": "zh", "э": "e", "Я": "Ya", "Ч": "CH", "С": "S", "М": "M", "И": "I", "Т": "T", "Ь": "", "Б": "B", "Ю": "YU", "я": "ya", "ч": "ch", "с": "s",
  "м": "m", "и": "i", "т": "t", "ь": "", "б": "b", "ю": "yu",
};
const transliterate = (text) => {
  return text.split('').map(char => translit[char] || char).join("");
};

const tracerStart = "import tokenize\n" +
  "from collections import namedtuple\n" +
  "\n" +
  "Token = namedtuple('Token', ['type', 'string', 'start', 'end', 'line'])\n" +
  "if not hasattr(tokenize, 'generate_tokens'):\n" +
  "    tokenize.generate_tokens = tokenize.tokenize\n" +
  "\n" +
  "\n" +
  "def wrapper(code: str):\n" +
  "    codelines = code.splitlines()[::-1]\n" +
  "\n" +
  "    def readline(save=codelines):\n" +
  "        return save.pop() if save else ''\n" +
  "\n" +
  "    return readline\n" +
  "\n" +
  "\n" +
  "def for_debug(code: str):\n" +
  "    while code.find('\\n\\n') != -1:\n" +
  "        code = code.replace('\\n\\n', '\\n#\\n')\n" +
  "    if len(code) == 0:\n" +
  "        return code\n" +
  "    code_lines = code.splitlines()\n" +
  "    not_with_change, list_change, need_after = ['==', '<=', '>=', '!='], ['append', 'clear', 'insert', 'remove',\n" +
  "                                                                          'reverse', 'sort'], ['else', 'elif', 'def',\n" +
  "                                                                                               'except', 'finally']\n" +
  "    a1 = [Token(*tokens) for tokens in tokenize.generate_tokens(wrapper(code))]\n" +
  "    if a1[0].string == 'UTF-8':\n" +
  "        a1.pop(0)\n" +
  "    a1.pop()\n" +
  "    a = [[a1[0]]]\n" +
  "    for q in range(1, len(a1)):\n" +
  "        if a1[q - 1].start[0] != a1[q].start[0]:\n" +
  "            a.append([a1[q]])\n" +
  "        else:\n" +
  "            a[-1].append(a1[q])\n" +
  "    new_code = []\n" +
  "    for q in range(len(a)):\n" +
  "        probels, names = \"\", set()\n" +
  "        while len(a[q]) > 0 and (a[q][0].type == 5 or a[q][0].type == 6):\n" +
  "            a[q].pop(0)\n" +
  "        if len(a[q]) == 0:\n" +
  "            continue\n" +
  "        while len(probels) < len(code_lines[q]) and code_lines[q][len(probels)].isspace():\n" +
  "            probels += code_lines[q][len(probels)]\n" +
  "        add_line = f'{q + 1}.'.ljust(5) + f' {code_lines[q]}'.ljust(50) + '       '\n" +
  "        if a[q][0].string not in need_after:\n" +
  "            new_code.append(probels + f'print(\"\"\"{add_line}\"\"\", end=\\'\\')')\n" +
  "            new_code.append(code_lines[q])\n" +
  "        else:\n" +
  "            new_code.append(code_lines[q])\n" +
  "            new_code.append(probels + f'    print(\"\"\"{add_line}\"\"\", end=\\'\\')')\n" +
  "        if len(a[q]) >= 3 and a[q][0].type == 1 and a[q][1].string == '.' and a[q][2].string in list_change:\n" +
  "            names = {a[q][0].string}\n" +
  "        else:\n" +
  "            block = [[]]\n" +
  "            for q1 in a[q]:\n" +
  "                block[-1].append(q1)\n" +
  "                if q1.string.find('=') != -1 and q1.string not in not_with_change:\n" +
  "                    block.append([])\n" +
  "            names = set()\n" +
  "            for q1 in range(len(block) - 1):\n" +
  "                for q2 in block[q1]:\n" +
  "                    if q2.type == 1:\n" +
  "                        names.add(q2.string)\n" +
  "            if len(block) <= 1:\n" +
  "                names = set()\n" +
  "        if len(names) > 0:\n" +
  "            add_line_result = 'print('\n" +
  "            for q1 in names:\n" +
  "                add_line_result += \"'\" + q1 + \" = ', \" + q1 + \", ', ', \"\n" +
  "            add_line_result = add_line_result[:-6] + \"sep='', end='')\"\n" +
  "            new_code.append(probels + add_line_result)\n" +
  "        if a[q][0].string not in need_after:\n" +
  "            new_code.append(probels + \"print()\")\n" +
  "            if len(names) == 0:\n" +
  "                new_code[-2], new_code[-1] = new_code[-1], new_code[-2]\n" +
  "        else:\n" +
  "            new_code.append(probels + \"    print()\")\n" +
  "    return '\\n'.join(new_code)\n" +
  "\n" +
  "\n" +
  "code = '''"
let tracerEnd = "'''\nprint(for_debug(code))\n"

function throttle(func, ms) {
  let isThrottled = false, savedArgs, savedThis;

  function wrapper() {
    if (isThrottled) {
      savedArgs = arguments;
      savedThis = this;
      return;
    }
    func.apply(this, arguments);
    isThrottled = true;
    setTimeout(() => {
      isThrottled = false;
      if (savedArgs) {
        wrapper.apply(savedThis, savedArgs);
        savedArgs = savedThis = null;
      }
    }, ms);
  }

  return wrapper;
}

function deleteTest($testLink) {
  $testLink.remove();
}

// глобальная т.к. addEventListener не позволяет изменять в функции элементы класса
let traceInput = '';

const normalizeInstallConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return null;
  }
  const packages = Array.isArray(config.packages)
    ? config.packages.map((pkg) => (typeof pkg === 'string' ? pkg.trim() : '')).filter((pkg) => pkg.length > 0)
    : [];
  const uniquePackages = [...new Set(packages)];
  if (uniquePackages.length === 0) {
    return null;
  }
  const normalizedMethod = config.method === 'pip' ? 'micropip' : config.method;
  const allowedMethods = new Set(['auto', 'micropip', 'pyodide']);
  const method = allowedMethods.has(normalizedMethod) ? normalizedMethod : 'auto';
  return {packages: uniquePackages, method};
};

export class pythonIDE {
  constructor(
    $parentElm,
    $examples = [],
    problemName = '',
    installConfig = null,
    initialCode = '',
    assetsBaseUrl = null
  ) {
    // Сохраняем ссылку на предка, в котором живём
    this.$parentElm = $parentElm;
    this.installConfig = normalizeInstallConfig(installConfig);
    this.initialCode = typeof initialCode === 'string' ? initialCode : '';
    this.assetsBaseUrl = normalizeAssetsBaseUrl(
      assetsBaseUrl != null ? assetsBaseUrl : getAssetsBaseUrl()
    );
    this.resolveAssetUrl = (relativePath) => resolveAssetUrlFrom(this.assetsBaseUrl, relativePath);
    // Если всё уже загружено, то ничего не делаем
    if (this.is_ready()) {
      return;
    }

    // this.$examplesArray = [...($examples || [])];
    this.$examplesArray = [];
    this.keyNameForLocalStorage = transliterate(problemName.toLowerCase().replace(/[^\wа-яё]/g, ''));
    // Сохраняем ссылку на блок, в котором находится вся задача
    this.$parentOfAll = $parentElm.closest('.problem')
      || $parentElm.closest('.theory')
      || $parentElm.closest('article')
      || $parentElm.parentElement
      || $parentElm;
    // Список дефолтных тестов
    this.$defaultExamples = this.$parentOfAll
      ? this.$parentOfAll.getElementsByClassName('example')
      : [];
    // последний из них
    this.$lastDefaultExample = this.$defaultExamples.length > 0
      ? this.$defaultExamples[this.$defaultExamples.length - 1]
      : null;
    // footer код
    this.footerCode = this.$parentOfAll
      ? this.$parentOfAll.querySelector('.pyfooter')?.innerText || ''
      : '';
    // Список вручную добавленных тестов
    this.ownTests = [];
    this.isFormatting = false;
    this.workerObj = new workerObj({assetsBaseUrl: this.assetsBaseUrl});
    // Удаляем всё к чертям, если в предыдущий раз что-то пошло не так или там есть какая-то треш-разметка
    this.deleteAllChildren();
    // Создаём редактор
    this.createAceEditor();
    // Добавляем кнопки и штуки для вывода
    this.createButtons();
    this.createInfoElements();
    // Помечаем, что всё готово (будет полезно, когда появится какая-либо асинхронная загрузка)
    this.workerObj.init();
    // Восстанавливаем код и тесты из localStorage
    this.restoreCodeFromLocalStorage();
    this.restoreTestsFromLocalStorage();
    // Входные данные для trace'а
    // Всё, типа готово
    this.set_ready();
    // Сохраняем IDE в массивчик для отладочных целей
    allIDEs.push(this);
    if (typeof window !== 'undefined') {
      window.__lastPythonIDE = this;
    }
    this.aceEditor.commands.addCommand({
      name: "runTests",
      bindKey: {
        win: "Ctrl-F10",
        mac: "Command-F10"
      },
      exec: this.runOnAllTests,
      readOnly: true
    });
  }

  is_ready() {
    return this.$parentElm && this.$parentElm.dataset && this.$parentElm.dataset.loaded;
  }

  set_ready() {
    this.$parentElm.dataset.loaded = true;
  }

  deleteAllChildren() {
    for (let $elm of this.$parentElm.children) {
      if ($elm.className !== 'loader') this.$parentElm.removeChild($elm);
    }
  }

  createAceEditor() {
    // Редактор
    const $commandsElm = document.createElement('div');
    $commandsElm.classList.add("pythonEditor");
    this.$parentElm.appendChild($commandsElm);
    this.aceEditor = initAceEditors($commandsElm, undefined, {assetsBaseUrl: this.assetsBaseUrl});
    this.aceEditor.setValue('\n\n', 1);
    this.aceEditor.moveCursorTo(0, 0);
    this.UndoManager = this.aceEditor.session.getUndoManager();
    this.aceEditor.on("change", this.onCodeInEditorChange);
  }

  onCodeInEditorChange = () => {
    this.aceEditor.removeAllMarkerLines();
    this.saveCodeToLocalStorageThrottled();
  };

  saveCodeToLocalStorage = () => {
    const code = this.aceEditor.getValue();
    const key = this.keyNameForLocalStorage;
    localStorage.setItem(key, code);
  };

  saveTestsToLocalStorage = () => {
    const tests = JSON.stringify(this.ownTests);
    const key = this.keyNameForLocalStorage + '_t';
    localStorage.setItem(key, tests);
  };

  restoreCodeFromLocalStorage = () => {
    const key = this.keyNameForLocalStorage;
    const storedCode = localStorage.getItem(key) || '';
    const normalizedInitialCode = this.initialCode || '';
    let codeToLoad = '';
    if (storedCode.trim() !== '') {
      codeToLoad = storedCode;
    } else if (normalizedInitialCode.trim() !== '') {
      codeToLoad = normalizedInitialCode;
    }
    if (codeToLoad) {
      this.aceEditor.setValue(codeToLoad, 0);
      this.aceEditor.clearSelection();
      this.aceEditor.moveCursorTo(0, 0);
    }
  };

  restoreTestsFromLocalStorage = () => {
    const key = this.keyNameForLocalStorage + '_t';
    let tests;
    try {
      tests = JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      tests = [];
    }
    for (let testObj of tests) {
      this.addTest(testObj);
    }
  };

  saveCodeToLocalStorageThrottled = throttle(this.saveCodeToLocalStorage, 1000);
  saveTestsToLocalStorageThrottled = throttle(this.saveTestsToLocalStorage, 1000);

  createButtons() {
    // Узнаём есть ли в задаче тесты (= есть ли входные данные)
    let existExm = this.$defaultExamples && this.$defaultExamples.length > 0;
    this.buttons = {};
    const buttons = [
      {name: '$execBtn', text: 'Run code', onclick: this.execEditorContents},
      {name: '$checkBtn', text: 'Run on tests', onclick: this.runOnAllTests},
      {name: '$addBtn', text: 'Add test', onclick: this.addTest},
      {name: '$formatBtn', text: 'Format', onclick: this.reformatCode},
      {name: '$undo', text: '↶', onclick: this.undo},
      {name: '$redo', text: '↷', onclick: this.redo},
      {name: '$copy', text: '📋', onclick: this.copyToClipboard},
    ];
    for (const {name, text, onclick} of buttons) {
      if (existExm && name === '$execBtn') {
        continue;
      }
      if (!existExm && (name === '$checkBtn' || name === '$addBtn')) {
        continue;
      }
      const $Btn = document.createElement('button');
      $Btn.classList.add("ideButton");
      $Btn.textContent = text;
      if (onclick) {
        $Btn.addEventListener("click", onclick, true);
      }
      this.$parentElm.appendChild($Btn);
      this.buttons[name] = $Btn;
    }
  }

  createInfoElements() {
    this.elements = {};
    const elements = [
      {name: '$resultElm', tag: 'pre', cls: ''},
      {name: '$infoElm', tag: 'div', cls: 'ideOutput'},
    ];
    for (const {name, tag, cls} of elements) {
      const $Elm = document.createElement(tag);
      if (cls) {
        $Elm.classList.add(cls);
      }
      this.$parentElm.appendChild($Elm);
      this.elements[name] = $Elm;
    }
  }

  // То, что будет обработчиком событий нужно создавать как arrow function, иначе при вызове у них будет чужой this
  hideMessage = () => {
    this.elements['$resultElm'].classList.add("hidden");
  };

  showMessage = (e, error = true) => {
    if (error) {
      this.elements['$resultElm'].classList.remove("ideOK");
      this.elements['$resultElm'].classList.add("ideError");
    } else {
      this.elements['$resultElm'].classList.remove("ideError");
      this.elements['$resultElm'].classList.add("ideOK");
    }
    this.elements['$resultElm'].classList.remove("hidden");
    this.elements['$resultElm'].textContent = e.message;
  };

  reformatCode = async () => {
    if (this.isFormatting) {
      return;
    }
    const currentCode = this.aceEditor.getValue();
    if (!currentCode) {
      return;
    }
    const button = this.buttons && this.buttons['$formatBtn'];
    const previousLabel = button ? button.textContent : '';
    try {
      this.isFormatting = true;
      if (button) {
        button.disabled = true;
        button.textContent = 'Formatting…';
      }
      const formattedCode = await pythonFormatter(currentCode, {lineWidth: 120});
      if (typeof formattedCode === 'string' && formattedCode !== currentCode) {
        const cursor = this.aceEditor.getCursorPosition();
        const session = this.aceEditor.session;
        const scrollTop = session.getScrollTop();
        this.aceEditor.selectAll();
        const range = this.aceEditor.getSelectionRange();
        session.replace(range, formattedCode);
        const newLineCount = session.getLength();
        const targetRow = Math.min(cursor.row, Math.max(0, newLineCount - 1));
        const targetColumn = Math.min(cursor.column, session.getLine(targetRow).length);
        this.aceEditor.clearSelection();
        this.aceEditor.moveCursorTo(targetRow, targetColumn);
        session.setScrollTop(scrollTop);
      }
    } catch (error) {
      console.error('Python code formatting failed', error);
      if (error && error.message) {
        this.showMessage({message: error.message}, true);
      }
    } finally {
      this.isFormatting = false;
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel || 'Format';
      }
    }
  };

  execEditorContents = async () => {
    this.hideMessage();
    this.aceEditor.removeAllMarkerLines();
    const code = this.aceEditor.getValue();
    await this.execute(code);
  };

  // Run a code
  async execute(code, input = '', showMsg = true, timeout = 5000) {
    this.elements['$infoElm'].textContent = "Running...";
    this.workerObj.interrupt();
    // Конфиги для запуска pyodide
    const pyodideOptions = {
      inputValue: input,
    };
    if (this.installConfig) {
      pyodideOptions.packages = this.installConfig.packages;
      pyodideOptions.packageInstallMethod = this.installConfig.method;
    }
    // Делаем так, чтобы каждые 100мс запрашивалась текущая выдача worker'а
    let codeStopped = false;
    const timerId = setInterval(() => this.workerObj.getOutput().then((output) => {
      if (!codeStopped) this.showMessage({message: 'Still working... Output:\n' + output}, true);
    }), 100);
    const codeToRun = code + '\n\n' + this.footerCode;

    const workerResponse = await this.workerObj.runCode(pyodideOptions, codeToRun, timeout);
    clearInterval(timerId);
    codeStopped = true;
    if (!showMsg) {
    } else if (workerResponse.result === 'success') {
      const output = workerResponse.value.output;
      this.showMessage({message: output}, false);
    } else if (workerResponse.result === 'error') {
      const output = workerResponse.value.output;
      const errorText = workerResponse.value.errorText;
      const translation = translateError(errorText);
      const {line, texts} = translation;
      if (line) {
        this.aceEditor.addMarkerLine(parseInt(line));
      }
      const message = output + '\n\n' + texts.join('\n');
      this.showMessage({message}, true);
    } else if (workerResponse.result === 'timeout') {
      const output = await this.workerObj.getOutput();
      this.showMessage({message: 'Timeout... Output:\n' + output}, true);
    } else if (workerResponse.result === 'interrupted') {
      const output = workerResponse.value.output || '';
      this.showMessage({message: 'Interrupted. Output:\n' + output}, true);
    } else if (workerResponse.result === 'notEnoughInputData') {
      const output = workerResponse.value.output || '';
      this.showMessage({message: output + '\n\nNot enough input data.'}, true);
    } else {
      this.showMessage({message: 'IDE  :('}, true);
    }
    // console.log(workerResponse);
    this.elements['$infoElm'].textContent = '';
    return workerResponse;
  };

  checkAnswer(s1 = '', s2 = '') {
    const s1Prepared = s1.trim().replace(/ +\n/g, '\n');
    const s2Prepared = s2.trim().replace(/ +\n/g, '\n');
    return s1Prepared === s2Prepared;
  }

  async getTracerCode(code) {
    let tracer = tracerStart + code + tracerEnd;
    let workerResponse = await this.execute(tracer, '', false);
    return workerResponse.value.output;
  }

  async getTrace(code, input) {
    let traceCode = await this.getTracerCode(code);
    let workerResponse2 = await this.execute(traceCode, input, false);
    return workerResponse2.value.output;
  }

  showTrace = async () => {
    // получаем trace
    const code = this.aceEditor.getValue();
    let trace = await this.getTrace(code, traceInput);
    let allTraces = this.$parentOfAll.getElementsByClassName('traceField');
    for (let $traceField of allTraces) {
      $traceField.remove();
    }
    let $field = document.createElement('div');
    $field.classList.add('traceField');
    // кнопка удаления
    let $delButton = document.createElement('button');
    $delButton.classList.add('delButton');
    $delButton.addEventListener("click", function () {
      deleteTest($field)
    }, true);
    $field.appendChild($delButton);
    //
    let $traceField = document.createElement('div');
    $traceField.classList.add('trace');
    $traceField.innerText = trace;
    $field.appendChild($traceField);
    this.$parentOfAll.appendChild($field);
  }

  createAndCleanResultDiv = ($example) => {
    let $prev_ans = $example.getElementsByClassName('optionAns');
    let $resultDiv, $outputDiv;
    let isNewDiv = false;
    if ($prev_ans.length === 0) {
      $outputDiv = document.createElement('div');
      // Отдельный div для результата, чтобы менять цвет только ему
      $resultDiv = document.createElement('div');
      // Устанавливаем межстрочный интервал, как у других полей
      $resultDiv.style.lineHeight = '1.3';
      $outputDiv.classList.add('optionAns');
      // Кнопка для trace'а
      let $traceButton = document.createElement('button');
      $traceButton.classList.add('traceButton');
      $traceButton.addEventListener("click",
        function () {
          const $inputs = $example.getElementsByClassName('input');
          traceInput = $inputs.length > 0 ? $inputs[0].innerText.trim() : '';
        }, true);
      $traceButton.addEventListener("click", this.showTrace, true);
      $example.appendChild($traceButton);
      //
      $outputDiv.appendChild($resultDiv);
      isNewDiv = true;
    } else {
      $resultDiv = $prev_ans[0].firstChild;
    }
    $resultDiv.style.whiteSpace = 'pre-wrap';
    $resultDiv.style.color = 'black';
    $resultDiv.innerText = 'Running...';
    if (isNewDiv) {
      $example.appendChild($outputDiv);
    }
  }

  createAndCleanResultsDivs = () => {
    for (let $example of this.$defaultExamples) {
      this.createAndCleanResultDiv($example);
    }
    for (let $example of this.$examplesArray) {
      this.createAndCleanResultDiv($example);
    }
  }

  runOnAllTests = async () => {
    this.aceEditor.removeAllMarkerLines();
    const code = this.aceEditor.getValue();
    if (!this.$defaultExamples || this.$defaultExamples.length === 0) {
      return;
    }
    // Сначала чистим результат (и создаём блоки для вывода, если нужно)
    this.createAndCleanResultsDivs();
    let $allTests = [];
    for (let $example of this.$defaultExamples) {
      $allTests.push($example);
    }
    for (let $example of this.$examplesArray) {
      $allTests.push($example);
    }
    for (let $example of $allTests) {
      // Возможно, нет никакого ввода. Тогда считаем ввод пустым
      const $inputs = $example.getElementsByClassName('input');
      let input = $inputs.length > 0 ? $inputs[0].innerText.trim() : '';
      let workerResponse = await this.execute(code, input, false);
      let $result = $example.getElementsByClassName('optionAns')[0].firstChild;
      $result.style.color = 'black';
      if (workerResponse.result === 'success') {
        let pupil_answer = workerResponse.value.output;
        $result.innerText = pupil_answer;
        // Если тест добавляли вручную, то ответа нет
        let $probableAns = $example.getElementsByClassName('output');
        if ($probableAns.length > 0) {
          let answer = $probableAns[0].innerText.trim();
          // Может быть, что поле для ответа есть, а ответа нет
          if (answer === "") {
          } else if (this.checkAnswer(pupil_answer.trim(), answer)) {
            $result.style.color = 'green';
          } else {
            $result.style.color = 'red';
          }
        }
      } else if (workerResponse.result === 'error') {
        const output = workerResponse.value.output;
        const errorText = workerResponse.value.errorText;
        const translation = translateError(errorText);
        const {line, texts} = translation;
        if (line) {
          this.aceEditor.addMarkerLine(parseInt(line));
        }
        $result.innerText = output + '\n\n' + texts.join('\n');
        $result.style.color = 'red';
      } else if (workerResponse.result === 'timeout') {
        const timeoutOutput = await this.workerObj.getOutput();
        $result.innerText = timeoutOutput ? 'Timeout\n' + timeoutOutput : 'Timeout';
        $result.style.color = 'red';
      } else {
        $result.innerText = 'Some IDE error :(';
        $result.style.color = 'red';
      }
    }
    this.hideMessage();
  };

  addTest = (fromObject = null) => {
    // Создаём блок для нового теста
    let $newExample = document.createElement('div');
    $newExample.classList.add('example');
    // Создаём поля ввода и вывода
    let $inputDiv = document.createElement('div');
    let $outputDiv = document.createElement('div');
    $inputDiv.classList.add('input');
    $outputDiv.classList.add('output');
    // Создаём формы для ручного ввода для каждого из полей
    let $inputArea = document.createElement('div');
    let $outputArea = document.createElement('div');
    $inputArea.contentEditable = 'true';
    $outputArea.contentEditable = 'true';
    // Создаём кнопку удаления
    let $delButton = document.createElement('button');
    $delButton.classList.add('delButton');
    $newExample.appendChild($delButton);
    // Отключаем копирование стилей
    for (const $Area of [$inputArea, $outputArea]) {
      $Area.addEventListener('paste', function (e) {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      });
    }
    // Подключаем формы для ручного ввода к полям
    $inputDiv.appendChild($inputArea);
    $outputDiv.appendChild($outputArea);
    // Подключаем поля ввода и вывода к тесту
    $newExample.appendChild($inputDiv);
    $newExample.appendChild($outputDiv);
    // Подключаем тест к задаче
    // Список с тестами всё ещё наш!
    if (this.$examplesArray.length > 0) {
      let $addAfter = this.$examplesArray[this.$examplesArray.length - 1];
      $addAfter.after($newExample);
    } else if (this.$lastDefaultExample) {
      this.$lastDefaultExample.after($newExample);
    } else {
      this.$parentElm.appendChild($newExample);
    }
    this.$examplesArray.push($newExample);
    const newTestValues = {input: '', output: '',};
    // Заполняем дефолтными значениями
    if (fromObject) {
      $inputArea.innerText = newTestValues.input = fromObject.input || '';
      $outputArea.innerText = newTestValues.output = fromObject.output || '';
    }
    // Делаем автосохранение тестов при изменении
    $inputArea.oninput = ev => {
      newTestValues.input = ev.target.innerText;
      this.saveTestsToLocalStorageThrottled();
    };
    $outputArea.oninput = ev => {
      newTestValues.output = ev.target.innerText;
      this.saveTestsToLocalStorageThrottled();
    };
    this.ownTests.push(newTestValues);
    // подключаем кнопку удаления
    $delButton.addEventListener("click", function () {
      deleteTest($newExample)
    }, true);
    $delButton.addEventListener("click", this.recreateTests, true);
  }

  recreateTests = () => {
    // Полностью пересоздаём (редкие операции -> можно за любую ассимптотику)
    this.$examplesArray.length = 0;
    this.ownTests.length = 0;
    for (let $example of this.$parentOfAll.getElementsByClassName('example')) {
      if ($example.getElementsByClassName('delButton').length > 0) {
        this.$examplesArray.push($example);
        const newTestValues = {input: '', output: '',};
        newTestValues.input = $example.getElementsByClassName('input')[0].innerText || '';
        newTestValues.output = $example.getElementsByClassName('output')[0].innerText || '';
        this.ownTests.push(newTestValues);
      }
    }
    this.saveTestsToLocalStorage();
  }

  copyToClipboard = () => {
    const sel = this.aceEditor.selection.toJSON(); // save selection
    this.aceEditor.selectAll();
    this.aceEditor.focus();
    document.execCommand('copy');
    this.aceEditor.selection.fromJSON(sel); // restore selection
  };

  undo = () => {
    this.UndoManager.undo();
  };

  redo = () => {
    this.UndoManager.redo();
  };
}
