// E2E tests para o simulador web. Cada teste:
// - executa um fluxo da UI
// - tira pelo menos um screenshot com nome estável (vira evidência no PR)
// - valida números importantes (custo ΔV, contadores de elementos)
//
// Os screenshots são anexados ao relatório HTML do Playwright e também
// salvos em `screenshots/` para upload como artifact pelo workflow.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOTS_DIR = path.join(__dirname, '..', '..', 'screenshots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function shoot(page, name, opts = {}) {
  const file = path.join(SHOTS_DIR, `${name}.png`);
  const buf = await page.screenshot({ fullPage: !!opts.fullPage, ...opts });
  fs.writeFileSync(file, buf);
  await test.info().attach(name, { body: buf, contentType: 'image/png' });
  return file;
}

// Polling manual — espera o app inicializar
async function waitAppReady(page, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const ok = await page.evaluate(() => {
      const inputs = document.querySelectorAll('#paramInputs input');
      const results = document.getElementById('results');
      return (
        typeof Plotly !== 'undefined' &&
        typeof PSO === 'function' &&
        inputs.length > 0 &&
        results && results.innerText.includes('ΔV')
      );
    });
    if (ok) return;
    await page.waitForTimeout(200);
  }
  throw new Error('App did not initialize within ' + maxMs + 'ms');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
});

test('01 - landing page completa', async ({ page }) => {
  await expect(page.locator('h1')).toContainText('Terra');
  await expect(page.locator('nav.tabs')).toBeVisible();
  // Todas as seções devem estar presentes
  for (const id of ['problema', 'metodo', 'simulador', 'otimizacao', 'exploracao', 'resultados', 'referencias']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await shoot(page, '01-landing-page', { fullPage: true });
});

test('02 - swing-by preset renderiza com ΔV ~ 8 km/s', async ({ page }) => {
  // Clica explicitamente no preset pra garantir valores conhecidos
  await page.click('button.preset-btn[data-preset="swingBy"]');
  await page.waitForTimeout(300);

  const resultsText = await page.locator('#results').innerText();
  // Verifica que tem ΔV total e está perto de 8 km/s
  const m = resultsText.match(/ΔV total:\s*([\d.]+)\s*km\/s/);
  expect(m, 'deveria mostrar ΔV total').not.toBeNull();
  const dv = parseFloat(m[1]);
  expect(dv).toBeGreaterThan(7);
  expect(dv).toBeLessThan(10);
  // 5 inputs no swing-by mode
  const nInputs = await page.locator('#paramInputs input').count();
  expect(nInputs).toBe(5);

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '02-swing-by-preset');
});

test('03 - transferência direta renderiza com ΔV ~ 5.7 km/s', async ({ page }) => {
  await page.click('#modeDirect');
  await page.waitForTimeout(300);
  await page.click('button.preset-btn[data-preset="direct"]');
  await page.waitForTimeout(300);

  const resultsText = await page.locator('#results').innerText();
  const m = resultsText.match(/ΔV total:\s*([\d.]+)\s*km\/s/);
  expect(m).not.toBeNull();
  const dv = parseFloat(m[1]);
  expect(dv).toBeGreaterThan(5);
  expect(dv).toBeLessThan(7);
  const nInputs = await page.locator('#paramInputs input').count();
  expect(nInputs).toBe(2);

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '03-direct-preset');
});

test('04 - editar parâmetro recalcula em tempo real', async ({ page }) => {
  await page.click('#modeDirect');
  await page.click('button.preset-btn[data-preset="direct"]');
  await page.waitForTimeout(300);

  const before = await page.locator('#results').innerText();
  const before_dv = parseFloat(before.match(/ΔV total:\s*([\d.]+)/)[1]);

  // Mudar fase de 180° para 90° (longe da janela) deve aumentar muito o custo
  const phaseInput = page.locator('#paramInputs input[data-idx="0"]');
  await phaseInput.fill('90');
  await phaseInput.dispatchEvent('input');
  await page.waitForTimeout(300);

  const after = await page.locator('#results').innerText();
  const after_dv = parseFloat(after.match(/ΔV total:\s*([\d.]+)/)[1]);
  expect(after_dv).toBeGreaterThan(before_dv);

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '04-parametro-fora-da-janela');
});

test('05 - PSO converge no modo direto', async ({ page }) => {
  await page.click('#modeDirect');
  await page.waitForTimeout(200);

  await page.fill('#psoParticles', '100');
  await page.fill('#psoIterations', '30');

  await page.click('#btnRun');
  // Aguarda a barra chegar em 100% ou o status indicar "finalizado"
  await page.waitForFunction(
    () => /finalizado/i.test(document.getElementById('psoStatus').innerText),
    { timeout: 30_000 }
  );

  const status = await page.locator('#psoStatus').innerText();
  const m = status.match(/melhor ΔV\s*=\s*([\d.]+)/);
  expect(m).not.toBeNull();
  const best = parseFloat(m[1]);
  expect(best).toBeLessThan(7); // direto deve convergir abaixo de 7

  await page.locator('#otimizacao').scrollIntoViewIfNeeded();
  await shoot(page, '05-pso-direto-convergido');
});

test('06 - PSO no swing-by produz convergência válida', async ({ page }) => {
  await page.click('#modeSwingBy');
  await page.waitForTimeout(200);

  await page.fill('#psoParticles', '80');
  await page.fill('#psoIterations', '25');
  await page.click('#btnRun');
  await page.waitForFunction(
    () => /finalizado/i.test(document.getElementById('psoStatus').innerText),
    { timeout: 45_000 }
  );

  const status = await page.locator('#psoStatus').innerText();
  expect(status).toMatch(/melhor ΔV/);

  await page.locator('#otimizacao').scrollIntoViewIfNeeded();
  await shoot(page, '06-pso-swing-by-convergido');
});

test('07 - porkchop plot é renderizado', async ({ page }) => {
  // O cálculo do porkchop é pesado (2500 avaliações de custo); damos mais tempo
  test.setTimeout(180_000);
  await page.locator('#exploracao').scrollIntoViewIfNeeded();
  await page.click('#btnPorkchop');
  // Plotly cria um <svg> dentro do div alvo quando renderiza
  await page.waitForFunction(
    () => {
      const root = document.getElementById('porkchop');
      return root && root.querySelector('svg') !== null;
    },
    { timeout: 150_000 }
  );
  await page.waitForTimeout(500);

  await page.locator('#exploracao').scrollIntoViewIfNeeded();
  await shoot(page, '07-porkchop-plot');
});

test('08 - viewport mobile renderiza sem layout quebrado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await waitAppReady(page);
  await shoot(page, '08-mobile-landing', { fullPage: true });

  // Scroll até o simulador e tira outro shot
  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shoot(page, '08-mobile-simulador');
});
