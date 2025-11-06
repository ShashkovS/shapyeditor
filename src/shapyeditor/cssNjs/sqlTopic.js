/*
В worker.sql-wasm.js в
return sqlModuleReady.then(function () { ... })
добавить
.catch (function (err) {
            return postMessage({
                'id': event.data.id,
                'error': err.message,
            });
        });
https://github.com/kripken/sql.js/pull/288/files
https://stackoverflow.com/questions/30715367/why-can-i-not-throw-inside-a-promise-catch-handler
https://stackoverflow.com/questions/39992417/how-to-bubble-a-web-worker-error-in-a-promise-via-worker-onerror
 */
// Подгружаем недостающие библиотеки
import {md5} from './md5.min.js';
import {sqlFormatter} from './sqlFormatter.js';
import {encrypt, decrypt} from './encryptDecrypt.js';

window.encrypt = encrypt;
window.decrypt = decrypt;

const worker = new Worker("ace/worker.sql-wasm.min.js");

const loadDbAndAddIDE = ($parentElm, $loading, dbUrl, corrValueMd5, corrTotalMd5) => {
  // Если всё уже загружено, то ничего не делаем
  if ($parentElm.dataset.loaded) {
    return;
  }
  // Иначе удаляем всё к чертям, если в предыдущий раз что-то пошло не так
  for (let $elm of $parentElm.children) {
    if ($elm.className !== 'loader') $parentElm.removeChild($elm);
  }

  // Создаём всю разметку

  // Редактор
  const $commandsElm = document.createElement('div');
  $commandsElm.classList.add("sqlEditor");
  $parentElm.appendChild($commandsElm);
  const aceEditor = initAceEditors($commandsElm);

  const $formatBtn = document.createElement('button');
  $formatBtn.classList.add("sqlButton");
  $formatBtn.textContent = 'Format SQL';
  $parentElm.appendChild($formatBtn);

  // Кнопки
  const $execBtn = document.createElement('button');
  $execBtn.classList.add("sqlButton");
  $execBtn.textContent = 'Execute SQL';
  $parentElm.appendChild($execBtn);

  const $checkBtn = document.createElement('button');
  $checkBtn.classList.add("sqlButton");
  $checkBtn.textContent = 'Check results';
  $parentElm.appendChild($checkBtn);

  const $reloadBtn = document.createElement('button');
  $reloadBtn.classList.add("sqlButton");
  $reloadBtn.textContent = 'Reload database';
  $parentElm.appendChild($reloadBtn);

  const $downloadLink = document.createElement('a');
  $downloadLink.href = dbUrl;
  $downloadLink.text = 'Download database';
  $parentElm.appendChild($downloadLink);

  // Ошибки
  const $errorElm = document.createElement('div');
  $parentElm.appendChild($errorElm);

  // Вывод
  const $outputElm = document.createElement('pre');
  $outputElm.classList.add("sqlOutput");
  $parentElm.appendChild($outputElm);

  const showMessage = (e, error = true) => {
    console.log(e);
    if (error) {
      $errorElm.classList.remove("sqlOK");
      $errorElm.classList.add("sqlError");
    } else {
      $errorElm.classList.remove("sqlError");
      $errorElm.classList.add("sqlOK");
    }
    $errorElm.style.height = '2em';
    $errorElm.textContent = e.message;
  };

  worker.onerror = showMessage;

  const hideMessage = () => {
    $errorElm.style.height = '0';
  };

  const print = (text) => {
    $outputElm.innerHTML = text.replace(/\n/g, '<br>');
  };


  // Run a command in the database
  const execute = (commands) => {
    tic();
    worker.onmessage = event => {
      if (event.data.error) {
        showMessage({message: event.data.error});
        $outputElm.textContent = '';
      } else {
        const results = event.data.results;
        toc("Executing SQL");
        tic();
        $outputElm.innerHTML = "";
        // Это для проверки ответа
        const totJsonValues = [];
        const totJsonTotal = [];
        for (let i = 0; i < results.length; i++) {
          $outputElm.appendChild(tableCreate(results[i].columns, results[i].values));
          totJsonValues.push(JSON.stringify(results[i].values));
          totJsonTotal.push(JSON.stringify(results[i].columns));
          totJsonTotal.push(JSON.stringify(results[i].values));
        }
        $parentElm.dataset.ValuesMd5 = md5(totJsonValues.join('\n'));
        $parentElm.dataset.TotalMd5 = md5(totJsonTotal.join('\n'));
        toc("Displaying results");
      }
    };
    $parentElm.dataset.ValuesMd5 = '';
    $parentElm.dataset.TotalMd5 = '';
    worker.postMessage({action: 'exec', sql: commands});
    $outputElm.textContent = "Fetching results...";
  };

  // Create an HTML table
  const tableCreate = function () {
    const valconcat = (vals, tagName) => {
      if (vals.length === 0) return '';
      const tagOpen = '<' + tagName + '>', tagClose = '</' + tagName + '>';
      return tagOpen + vals.join(tagClose + tagOpen) + tagClose;
    };

    return function (columns, values) {
      const tbl = document.createElement('table');
      let html = '<thead>' + valconcat(columns, 'th') + '</thead>';
      const rows = values.map(function (v) {
        return valconcat(v, 'td');
      });
      html += '<tbody>' + valconcat(rows, 'tr') + '</tbody>';
      tbl.innerHTML = html;
      return tbl;
    }
  }();

// Execute the commands when the button is clicked
  const execEditorContents = () => {
    worker.onerror = showMessage;
    hideMessage();
    execute(aceEditor.getValue() + ';');
  };

  $execBtn.addEventListener("click", execEditorContents, true);


  const checkCorrectness = () => {
    console.log('total', corrTotalMd5, $parentElm.dataset.TotalMd5);
    console.log('values', corrValueMd5, $parentElm.dataset.ValuesMd5);
    if (corrTotalMd5 && corrTotalMd5 === $parentElm.dataset.TotalMd5 || corrValueMd5 && corrValueMd5 === $parentElm.dataset.ValuesMd5) {
      showMessage({message: 'Success!'}, false);
    } else {
      showMessage({message: 'Something looks wrong...'}, true);
    }
  };

  $checkBtn.addEventListener("click", checkCorrectness, true);

  const formatSQL = () => {
    const rawSQL = aceEditor.getValue();
    const formatted = sqlFormatter(rawSQL);
    aceEditor.setValue(formatted, 1);
  };

  $formatBtn.addEventListener("click", formatSQL, true);


// Performance measurement functions
  let tictime;
  if (!window.performance || !performance.now) {
    window.performance = {now: Date.now}
  }

  const tic = () => {
    tictime = performance.now();
  };

  const toc = (msg) => {
    var dt = performance.now() - tictime;
    console.log((msg || 'toc') + ": " + dt + "ms");
  };

  const loadDbFromUrl = () => {
    // Грузим базу
    worker.onerror = showMessage;
    let xhr = new XMLHttpRequest();
    xhr.open('GET', dbUrl, true);
    xhr.responseType = 'arraybuffer';
    xhr.onerror = showMessage;
    xhr.upload.onerror = showMessage;
    xhr.onloadend = e => {
      if (xhr.status !== 200) {
        console.warn(xhr);
        showMessage({message: `${xhr.status} ${xhr.statusText} ${xhr.responseURL}`});
        return;
      }
      worker.onmessage = event => {
        toc(`Loading database from ${dbUrl}`);
        worker.onmessage = event => {
          // Здесь мы получили список таблиц. Теперь нужен список колонок в каждой таблице
          const tableList = event.data.results[0].values.map(row => row[0]);
          const pragmaRequest = tableList.map(table => `PRAGMA table_info(${table});`).join('\n');
          worker.onmessage = event => {
            // Здесь мы получили список колонок в каждой таблице
            const columnsList = event.data.results.map(tableInfo => tableInfo.values.map(row => row[1]));
            // Теперь нам нужно настроить подсказсчик
            let tableAndColumns = {};
            for (let i = 0; i < tableList.length; i++) {
              tableAndColumns[tableList[i]] = columnsList[i];
            }
            aceEditor.completers.pop();
            aceEditor.completers.push(generateCustomCompleter(tableAndColumns));
            // И вывести по 5 строчек из каждой таблицы
            if (!$parentElm.dataset.loaded) {
              const limit5Request = tableList.map(table => `SELECT *
                                                            FROM ${table} LIMIT 5;`).join('\n');
              aceEditor.setValue(limit5Request, 1);
              execEditorContents();
              $parentElm.dataset.loaded = true;
              $loading.remove();
            }
          };
          worker.postMessage({action: 'exec', sql: pragmaRequest});
        };
        worker.postMessage({action: 'exec', sql: "SELECT name FROM sqlite_master WHERE type='table';"});
      };
      tic();
      const buffer = xhr.response;
      try {
        worker.postMessage({action: 'open', buffer: buffer}, [buffer]);
      } catch (exception) {
        worker.postMessage({action: 'open', buffer: buffer});
      }
    };
    xhr.send();
  };

  $reloadBtn.addEventListener("click", loadDbFromUrl, true);
  loadDbFromUrl();
};

const processSqlIdeSpoilers = () => {
  for (let $elm of document.getElementsByClassName('sqlSpoiler')) {
    // let $elm = document.getElementsByClassName('sqlSpoiler'))[0];
    // Находим span класса spoiler_title и навешиваем на его onclick ещё одну функцию
    const dbUrl = $elm.dataset.dbname;
    const corrValueMd5 = $elm.dataset.corrvaluemd5;
    const corrTotalMd5 = $elm.dataset.corrtotalmd5;
    const $spanNode = $elm.querySelector('.spoiler_title');
    const $spoilerDiv = $elm.querySelector('.spoiler_text');
    // Добавляем лоадер
    const $loading = document.createElement('div');
    $loading.className = 'loader';
    $loading.innerHTML = '<span class="dot"></span><div class="dots"><span></span><span></span><span></span></div>';
    $spoilerDiv.appendChild($loading);
    // Добавляем загрузку базы и создание редактора по клику
    $spanNode.addEventListener("click", () => loadDbAndAddIDE($spoilerDiv, $loading, dbUrl, corrValueMd5, corrTotalMd5), false);
  }
};

document.addEventListener("DOMContentLoaded", function () {
  processSqlIdeSpoilers();
});


const initAceEditors = ($editorElm) => {
  const aceEditor = ace.edit($editorElm);
  aceEditor.setTheme("ace/theme/sqlserver");
  aceEditor.session.setMode("ace/mode/sql");
  aceEditor.setOptions({
    maxLines: 1000,
    // editor options
    selectionStyle: "text",
    highlightActiveLine: true,
    highlightSelectedWord: true,
    cursorStyle: "wide",
    mergeUndoDeltas: "always",
    //behavioursEnabled: boolean,
    //wrapBehavioursEnabled: boolean,
    // this is needed if editor is inside scrollable page
    //autoScrollEditorIntoView: boolean (defaults to false),
    // copy/cut the full line if selection is empty, defaults to false
    copyWithEmptySelection: false,
    useSoftTabs: true,
    navigateWithinSoftTabs: true,
    enableMultiselect: true,
    theme: "ace/theme/sqlserver",
    // renderer options
    hScrollBarAlwaysVisible: false,
    vScrollBarAlwaysVisible: true,
    highlightGutterLine: true,
    animatedScroll: false,
    showInvisibles: true,
    showPrintMargin: false,
    printMarginColumn: 120,
    // shortcut for showPrintMargin and printMarginColumn
    fadeFoldWidgets: false,
    showFoldWidgets: false,
    showLineNumbers: true,
    showGutter: true,
    displayIndentGuides: true,
    fontSize: 18,
    //fontFamily: css font-family value,
    // number of page sizes to scroll after document end (typical values are 0, 0.5, and 1)
    scrollPastEnd: 0.5,
    fixedWidthGutter: true,
    // session options
    firstLineNumber: 1,
    overwrite: false,
    newLineMode: "auto",
    useWorker: false,  // Нужно сделать для питона, см. https://github.com/ajaxorg/ace/wiki/Syntax-validation
    tabSize: 4,
    wrap: false,
    enableBasicAutocompletion: false,
    enableLiveAutocompletion: true,
    enableSnippets: false,
  });
  // console.warn('completer', $editorElm.dataset.completer);
  const customCompletion = {
    getCompletions: function (editor, session, pos, prefix, callback) {
      callback(null, []);
    }
  };
  // см. https://github.com/ajaxorg/ace/blob/master/lib/ace/ext/language_tools.js
  aceEditor.completers.push(customCompletion);
  return aceEditor;
};

const generateCustomCompleter = (tableAndColumns) => {
  var completions = [];
  for (let [table, columns] of Object.entries(tableAndColumns)) {
    // Добавляем таблицы
    completions.push({
      caption: table,
      value: table,
      score: 0.9,
      meta: "table"
    });
    // Добавляем столбцы
    for (let column of columns) {
      completions.push({
        caption: `${table}.${column}`,
        value: column,
        score: 0.5,
        meta: "column"
      });
    }
  }
  return {
    getCompletions: function (editor, session, pos, prefix, callback) {
      callback(null, completions);
    }
  }
};
