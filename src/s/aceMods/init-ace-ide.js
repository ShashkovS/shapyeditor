/**
 * Всё для создания и настройки кодовой зоны
 */

// Импортируем ace
import "../ace/ace.min.js";
import "../ace/ext-language_tools.js";
import "../ace/ext-searchbox.js"; // нужно для find/replace UI

// Импортируем документацию и кастомные подсказчики
import DocTooltip from './doc-tooltip.js';
import Completions from './completions.js';
// Импортируем кастомный модуль работы с питоном (поддерживающий worker'ов)
import './mode-python-with-worker.js';

// Настраиваем пути и константы
const ace = window.ace;
ace.config.set('basePath', new URL('../ace', import.meta.url).pathname);
const langTools = ace.require("ace/ext/language_tools");
const useragent = ace.require("ace/lib/useragent");

// Удобный helper для дубликата строки/выделения как в PyCharm (Cmd/Ctrl+D)
function duplicateSmart(editor) {
  const sel = editor.getSelectionRange();
  if (sel.isEmpty()) {
    editor.execCommand("copylinesdown");
  } else {
    editor.execCommand("duplicateSelection");
  }
}

// Собираем PyCharm-подобный кеймап (macOS и Win/Linux)
function bindPyCharmKeymap(editor, { onFormat } = {}) {
  const isMac = useragent.isMac;

  // Универсальные команды Ace, к которым маппим хоткеи из PyCharm
  const bindings = [
    // Duplicate line/selection: PyCharm — Cmd-D (mac), Ctrl-D (win)
    {
      name: "pycharm-duplicate",
      bindKey: {win: "Ctrl-D", mac: "Command-D"},
      exec: duplicateSmart
    },
    // Delete line: PyCharm — Ctrl-Y (win), Cmd-Backspace (mac)
    {
      name: "pycharm-delete-line",
      bindKey: {win: "Ctrl-Y", mac: "Command-Backspace"},
      exec: (ed) => ed.execCommand("removeline")
    },
    // Move line up/down: PyCharm — Alt-Shift-Up/Down (оба)
    {
      name: "pycharm-move-line-up",
      bindKey: {win: "Alt-Shift-Up", mac: "Alt-Shift-Up"},
      exec: (ed) => ed.execCommand("movelinesup")
    },
    {
      name: "pycharm-move-line-down",
      bindKey: {win: "Alt-Shift-Down", mac: "Alt-Shift-Down"},
      exec: (ed) => ed.execCommand("movelinesdown")
    },
    // Comment/uncomment line: PyCharm — Ctrl-/ (win), Cmd-/ (mac)
    {
      name: "pycharm-toggle-line-comment",
      bindKey: {win: "Ctrl-/", mac: "Command-/"},
      exec: (ed) => ed.execCommand("togglecomment")
    },
    // Block comment: PyCharm — Ctrl-Shift-/ (win), Cmd-Alt-/ (mac)
    {
      name: "pycharm-toggle-block-comment",
      bindKey: {win: "Ctrl-Shift-/", mac: "Command-Alt-/"},
      exec: (ed) => ed.execCommand("toggleBlockComment")
    },
    // Find / Replace: PyCharm — Ctrl-F / Ctrl-R (win), Cmd-F / Cmd-R (mac)
    {
      name: "pycharm-find",
      bindKey: {win: "Ctrl-F", mac: "Command-F"},
      exec: (ed) => ed.execCommand("find")
    },
    {
      name: "pycharm-replace",
      bindKey: {win: "Ctrl-R", mac: "Command-R"},
      exec: (ed) => ed.execCommand("replace")
    },
    // Find next/prev: F3 / Shift-F3 — в PyCharm и Ace совпадает
    {
      name: "pycharm-find-next",
      bindKey: {win: "F3", mac: "F3"},
      exec: (ed) => ed.execCommand("findnext")
    },
    {
      name: "pycharm-find-prev",
      bindKey: {win: "Shift-F3", mac: "Shift-F3"},
      exec: (ed) => ed.execCommand("findprevious")
    },
    // Multi-caret add above/below: PyCharm — Alt-Shift-Up/Down (в PyCharm это «клонировать курсор», совпало с move lines, поэтому дадим альтернативу)
    // Дадим альтернативные бинды: Ctrl-Alt-Up/Down (win), Option-Cmd-Up/Down (mac)
    {
      name: "pycharm-add-caret-above",
      bindKey: {win: "Ctrl-Alt-Up", mac: "Option-Command-Up"},
      exec: (ed) => ed.execCommand("addCursorAbove")
    },
    {
      name: "pycharm-add-caret-below",
      bindKey: {win: "Ctrl-Alt-Down", mac: "Option-Command-Down"},
      exec: (ed) => ed.execCommand("addCursorBelow")
    },
    // Select next occurrence: PyCharm — Alt-J (win), Ctrl-G (mac).
    {
      name: "pycharm-select-next-occurrence",
      bindKey: {win: "Ctrl-G", mac: "Command-G"},
      exec: (ed) => ed.execCommand("selectMoreAfter")
    },
    // Format code: PyCharm — Ctrl-Alt-L (win), Cmd-Alt-L (mac)
    {
      name: "pycharm-reformat-code",
      bindKey: {win: "Ctrl-Alt-L", mac: "Command-Alt-L"},
      exec: (ed) => {
        if (typeof onFormat === "function") {
          const value = ed.getValue();
          const pos = ed.getCursorPosition();
          const scrollTop = ed.session.getScrollTop();
          Promise.resolve(onFormat(value))
            .then((formatted) => {
              if (typeof formatted === "string" && formatted !== value) {
                ed.setValue(formatted, -1); // -1 — чтобы не двигать историю undo
                ed.moveCursorToPosition(pos);
                ed.session.setScrollTop(scrollTop);
              }
            })
            .catch((e) => {
              console.warn("Format failed:", e);
            });
        }
      }
    },
    // Join lines: PyCharm — Ctrl-Shift-J (win), Ctrl-Shift-J (mac, в PyCharm это ^⇧J, но дадим общий)
    {
      name: "pycharm-join-lines",
      bindKey: {win: "Ctrl-Shift-J", mac: "Ctrl-Shift-J"},
      exec: (ed) => {
        const Range = ace.require("ace/range").Range;
        const sel = ed.getSelectionRange();
        if (sel.isEmpty()) {
          const row = ed.getCursorPosition().row;
          const line = ed.session.getLine(row);
          const next = ed.session.getLine(row + 1);
          if (typeof next === "string") {
            const endCol = line.length;
            ed.session.replace(new Range(row, endCol, row + 1, 0), " ");
          }
        } else {
          // Простейшее join для выделенного диапазона
          const text = ed.session.getTextRange(sel).replace(/\n\s*/g, " ");
          ed.session.replace(sel, text);
        }
      }
    }
  ];

  // Регистрируем
  for (const cmd of bindings) {
    editor.commands.addCommand(cmd);
  }

  // Дополнительно: сделаем стандартные Ace бинды максимально PyCharm-подобными
  // На mac OS часто удобно иметь "Command-Shift-F/R" для глобального поиска — в браузере ограничено,
  // поэтому оставляем только редакторские F3/Shift-F3 и Find/Replace.
}

// Дефолтные настройки кодовой зоны
const editorDefaultOptions = {
  // editor options
  maxLines: 1000,
  selectionStyle: 'text',
  highlightActiveLine: true,
  highlightSelectedWord: true,
  cursorStyle: 'wide',
  mergeUndoDeltas: 'always',
  // behavioursEnabled: boolean,
  // wrapBehavioursEnabled: boolean,
  // this is needed if editor is inside scrollable page
  // autoScrollEditorIntoView: boolean (defaults to false),
  // copy/cut the full line if selection is empty, defaults to false
  copyWithEmptySelection: false,
  useSoftTabs: true,
  navigateWithinSoftTabs: true,
  enableMultiselect: true,
  // renderer options
  hScrollBarAlwaysVisible: false,
  vScrollBarAlwaysVisible: false,
  highlightGutterLine: true,
  animatedScroll: false,
  showPrintMargin: true,
  printMarginColumn: 120,
  // shortcut for showPrintMargin and printMarginColumn
  fadeFoldWidgets: false,
  showFoldWidgets: true,
  showLineNumbers: true,
  showInvisibles: true,
  showGutter: true,
  displayIndentGuides: true,

  fontSize: 14,
  // fontFamily: css font-family value,
  // number of page sizes to scroll after document end (typical values are 0, 0.5, and 1)
  scrollPastEnd: 0.5,
  fixedWidthGutter: true,
  // session options
  firstLineNumber: 1,
  overwrite: false,
  newLineMode: 'auto',
  useWorker: true, // Включает python worker (lint)
  tabSize: 4,
  wrap: false,
  mode: 'ace/mode/python',
  theme: `ace/theme/dracula`,
  // language tools
  enableBasicAutocompletion: true,
  enableLiveAutocompletion: true,
  enableSnippets: false,
};

export const initAceEditors = ($editorElm, customCompletions, opts = {}) => {
  // opts.onFormat?: (code: string) => string|Promise<string>
  const editor = ace.edit($editorElm);
  editor.setOptions({
    ...editorDefaultOptions,
    theme: `ace/theme/dracula`,
  });

  const customCompletion = {
    getCompletions: Completions(customCompletions),
    getDocTooltip: DocTooltip,
  };
  langTools.setCompleters([customCompletion, langTools.textCompleter]);

  // PyCharm-like hotkeys (macOS & Windows/Linux)
  bindPyCharmKeymap(editor, { onFormat: opts.onFormat });

  // Маркеры ошибок
  editor.markerLines = [];
  editor.addMarkerLine = (line) => {
    editor.gotoLine(line, 0);
    const Range = ace.require("ace/range").Range;
    const range = new Range(line - 1, 0, line, 0);
    editor.marker = editor.session.addMarker(range, 'err-line', 'line', true);
    editor.markerLines.push(editor.marker);
    return editor.marker;
  };
  editor.removeAllMarkerLines = () => {
    for (let marker of editor.markerLines) {
      editor.session.removeMarker(marker);
    }
    editor.markerLines.length = 0;
  };

  return editor;
};
