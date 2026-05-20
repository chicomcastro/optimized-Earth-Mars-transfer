// E2E tests para o simulador web. Cada teste:
// - executa um fluxo da UI
// - tira pelo menos um screenshot com nome estável (vira evidência no PR)
// - valida números importantes (ΔV, contadores, ações)

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

async function waitAppReady(page, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const ok = await page.evaluate(() => {
      const controls = document.querySelectorAll('#paramInputs .param-control');
      const cost = document.getElementById('costValue');
      return (
        typeof Plotly !== 'undefined' &&
        typeof PSO === 'function' &&
        controls.length > 0 &&
        cost && cost.textContent !== '—' && cost.textContent.length > 0
      );
    });
    if (ok) return;
    await page.waitForTimeout(200);
  }
  throw new Error('App did not initialize within ' + maxMs + 'ms');
}

async function getCost(page) {
  const txt = await page.locator('#costValue').textContent();
  return parseFloat(txt.trim());
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
});

test('01 - landing page completa', async ({ page }) => {
  await expect(page.locator('h1')).toContainText('Terra');
  for (const id of ['simulador', 'exploracao', 'otimizacao', 'problema', 'metodo', 'resultados', 'referencias']) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  await shoot(page, '01-landing-page', { fullPage: true });
});

test('02 - swing-by preset (ΔV ~ 8 km/s)', async ({ page }) => {
  await page.click('button.preset-btn[data-preset="swingBy"]');
  await page.waitForTimeout(300);

  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(7);
  expect(dv).toBeLessThan(10);
  const nControls = await page.locator('#paramInputs .param-control').count();
  expect(nControls).toBe(5);

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '02-swing-by-preset');
});

test('03 - direta (ΔV ~ 5.7 km/s)', async ({ page }) => {
  // Segmented control: usa label do iOS-style (input está escondido)
  await page.click('label[for="modeDirect"]');
  await page.waitForTimeout(200);
  await page.click('button.preset-btn[data-preset="direct"]');
  await page.waitForTimeout(300);

  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(5);
  expect(dv).toBeLessThan(7);
  const nControls = await page.locator('#paramInputs .param-control').count();
  expect(nControls).toBe(2);

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '03-direct-preset');
});

test('04 - editar slider recalcula em tempo real', async ({ page }) => {
  await page.click('label[for="modeDirect"]');
  await page.click('button.preset-btn[data-preset="direct"]');
  await page.waitForTimeout(300);

  const before = await getCost(page);

  // Move o slider de fase de Marte para 90° (longe da janela)
  await page.evaluate(() => {
    const slider = document.querySelector('#paramInputs .param-control[data-idx="0"] .pc-slider');
    slider.value = '90';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const after = await getCost(page);
  expect(after).toBeGreaterThan(before);

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '04-parametro-fora-da-janela');
});

test('05 - PSO direto converge', async ({ page }) => {
  await page.click('label[for="modeDirect"]');
  await page.waitForTimeout(200);

  await page.fill('#psoParticles', '100');
  await page.fill('#psoIterations', '30');

  await page.click('#btnRun');
  await page.waitForFunction(
    () => /finalizado/i.test(document.getElementById('psoStatus').textContent),
    { timeout: 30_000 }
  );

  const status = await page.locator('#psoStatus').textContent();
  const m = status.match(/melhor ΔV\s*=\s*([\d.]+)/);
  expect(m).not.toBeNull();
  expect(parseFloat(m[1])).toBeLessThan(7);

  await page.locator('#otimizacao').scrollIntoViewIfNeeded();
  await shoot(page, '05-pso-direto-convergido');
});

test('06 - PSO swing-by converge', async ({ page }) => {
  await page.click('label[for="modeSwingBy"]');
  await page.waitForTimeout(200);

  await page.fill('#psoParticles', '80');
  await page.fill('#psoIterations', '25');
  await page.click('#btnRun');
  await page.waitForFunction(
    () => /finalizado/i.test(document.getElementById('psoStatus').textContent),
    { timeout: 45_000 }
  );

  const status = await page.locator('#psoStatus').textContent();
  expect(status).toMatch(/melhor ΔV/);

  await page.locator('#otimizacao').scrollIntoViewIfNeeded();
  await shoot(page, '06-pso-swing-by-convergido');
});

test('07 - porkchop renderiza', async ({ page }) => {
  test.setTimeout(180_000);
  await page.locator('#exploracao').scrollIntoViewIfNeeded();
  await page.click('#btnPorkchop');
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

test('08 - porkchop click aplica params no simulador', async ({ page }) => {
  test.setTimeout(180_000);
  await page.locator('#exploracao').scrollIntoViewIfNeeded();
  await page.click('#btnPorkchop');
  await page.waitForFunction(
    () => document.getElementById('porkchop')?.querySelector('svg') !== null,
    { timeout: 150_000 }
  );
  await page.waitForTimeout(800);

  // Simula um click via Plotly API direto (mais determinístico que click em SVG)
  await page.evaluate(() => {
    const div = document.getElementById('porkchop');
    const ev = { points: [{ x: 180, y: 260, z: 5.7 }] };
    // emite o evento que o handler registrou
    div.emit('plotly_click', ev);
  });
  await page.waitForTimeout(800);

  // Após o click, o modo deve estar em "direta" e o cost ~ 5.7
  const direct = await page.evaluate(() => document.getElementById('modeDirect').checked);
  expect(direct).toBe(true);
  const dv = await getCost(page);
  expect(dv).toBeLessThan(7);

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shoot(page, '08-porkchop-click-aplicado');
});

test('09 - navegação muda seção ativa', async ({ page }) => {
  // Click no link do PSO no topNav
  await page.click('nav.tabs a[data-target="otimizacao"]');
  await page.waitForTimeout(500);
  const active = await page.locator('nav.tabs a.active[data-target="otimizacao"]').count();
  expect(active).toBeGreaterThan(0);
});

test('10 - viewport mobile - landing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
  await shoot(page, '10-mobile-landing', { fullPage: true });
});

test('11 - viewport mobile - simulador', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
  // Já abre no simulador (primeira seção)
  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shoot(page, '11-mobile-simulador');
});

test('12 - viewport mobile - bottom nav visível', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
  await expect(page.locator('nav.bottom-nav')).toBeVisible();
  await shoot(page, '12-mobile-bottom-nav');
});

test('13 - viewport ultra-estreito (320px)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shoot(page, '13-mobile-320px');
});

test('15 - mobile - trajetória renderiza com legend horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  // Scroll para mostrar o plot completamente
  await page.evaluate(() => {
    document.querySelector('#plot').scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);
  await shoot(page, '15-mobile-trajetoria');
});

test('16 - mobile - porkchop click flow', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);

  // Vai pra exploração via bottom nav
  await page.click('nav.bottom-nav a[data-target="exploracao"]');
  await page.waitForTimeout(700);
  await page.click('#btnPorkchop');
  await page.waitForFunction(
    () => document.getElementById('porkchop')?.querySelector('svg') !== null,
    { timeout: 150_000 }
  );
  await page.waitForTimeout(800);
  await shoot(page, '16-mobile-porkchop-gerado');

  // Click no porkchop
  await page.evaluate(() => {
    document.getElementById('porkchop').emit('plotly_click', {
      points: [{ x: 180, y: 260, z: 5.7 }],
    });
  });
  await page.waitForTimeout(1200);
  await shoot(page, '16b-mobile-porkchop-aplicado');
});

test('14 - PSO mostra convergência completa', async ({ page }) => {
  await page.click('label[for="modeDirect"]');
  await page.fill('#psoParticles', '50');
  await page.fill('#psoIterations', '40');
  await page.click('#btnRun');
  await page.waitForFunction(
    () => /finalizado/i.test(document.getElementById('psoStatus').textContent),
    { timeout: 30_000 }
  );
  await page.waitForTimeout(400);

  // O plot de convergência deve ter pontos > 5 (mais de uma iter visível)
  const tracePoints = await page.evaluate(() => {
    const div = document.getElementById('convergence');
    const traces = div.data || (div._fullData ? div._fullData : null);
    return traces && traces[0] && traces[0].x ? traces[0].x.length : 0;
  });
  expect(tracePoints).toBeGreaterThanOrEqual(10);

  await page.locator('#otimizacao').scrollIntoViewIfNeeded();
  await shoot(page, '14-pso-convergencia-completa');
});
