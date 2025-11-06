const cvtJsRegexToPy = (regVal) => {
  // Регулярки в JS отлично поддерживают юникод...
  regVal = regVal.replace(/\\\\/g, '%%DOUBLE_SLASH_eriqj5%%');
  regVal = regVal.replace(/\\\[/g, '%%OP_SQ_BRACKET_eriqj5%%');
  regVal = regVal.replace(/\\\]/g, '%%CL_SQ_BRACKET_eriqj5%%');
  regVal = regVal.replace(/\\\{/g, '%%OP_CURL_BRACKET_eriqj5%%');
  regVal = regVal.replace(/\\\}/g, '%%CL_CURL_BRACKET_eriqj5%%');
  regVal = regVal.replace(/\{,(\d+)\}/g, '{0,$1}'); // Вообще говоря, такую замену нельзя делать внутри квадратных скобок
  regVal = regVal.replace(/\{(\d+),\}/g, '{$1,9999}'); // Вообще говоря, такую замену нельзя делать внутри квадратных скобок
  regVal = regVal.replace(/(\[.*)\\w(.*\])/g, '$1A-Za-zА-Яа-яЁё0-9_$2');
  regVal = regVal.replace(/(\[.*)\\W(.*\])/g, '$1!-/:-@[-^`{-Џ$2');
  regVal = regVal.replace(/(\[.*)\\b(.*\])/g, '$1$2');
  regVal = regVal.replace(/(\[.*)\\B(.*\])/g, '$1$2');
  regVal = regVal.replace(/\\w/g, '[A-Za-zА-Яа-яЁё0-9_]');
  regVal = regVal.replace(/\\W/g, '[^A-Za-zА-Яа-яЁё0-9_]');
  regVal = regVal.replace(/\\b/g, '(?:^(?=[A-Za-zА-Яа-яЁё0-9_])|(?<=[A-Za-zА-Яа-яЁё0-9_])$|(?<=[A-Za-zА-Яа-яЁё0-9_])(?![A-Za-zА-Яа-яЁё0-9_])|(?<![A-Za-zА-Яа-яЁё0-9_])(?=[A-Za-zА-Яа-яЁё0-9_]))');
  regVal = regVal.replace(/\\B/g, '(?:^(?![A-Za-zА-Яа-яЁё0-9_])|(?<![A-Za-zА-Яа-яЁё0-9_])$|(?<=[A-Za-zА-Яа-яЁё0-9_])(?=[A-Za-zА-Яа-яЁё0-9_])|(?<![A-Za-zА-Яа-яЁё0-9_])(?![A-Za-zА-Яа-яЁё0-9_]))');
  regVal = regVal.replace(/%%DOUBLE_SLASH_eriqj5%%/g, '\\\\');
  regVal = regVal.replace(/%%OP_SQ_BRACKET_eriqj5%%/g, '\\[');
  regVal = regVal.replace(/%%CL_SQ_BRACKET_eriqj5%%/g, '\\]');
  regVal = regVal.replace(/%%OP_CURL_BRACKET_eriqj5%%/g, '\\{');
  regVal = regVal.replace(/%%CL_CURL_BRACKET_eriqj5%%/g, '\\}');
  return regVal;
};

const prcRegexChange = (event) => {
  // let $regInput = document.getElementsByClassName("form-control")[0];
  let $regInput = event.target;
  let $alert = $regInput.parentNode.parentNode.children[1];
  let $tableOrPre = $regInput.parentNode.parentNode.children[2].children[0];
  let regVal = $regInput.value;
  $regInput.parentNode.children[1].innerText = regVal.length;
  setAlert($alert, 'Good regex awaited!', "waiting");
  if (regVal.length > 0) {
    try {
      // Первый раз компилируем для валидации
      let regexObj = new RegExp(regVal);
      regVal = cvtJsRegexToPy(regVal);
      processAnyRegexChange($tableOrPre, $alert, regVal);
    } catch (e) {
      setAlert($alert, '<b>Error ' + e.name + '</b>:' + e.message, "error");
      resetAllStrings($tableOrPre);
    }
  } else {
    resetAllStrings($tableOrPre);
  }
};

const setAlert = ($alert, text, style) => {
  $alert.classList.remove("error");
  $alert.classList.remove("waiting");
  $alert.classList.remove("success");
  $alert.classList.add(style);
  $alert.innerHTML = text;
};

const processAnyRegexChange = ($tableOrPre, $alert, regVal) => {
  if ($tableOrPre.tagName === "TABLE" && $tableOrPre.classList.contains('testsYesNoTbl')) {
    regexObj = new RegExp(regVal);
    processYesNoRegexChange($tableOrPre, regexObj, $alert);
  } else if ($tableOrPre.tagName === "TABLE" && $tableOrPre.classList.contains('testsMatchGrpTbl')) {
    regexObj = new RegExp(regVal);
    processMatchGrpRegexChange($tableOrPre, regexObj, $alert);
  } else {
    regexObj = new RegExp(regVal, 'g');
    processAllMatchPreRegexChange($tableOrPre, regexObj, $alert);
  }
};

const processAllMatchPreRegexChange = ($pre, regexObj, $alert) => {
  $pre.innerHTML = $pre.dataset.val.replace(regexObj, '<mark>$&</mark>');
};

const processMatchGrpRegexChange = ($table, regexObj, $alert) => {
  // let $table = document.getElementsByClassName("testsMatchGrpTbl")[0];
  let $rows = $table.children[2].children;
  let maxNumGroups = $table.children[0].childElementCount - 2; // Столбец с плюсами и исходным текстом вычетаем
  let anyError = false;
  // debugger;
  for (let i = 0; i < $rows.length; i++) {
    let $row = $rows[i];
    let $matchIcon = $row.children[0];
    let $matchCol = $row.children[1];
    let matchColVal = $matchCol.dataset.val;
    let matchColRes = regexObj.exec(matchColVal);
    if (matchColRes !== null) {
      $matchCol.innerHTML = matchColVal.slice(0, matchColRes.index)
        + '<mark>'
        + matchColVal.slice(matchColRes.index, matchColRes.index + matchColRes[0].length)
        + '</mark>'
        + matchColVal.slice(matchColRes.index + matchColRes[0].length);
    }
    let groups = [];
    for (let j = 0; j < maxNumGroups; j++) groups.push('');
    if (matchColRes !== null)
      for (let j = 1; j < Math.min(matchColRes.length, maxNumGroups + 1); j++)
        groups[j - 1] = matchColRes[j];
    let allColumnsOk = true;
    for (let j = 2; j < $row.childElementCount; j++) {
      let $cell = $row.children[j];
      $cell.innerText = groups[j - 2];
      $cell.classList.remove("matchToBeFound");
      if (j === 5) {
        console.log('boo', $cell.dataset.val, groups[j - 2], $cell.dataset.val === groups[j - 2]);
      }
      if ($cell.dataset.val === groups[j - 2]) {
        $cell.innerHTML = '<span style="color: green;">✔</span>' + $cell.innerHTML;
      } else {
        allColumnsOk = false;
        $cell.innerHTML = '<span style="color: red;">✕</span>' + $cell.innerHTML;
      }
    }
    if (allColumnsOk) {
      $matchIcon.innerHTML = '<span style="color: green;">✔</span>';
    } else {
      anyError = true;
      $matchIcon.innerHTML = '<span style="color: red;">✕</span>';
    }
  }
  if (!anyError) {
    setAlert($alert, 'Great!', "success");
  }
};

const processYesNoRegexChange = ($table, regexObj, $alert) => {
  let $rows = $table.children[2].children;
  let anyError = false;
  for (let i = 0; i < $rows.length; i++) {
    let $row = $rows[i];
    let [$matchIcon, $matchCol, $nomatchIcon, $nomatchCol] = $row.children;
    let matchColVal = $matchCol.dataset.val;
    let noMatchColVal = $nomatchCol.dataset.val;
    let matchColRes = regexObj.exec(matchColVal);
    let noMatchColRes = regexObj.exec(noMatchColVal);
    if (matchColRes === null) {
      if (!anyError) {
        anyError = true;
        setAlert($alert, 'Line «' + matchColVal + '» must match the template', "error");
      }
      $matchIcon.innerHTML = '<span style="color: red;">✕</span>';
      $matchCol.innerHTML = $matchCol.dataset.val;
    } else {
      $matchCol.innerHTML = matchColVal.slice(0, matchColRes.index)
        + '<mark>'
        + matchColVal.slice(matchColRes.index, matchColRes.index + matchColRes[0].length)
        + '</mark>'
        + matchColVal.slice(matchColRes.index + matchColRes[0].length);
      if (matchColRes[0].length === matchColVal.length) {
        $matchIcon.innerHTML = '<span style="color: green;">✔</span>';
      } else {
        $matchIcon.innerHTML = '<span style="color: red;">✕</span>';
        if (!anyError) {
          anyError = true;
          setAlert($alert, 'Line «' + matchColVal + '» must match the template', "error");
        }
      }
    }
    if (noMatchColRes === null) {
      $nomatchIcon.innerHTML = '<span style="color: green;">✔</span>';
      $nomatchCol.innerHTML = $nomatchCol.dataset.val;
    } else {
      if (!anyError) {
        anyError = true;
        setAlert($alert, 'Line «' + noMatchColVal + '» must not contain matches', "error");
      }
      $nomatchIcon.innerHTML = '<span style="color: red;">✕</span>';
      $nomatchCol.innerHTML = noMatchColVal.slice(0, noMatchColRes.index)
        + '<mark>'
        + noMatchColVal.slice(noMatchColRes.index, noMatchColRes.index + noMatchColRes[0].length)
        + '</mark>'
        + noMatchColVal.slice(noMatchColRes.index + noMatchColRes[0].length);
    }
  }
  if (!anyError) {
    setAlert($alert, 'Great!', "success");
  }
};

const resetAllStrings = ($tableOrPre) => {
  if ($tableOrPre.tagName === "TABLE" && $tableOrPre.classList.contains('testsYesNoTbl')) {
    let $rows = $tableOrPre.children[2].children;
    for (let i = 0; i < $rows.length; i++) {
      let $row = $rows[i];
      let [$matchIcon, $matchCol, $nomatchIcon, $nomatchCol] = $row.children;
      $matchIcon.innerHTML = '';
      $matchCol.innerHTML = $matchCol.dataset.val;
      $nomatchIcon.innerHTML = '';
      $nomatchCol.innerHTML = $nomatchCol.dataset.val;
    }
  } else if ($tableOrPre.tagName === "TABLE" && $tableOrPre.classList.contains('testsMatchGrpTbl')) {
    let $rows = $tableOrPre.children[2].children;
    for (let i = 0; i < $rows.length; i++) {
      let $row = $rows[i].children;
      for (let j = 0; j < $row.length; j++) {
        let $cell = $row[j];
        $cell.innerHTML = $cell.dataset.val;
        if (j >= 2)
          $cell.classList.add("matchToBeFound");
      }
    }
  } else {
    $tableOrPre.innerHTML = $tableOrPre.dataset.val;
  }
};

const saveOriginalValuesToData = ($tableOrPre) => {
  if ($tableOrPre.tagName === "TABLE" && $tableOrPre.classList.contains('testsYesNoTbl')) {
    let $rows = $tableOrPre.children[2].children;
    for (let i = 0; i < $rows.length; i++) {
      let $row = $rows[i];
      let [$matchIcon, $matchCol, $nomatchIcon, $nomatchCol] = $row.children;
      $matchCol.dataset.val = $matchCol.innerText;
      $nomatchCol.dataset.val = $nomatchCol.innerText;
    }
  } else if ($tableOrPre.tagName === "TABLE" && $tableOrPre.classList.contains('testsMatchGrpTbl')) {
    let $rows = $tableOrPre.children[2].children;
    for (let i = 0; i < $rows.length; i++) {
      let $row = $rows[i].children;
      for (let j = 0; j < $row.length; j++) {
        let $cell = $row[j];
        $cell.dataset.val = $cell.innerText;
        if (j >= 2) {
          $cell.classList.add('matchToBeFound');
        }
      }
    }
  } else {
    $tableOrPre.dataset.val = $tableOrPre.innerText;
  }
};

const setOnChangeListeners = () => {
  let $regInputs = document.getElementsByClassName("form-control");
  for (let i = 0; i < $regInputs.length; i++) {
    let $regInput = $regInputs[i];
    let $tableOrPre = $regInput.parentNode.parentNode.children[2].children[0];
    $regInput.addEventListener('input', prcRegexChange);
    saveOriginalValuesToData($tableOrPre);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  RegexColorizer.colorizeAll();
  setOnChangeListeners();
});
