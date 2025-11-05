const {test, expect} = require('@playwright/test');

const RESULT_SELECTOR = '#content > section > div.example:nth-of-type(1) > div.optionAns';

async function openIde(page) {
    const ideToggle = page.locator('web-ide .web-ide__toggle', {hasText: 'IDE'}).first();
    await ideToggle.waitFor({state: 'visible'});
    await ideToggle.click();
    await page.locator('.ace_content').first().waitFor({state: 'visible'});
    await page.locator('.ace_text-input').first().waitFor();
}

async function fillEditor(page, code) {
    const editor = page.locator('.ace_content').first();
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(code);
}


async function runOnTests(page) {
    const runButton = page.locator('button.ideButton', {hasText: 'Run on tests'}).first();
    await runButton.waitFor({state: 'visible'});
    await runButton.click();
}

test('executes python code and shows green result', async ({page}) => {
    await page.goto('/htmls/demo.html');

    await openIde(page);
    await fillEditor(page, 'print(int(input()) + 1)');
    await runOnTests(page);

    await page.waitForFunction((selector) => {
        const element = document.querySelector(selector);
        return element && element.textContent && element.textContent.trim() === '2';
    }, RESULT_SELECTOR, {timeout: 16000});

    const resultHtml = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? element.outerHTML : '';
    }, RESULT_SELECTOR);

    expect(resultHtml).toBe('<div class="optionAns"><div style="line-height: 1.3; white-space: pre-wrap; color: green;">2<br></div></div>');
});

test('formats python code in the editor', async ({page}) => {
    await page.goto('/htmls/demo.html');

    await openIde(page);
    await page.evaluate(() => {
        const ide = window.__lastPythonIDE;
        if (ide && !ide.__formatPatched) {
            let current = ide.isFormatting || false;
            Object.defineProperty(ide, 'isFormatting', {
                configurable: true,
                get() {
                    return current;
                },
                set(value) {
                    current = value;
                    window.__formatStates = window.__formatStates || [];
                    window.__formatStates.push(value);
                }
            });
            ide.__formatPatched = true;
        }
        window.__formatStates = [];
    });

    const messyCode = `from   time    import   (sleep)
for    i in range ( 10        ) :
      print( i     )
      sleep  ( 1  );`;

    await fillEditor(page, messyCode);

    const formatButton = page.locator('button.ideButton', {hasText: 'Format'}).first();
    await formatButton.waitFor({state: 'visible'});
    await formatButton.click();

    const expectedFormatted = 'from time import sleep\n\nfor i in range(10):\n    print(i)\n    sleep(1)\n';

    await page.waitForFunction(() => Array.isArray(window.__formatStates) && window.__formatStates.includes(true), {}, {timeout: 16_000});

    const outcomeHandle = await page.waitForFunction((expected) => {
        const ide = window.__lastPythonIDE;
        if (!ide || !ide.buttons || !ide.buttons['$formatBtn']) {
            return false;
        }
        const button = ide.buttons['$formatBtn'];
        if (!button.disabled && button.textContent === expected.label) {
            const editorValue = ide.aceEditor ? ide.aceEditor.getValue() : '';
            return {status: 'formatted', value: editorValue};
        }
        return false;
    }, {label: 'Format', expected: expectedFormatted}, {timeout: 40_000});

    const {value} = await outcomeHandle.jsonValue();
    await expect(typeof value === 'string' && value.length > 0).toBeTruthy();
});
