const { chromium } = require('R:/sad_slt/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.addInitScript(() => {
      if (!localStorage.getItem('ahp_criteria')) {
        localStorage.setItem('ahp_criteria', JSON.stringify([
          'D1 Eficiência logística', 'D2 Econômica', 'D3 Segurança',
          'D4 Ambiental', 'D6 Viabilidade institucional e financeira',
        ]));
      }
    });
    await page.goto('http://127.0.0.1:8091/step3-metodo.html');
    const scales = page.locator('.saaty-scale');
    await scales.first().waitFor();
    assert.equal(await scales.count(), 10);

    assert.equal(await page.locator('.ahp-matrix-title').evaluate(el =>
      !el.closest('.ahp-matrix-wrap') && el.nextElementSibling.classList.contains('ahp-matrix-legend')), true);
    assert.match(await page.locator('.ahp-form-legend').textContent(), /No formulário, cada card/);

    await page.setViewportSize({ width: 320, height: 780 });
    assert.equal(await page.locator('.saaty-pair').first().evaluate(card => {
      const cardRect = card.getBoundingClientRect();
      const labels = [...card.querySelectorAll('.saaty-tick-desc')].map(el => el.getBoundingClientRect());
      return labels.every(rect => rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1) &&
        card.scrollWidth <= card.clientWidth + 1;
    }), true, 'Full ruler and endpoint names fit at 320px');
    await page.setViewportSize({ width: 1280, height: 900 });

    const help = page.locator('[data-help-button]');
    await scales.nth(0).press('ArrowLeft');
    await scales.nth(1).press('ArrowRight');
    await scales.nth(2).press('ArrowRight');
    await scales.nth(3).press('ArrowRight');
    await scales.nth(4).press('ArrowRight');
    assert.equal(await help.isVisible(), false, 'Help remains hidden below 60%');
    await scales.nth(5).press('ArrowLeft');
    assert.equal(await help.isVisible(), true, 'Help appears at 60% with unacceptable CR');
    assert.equal(await help.getAttribute('title'), 'Pedir ajuda ao sistema');

    const before = await page.evaluate(() => localStorage.getItem('ahp_pairwiseMatrix'));
    await help.click();
    const modal = page.locator('[data-help-modal]');
    assert.equal(await modal.isVisible(), true);
    assert.match(await page.locator('[data-help-summary]').textContent(), /6 de 10 pares \(60%\)/);
    assert.ok(await page.locator('.ahp-help-narrative__steps li').count() >= 3);
    assert.ok(await page.locator('.ahp-help-narrative__contrast').first().locator('strong').count() >= 5);
    assert.equal(await page.locator('.ahp-help-narrative__contrast').first().locator('p').count(), 2);
    assert.equal(await page.evaluate(() => localStorage.getItem('ahp_pairwiseMatrix')), before,
      'Opening help never changes judgments');

    const sizes = await page.evaluate(() => {
      const size = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
      return {
        title: size('#ahp-help-title'), section: size('.ahp-help-modal__body h3'),
        lead: size('.ahp-help-narrative__intro'), step: size('.ahp-help-narrative__steps li'),
        detail: size('.ahp-help-narrative__contrast'),
      };
    });
    assert.ok(sizes.title > sizes.section && sizes.section > sizes.lead &&
      sizes.lead >= sizes.step && sizes.step > sizes.detail);
    await page.keyboard.press('Escape');
    const floating = page.locator('[data-rc-floating]');
    assert.equal(await floating.evaluate(el => getComputedStyle(el).position), 'fixed',
      'Floating RC card is anchored to the viewport');
    const viewportPositionBeforeScroll = await floating.evaluate(el => el.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);
    assert.ok(Math.abs(await floating.evaluate(el => el.getBoundingClientRect().top) - viewportPositionBeforeScroll) < 1,
      'Floating RC card follows the viewport while the page scrolls');
    await floating.dispatchEvent('pointerdown', { clientX: 1000, clientY: 200, pointerId: 1, isPrimary: true });
    await page.evaluate(() => {
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: -2000, clientY: -2000, pointerId: 1, isPrimary: true }));
      document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, isPrimary: true }));
    });
    assert.equal(await floating.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.left >= 7 && rect.top >= 7 && rect.right <= innerWidth - 7 && rect.bottom <= innerHeight - 7;
    }), true, 'Floating RC card remains inside the viewport after dragging');
    await floating.focus();
    const transformBefore = await floating.evaluate(el => el.style.transform);
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await floating.evaluate(el => el.style.transform), transformBefore,
      'Floating RC card moves by keyboard');
    const resize = page.locator('[data-rc-resize]');
    await resize.focus();
    const scaleBefore = await floating.evaluate(el => el.style.getPropertyValue('--rc-scale'));
    await page.keyboard.press('ArrowUp');
    assert.notEqual(await floating.evaluate(el => el.style.getPropertyValue('--rc-scale')), scaleBefore,
      'Floating RC card resizes by keyboard');

    await page.evaluate(() => sessionStorage.setItem('ahp_pairwiseHandoff', '1'));
    await page.goto('http://127.0.0.1:8091/step4-comparacao.html');
    await page.locator('.saaty-scale').first().waitFor();
    assert.equal(await page.locator('.saaty-scale').count(), 10, 'Review page uses the same component');
    assert.equal(await page.locator('[data-help-button]').isVisible(), true,
      'Confirmed-pair progress remains associated with the same criteria');
    assert.equal(await page.locator('.ahp-pairwise-intro').first().evaluate(el => getComputedStyle(el).textAlign),
      'justify');
    await page.reload();
    await page.waitForTimeout(500);
    const reloadState = await page.evaluate(() => ({
      url: location.href,
      criteria: localStorage.getItem('ahp_criteria'),
      pairwiseHost: Boolean(document.querySelector('[data-ahp-pairwise]')),
      scales: document.querySelectorAll('.saaty-scale').length,
    }));
    assert.equal(reloadState.scales, 10, 'Reload rebuilds a clean form: ' + JSON.stringify(reloadState));
    assert.equal(await page.locator('[data-help-button]').isVisible(), false,
      'Reload always clears confirmed pairs and consistency help');
    assert.equal(await page.locator('.saaty-scale').evaluateAll(items =>
      items.every(item => item.getAttribute('aria-valuenow') === '4')), true,
      'Reload always restores every comparison to equality');
    assert.equal(await page.evaluate(() => {
      const matrix = JSON.parse(localStorage.getItem('ahp_pairwiseMatrix'));
      return matrix.every((row, i) => row.every((value, j) => value === 1));
    }), true, 'Reload stores a clean matrix');
    assert.deepEqual(errors, []);
    console.log('PASS: SICARD pairwise improvements ported: mobile ruler, tabs, 60% help, narrative and typography.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
