const {test, expect} = require('@playwright/test');

const RESULT_SELECTOR = '#content > section > div.example:nth-of-type(1) > div.optionAns';
const RESULT_SELECTOR2 = '#content > section > div.example:nth-of-type(2) > div.optionAns';
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

test('executes long python code and shows timeout', async ({page}) => {
    await page.goto('/htmls/demo.html');

    await openIde(page);
    await fillEditor(page, `from time import sleep
for i in range(10):
    print(i)
    sleep(1)`);
    await runOnTests(page);

    await page.waitForFunction((selector) => {
        const element = document.querySelector(selector);
        return element && element.textContent && element.textContent.includes('Timeout');
    }, RESULT_SELECTOR, {timeout: 18000});

    await page.waitForFunction((selector) => {
        const element = document.querySelector(selector);
        return element && element.textContent && element.textContent.includes('Timeout');
    }, RESULT_SELECTOR2, {timeout: 18000});

    const resultHtml = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? element.outerHTML : '';
    }, RESULT_SELECTOR);

    const resultHtml2 = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? element.outerHTML : '';
    }, RESULT_SELECTOR2);

    expect(resultHtml).toContain('Timeout');
    expect(resultHtml2).toContain('Timeout');
});
