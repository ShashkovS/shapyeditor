"use strict";
// const skulptUrl = location.origin + '/webpyide/skulpt/skulpt.min.js';
const skulptUrl = location.origin + '/s/skulpt/skulpt.min.js';
importScripts(skulptUrl);
Sk.configure({
  __future__: Sk.python3,
});


const keywordNotInBrackets = /^.\b(as|assert|async|break|class|continue|def|del|except|finally|from|global|nonlocal|pass|raise|return|try|while|with|yield)\b/s;
/**
 * Проверка парности скобок и кавычек
 * @param origText
 * @returns {{row: number, text: string}}
 */
const checkPairs = (origText) => {
  // Сначала заменяем экранированные слеши и кавычки на что-то «безопасное»
  let text = origText.replace(/\\\\|\\['"]/g, '--');
  // Теперь экранированных символов не бывает
  const stack = [];
  let stingClose = null;
  let brackClose = null;
  let char;
  let curRow = 1;
  let insideComment = false;
  for (let pos = 0; pos < text.length; pos += 1) {
    char = text[pos];
    if (insideComment) {
      insideComment = char !== '\n';
    } else if (stingClose === "'" || stingClose === '"') {
      if (char === stingClose) {
        stingClose = null;
        stack.pop();
      } else if (char === '\n') {
        return {
          row: curRow,
          text: `Строчка ${curRow} закончилась, а кавычки «${stingClose}» всё нет`,
        };
      }
    } else if (stingClose === "'''" || stingClose === '"""') {
      if (text.slice(pos, pos + 3) === stingClose) {
        stingClose = null;
        stack.pop();
        pos += 2;
      }
    } else if (char === '"') {
      stingClose = text.slice(pos, pos + 3) === '"""' ? '"""' : '"';
      stack.push([stingClose, curRow]);
      pos += stingClose.length - 1;
    } else if (char === "'") {
      stingClose = text.slice(pos, pos + 3) === "'''" ? "'''" : "'";
      stack.push([stingClose, curRow]);
      pos += stingClose.length - 1;
    } else if (char === brackClose) {
      stack.pop();
      let prev = stack[stack.length - 1];
      brackClose = prev ? prev[0] === '[' ? ']' : prev[0] === '{' ? '}' : ')' : null;
    } else if (char === '[') {
      stack.push([char, curRow]);
      brackClose = ']';
    } else if (char === '{') {
      stack.push([char, curRow]);
      brackClose = '}';
    } else if (char === '(') {
      stack.push([char, curRow]);
      brackClose = ')';
    } else if (char === ']' || char === '}' || char === ')') {
      if (stack.length === 0) {
        return {
          row: curRow,
          text: `Непарные скобки! Все необходимые скобки уже закрыты, но в строке ${curRow} появилась лишняя закрывающая «${char}»`,
        };
      } else {
        return {
          row: curRow,
          text: `Непарные скобки! Ожидалось «${brackClose}» (открыта в строке ${stack[stack.length - 1][1]}), а пришло «${char}» в строке ${curRow}`,
        };
      }
    } else if (char === '#') {
      insideComment = true;
    } else if (stack.length > 0 && char >= 'a' && char <= 'z' && !(text[pos - 1].toLowerCase() >= 'a' && text[pos].toLowerCase() <= 'z')) {
      const match = keywordNotInBrackets.exec(text.slice(pos - 1, pos + 11));
      if (match) {
        return {
          row: curRow,
          text: `Непарные скобки! Не хватает «${stack.reverse().map(br => br[0] === '[' ? ']' : br[0] === '{' ? '}' : ')').join('')}» перед «${match[1]}»`,
        };
      }
    }
    curRow += +(char === '\n');
  }
  if (stingClose) {
    return {
      row: curRow,
      text: `В строке ${stack[stack.length - 1][1]} с «${stingClose}» началась строка и так и не закончилась.`,
    };
  } else if (stack.length === 1) {
    return {
      row: curRow,
      text: `Непарные скобки! Не хватает «${brackClose}» (скобка открыта в строке ${stack[0][1]})`,
    };
  } else if (stack.length > 0) {
    return {
      row: curRow,
      text: `Непарные скобки! Не хватает «${stack.reverse().map(br => br[0] === '[' ? ']' : br[0] === '{' ? '}' : ')').join('')}»`,
    };
  }
};


const pythonValidation = (pySource, changedRow) => {
  const start = new Date();
  const errors = [];
  const brackTest = checkPairs(pySource);
  if (brackTest) {
    errors.push({
      row: brackTest.row - 1,
      column: null,
      text: brackTest.text,
      type: "error",
    });
  } else {
    try {
      Sk.parse('', pySource);
    } catch (e) {
      let text;
      if (e instanceof Sk.builtin.IndentationError) {
        text = 'IndentationError: ' + e.args.v[0].v;
      } else if (e instanceof Sk.builtin.SyntaxError) {
        const skMsg = e.args.v[0].v;
        if (skMsg === 'bad input' || skMsg === "bad token T_OP") {
          try {
            const badCode = e.args.v[3][2].trim();
            text = `Вот этот код какой-то неправильный: «${badCode}»`;
          } catch (e) {
            text = 'В этой строчке что-то невалидное';
          }
        } else if (skMsg === 'unindent does not match any outer indentation level') {
          text = 'Отступ некорректный, не соответсвует коду выше.';
        }
      } else {
        console.error(JSON.stringify(e.args));
        console.error(e);
        throw e;
      }
      const row = e.traceback[0].lineno - 1;
      if (row !== changedRow) errors.push({row, text, type: "error"});
    }
  }
  return errors;
};
