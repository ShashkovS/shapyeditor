import errors from './errors-translations.js';

/**
 * Функция для перевода стандартного текста питоновской ошибки.
 * Делает 3 вещи:
 * - достает тип и содержание ошибки
 * - (где нужно) достает значение переменной и номер строки
 * - переводит на русский все остальное
 * @param {*} errorMessage - текст ошибки при выполнении питоновского кода
 * @return {Object} line - номер строки, texts - массив текстов для вывода, isTranslated - ошибка переведена?
 */
export const translateError = (errorMessage) => {
  console.warn('errorMessage', errorMessage);
  errorMessage = errorMessage.toString();
  // сообщение ошибки состоит из типа и содержания ошибки, разделенных ':'
  let match = errorMessage.match(/^ *(\w+):\s*(.*)$/m);
  if (!match) {
    return {texts: [errorMessage], isTranslated: false};
  }
  const [, errorType, errorContent] = match;
  const lineMatch = errorMessage.match(/  File "<(?:exec|input)>", line (\d+)/);
  let line = lineMatch[1];
  // eslint-disable-next-line radix
  if (!parseInt(line)) line = 1;

  // каждому типу ошибки может подходить несколько вариантов текста (см. регулярку в конфиге)
  for (const type of errors[errorType] || []) { // Может оказаться и пусто
    // ищем нужный конфиг по регулярке, которая матчит текст ошибки
    // eslint-disable-next-line no-cond-assign
    if (match = errorContent.match(type.reg)) {
      // ru - функция для русификации содержания ошибки; enWhen, enFix - готовые константы, либо функции
      let {en, enWhen, enFix} = type;
      const parms = match.slice(1); // Передаём все параметры, кроме нулевого
      const textToPrint = en(...parms);
      if (typeof enWhen === 'function') enWhen = enWhen(...parms);
      if (typeof enFix === 'function') enFix = enFix(...parms);
      // let line = match[match.length - 1]; // Номер строки всегда последний параметр
      return {line, texts: [errorMessage, '', textToPrint, enWhen, enFix], isTranslated: true};
    }
  }
  // match = errorContent.match(/^(.*) ?on line (\d+)$/i);
  // const textToPrint = match ? match[1] : errorContent;
  // // Конфига нет. Но, может, ошибка и так переведена?
  // if (/[а-яёА-ЯЁ]{3,}/.test(textToPrint)) {
  //   return {line, texts: [textToPrint], isTranslated: true};
  // }
  // конфига для такой ошибки нет
  return {line, texts: [errorMessage], isTranslated: false};
};
