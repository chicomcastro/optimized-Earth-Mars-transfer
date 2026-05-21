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
    () => document.getElementById('psoResult').classList.contains('show'),
    { timeout: 30_000 }
  );

  // Lê o ΔV do card de resultado
  const dvText = await page.locator('#psoResult .psr-value').textContent();
  const dv = parseFloat(dvText);
  expect(dv).toBeLessThan(7);

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
    () => document.getElementById('psoResult').classList.contains('show'),
    { timeout: 45_000 }
  );

  const dvText = await page.locator('#psoResult .psr-value').textContent();
  expect(parseFloat(dvText)).toBeGreaterThan(0);

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

test('29 - porkchop seletor lista 5 explorações', async ({ page }) => {
  const opts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#porkchopExploration option')).map((o) => o.value)
  );
  expect(opts).toEqual([
    'direct-phase-time',
    'sb-phases',
    'sb-times',
    'sb-venus-time',
    'sb-rp-venus',
  ]);
});

test('30 - trocar exploração atualiza labels dos eixos e parâmetros fixos', async ({ page }) => {
  await page.selectOption('#porkchopExploration', 'sb-phases');
  await page.waitForTimeout(200);

  expect(await page.locator('#porkchopXLabel').textContent()).toContain('Marte');
  expect(await page.locator('#porkchopYLabel').textContent()).toContain('Vênus');

  // Deve mostrar 3 pílulas de parâmetros fixos (T-V, V-M, r_p)
  const fixedCount = await page.locator('#porkchopFixed .fixed-pill').count();
  expect(fixedCount).toBe(3);
});

test('31 - porkchop swing-by gera plot com range custom', async ({ page }) => {
  test.setTimeout(120_000);
  await page.selectOption('#porkchopExploration', 'sb-times');
  await page.waitForTimeout(200);

  // Customiza range: T-V em [60, 160], V-M em [60, 220]
  await page.fill('#porkchopXMin', '60');
  await page.fill('#porkchopXMax', '160');
  await page.fill('#porkchopYMin', '60');
  await page.fill('#porkchopYMax', '220');
  await page.fill('#porkchopN', '25');

  await page.locator('#exploracao').scrollIntoViewIfNeeded();
  await page.click('#btnPorkchop');
  await page.waitForFunction(
    () => document.getElementById('porkchop')?.querySelector('svg') !== null,
    { timeout: 90_000 }
  );
  await page.waitForTimeout(500);

  // Confere ranges no plot
  const ranges = await page.evaluate(() => {
    const div = document.getElementById('porkchop');
    const lay = div.layout || div._fullLayout;
    return { x: lay.xaxis.range || [lay.xaxis.autorange], y: lay.yaxis.range || [lay.yaxis.autorange] };
  });
  expect(ranges.x[0]).toBeGreaterThanOrEqual(55);
  expect(ranges.x[1]).toBeLessThanOrEqual(165);

  await shoot(page, '31-porkchop-swingby-times');
});

test('33 - porkchop plot mostra labels nos eixos X e Y', async ({ page }) => {
  test.setTimeout(120_000);
  await page.selectOption('#porkchopExploration', 'direct-phase-time');
  await page.waitForTimeout(150);
  await page.fill('#porkchopN', '20');
  await page.click('#btnPorkchop');
  await page.waitForFunction(
    () => document.getElementById('porkchop')?.querySelector('svg') !== null,
    { timeout: 90_000 }
  );
  await page.waitForTimeout(500);

  // Axis titles devem estar no DOM
  const xTitle = await page.evaluate(() => {
    const div = document.getElementById('porkchop');
    return div._fullLayout?.xaxis?.title?.text;
  });
  const yTitle = await page.evaluate(() => {
    const div = document.getElementById('porkchop');
    return div._fullLayout?.yaxis?.title?.text;
  });
  expect(xTitle).toContain('Marte');
  expect(yTitle).toContain('T-M');

  await page.locator('#exploracao').scrollIntoViewIfNeeded();
  await shoot(page, '33-porkchop-axis-labels');
});

test('34 - explicação aparece e muda por exploração', async ({ page }) => {
  await page.selectOption('#porkchopExploration', 'direct-phase-time');
  await page.waitForTimeout(150);
  const t1 = await page.locator('#porkchopExplain').textContent();
  expect(t1).toMatch(/Hohmann|259/i);

  await page.selectOption('#porkchopExploration', 'sb-rp-venus');
  await page.waitForTimeout(150);
  const t2 = await page.locator('#porkchopExplain').textContent();
  expect(t2).toMatch(/r_p|deflexão|sobrevoo/i);
  expect(t1).not.toBe(t2);
});

test('32 - reset ranges volta aos defaults', async ({ page }) => {
  await page.selectOption('#porkchopExploration', 'sb-phases');
  await page.waitForTimeout(200);
  await page.fill('#porkchopXMin', '90');
  await page.fill('#porkchopXMax', '270');

  await page.click('#porkchopReset');
  await page.waitForTimeout(150);
  expect(await page.locator('#porkchopXMin').inputValue()).toBe('0');
  expect(await page.locator('#porkchopXMax').inputValue()).toBe('360');
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

test('18 - shadow toggle mostra posição inicial de Marte e Vênus', async ({ page }) => {
  await page.click('button.preset-btn[data-preset="swingBy"]');
  await page.waitForTimeout(300);
  await page.check('#toggleShadow');
  await page.waitForTimeout(400);

  const traceNames = await page.evaluate(() => {
    const data = document.getElementById('plot').data;
    return data.map((d) => d.name);
  });
  expect(traceNames).toContain('Marte (t=0)');
  expect(traceNames).toContain('Vênus (t=0)');
  expect(traceNames).toContain('Terra (t=0)');

  await page.evaluate(() => document.getElementById('plot').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await shoot(page, '18-shadow-positions');
});

test('19 - animation player: scrub muda posição da nave', async ({ page }) => {
  await page.click('button.preset-btn[data-preset="direct"]');
  await page.waitForTimeout(300);

  // Vai pro meio da missão via scrubber
  await page.evaluate(() => {
    const s = document.getElementById('animTime');
    s.value = '500';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const traceNames = await page.evaluate(() => {
    const data = document.getElementById('plot').data;
    return data.map((d) => d.name);
  });
  expect(traceNames).toContain('Nave');
  expect(traceNames).toContain('Trajetória');

  // Posição da nave a meio caminho não deve coincidir com a Terra
  const craftPos = await page.evaluate(() => {
    const data = document.getElementById('plot').data;
    const craft = data.find((d) => d.name === 'Nave');
    return craft ? { x: craft.x[0], y: craft.y[0] } : null;
  });
  expect(craftPos).not.toBeNull();
  expect(Math.hypot(craftPos.x - 1, craftPos.y)).toBeGreaterThan(0.3);

  await page.evaluate(() => document.getElementById('plot').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await shoot(page, '19-anim-meio-da-missao');
});

test('20 - referencial geocêntrico: Terra fica fixa na origem', async ({ page }) => {
  await page.click('button.preset-btn[data-preset="direct"]');
  await page.waitForTimeout(300);
  await page.click('label[for="frameGeo"]');
  await page.waitForTimeout(400);

  const earthPos = await page.evaluate(() => {
    const data = document.getElementById('plot').data;
    const e = data.find((d) => d.name === 'Terra');
    return e ? { x: e.x[0], y: e.y[0] } : null;
  });
  expect(earthPos).not.toBeNull();
  // Em geo, Terra fica na origem (0, 0)
  expect(Math.abs(earthPos.x)).toBeLessThan(0.01);
  expect(Math.abs(earthPos.y)).toBeLessThan(0.01);

  await page.evaluate(() => document.getElementById('plot').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await shoot(page, '20-frame-geocentrico');
});

test('21 - referencial sinódico: trajetória diferente do helio', async ({ page }) => {
  await page.click('button.preset-btn[data-preset="direct"]');
  await page.waitForTimeout(300);
  await page.click('label[for="frameSyn"]');
  await page.waitForTimeout(400);

  const traceNames = await page.evaluate(() => {
    const data = document.getElementById('plot').data;
    return data.map((d) => d.name);
  });
  // No sinódico não temos as órbitas circulares; em vez disso temos "Caminho ..."
  expect(traceNames.some((n) => n.startsWith('Caminho'))).toBe(true);

  await page.evaluate(() => document.getElementById('plot').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await shoot(page, '21-frame-sinodico');
});

test('22 - play da animação avança o tempo', async ({ page }) => {
  await page.click('button.preset-btn[data-preset="direct"]');
  await page.waitForTimeout(300);
  // Reset
  await page.click('#animReset');
  await page.waitForTimeout(200);
  // Play
  await page.click('#animPlay');
  await page.waitForTimeout(1500);
  // O tempo deve ter avançado a partir de 0
  const t = await page.evaluate(() => Anim.t);
  expect(t).toBeGreaterThan(0);
  // Para a animação
  await page.click('#animPlay');
  await shoot(page, '22-anim-playing');
});

test('23 - input partículas aceita > 5000 sem tooltip de erro', async ({ page }) => {
  // O input não deve ter o attr max
  const hasMax = await page.evaluate(() => {
    const el = document.getElementById('psoParticles');
    return el.hasAttribute('max');
  });
  expect(hasMax).toBe(false);

  // Aceita 20000 sem reclamar
  await page.fill('#psoParticles', '20000');
  const valid = await page.evaluate(() => document.getElementById('psoParticles').checkValidity());
  expect(valid).toBe(true);
});

test('24 - PSO mostra card de resultado destacado ao final', async ({ page }) => {
  await page.click('label[for="modeDirect"]');
  await page.fill('#psoParticles', '60');
  await page.fill('#psoIterations', '20');
  await page.click('#btnRun');
  await page.waitForFunction(
    () => document.getElementById('psoResult').classList.contains('show'),
    { timeout: 30_000 }
  );

  // Card deve mostrar ΔV, parâmetros e nota
  const cardText = await page.locator('#psoResult').textContent();
  expect(cardText).toMatch(/melhor encontrado/i);
  expect(cardText).toMatch(/km\/s/);
  expect(cardText).toMatch(/parâmetros ótimos/i);
  expect(cardText).toMatch(/fase de Marte/);
  expect(cardText).toMatch(/sub-?ótimo|não.* (?:ótimo|garantido)/i);

  await page.evaluate(() => document.getElementById('psoResult').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  await shoot(page, '24-pso-result-card');
});

test('25 - segundo PSO mostra delta vs anterior', async ({ page }) => {
  await page.click('label[for="modeDirect"]');
  await page.fill('#psoParticles', '60');
  await page.fill('#psoIterations', '20');
  await page.click('#btnRun');
  await page.waitForFunction(
    () => document.getElementById('psoResult').classList.contains('show'),
    { timeout: 30_000 }
  );

  // Roda de novo
  await page.click('#btnRun');
  await page.waitForFunction(
    () => document.getElementById('psoResult').classList.contains('show'),
    { timeout: 30_000 }
  );
  await page.waitForTimeout(400);
  const cardText = await page.locator('#psoResult').textContent();
  // Deve ter um delta ('=' ou ▼/▲)
  expect(cardText).toMatch(/[=▼▲]/);
});

test('26 - fase Marte 0° == fase Marte 360° (modular)', async ({ page }) => {
  // Usa modo swing-by pra não ser degenerado nas duas extremidades
  await page.click('button.preset-btn[data-preset="swingBy"]');
  await page.waitForTimeout(300);
  // Set fase Marte = 0
  await page.evaluate(() => {
    const s = document.querySelector('#paramInputs .param-control[data-idx="0"] .pc-slider');
    s.value = '0';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const cost0Text = await page.locator('#costValue').textContent();

  // Set fase Marte = 360
  await page.evaluate(() => {
    const s = document.querySelector('#paramInputs .param-control[data-idx="0"] .pc-slider');
    s.value = '360';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const cost360Text = await page.locator('#costValue').textContent();

  // Ambos devem ser o mesmo valor (modulo 2π) — texto ou ambos ∞
  expect(cost0Text).toBe(cost360Text);
});

test('27 - configuração degenerada mostra warning', async ({ page }) => {
  await page.click('label[for="modeDirect"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const s = document.querySelector('#paramInputs .param-control[data-idx="0"] .pc-slider');
    s.value = '0';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  // Warning visível (cost pode ser ∞ ou número grande)
  await expect(page.locator('#costWarn')).toBeVisible();
  // costDisplay tem classe 'degenerate'
  await expect(page.locator('#costDisplay.degenerate')).toBeVisible();

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '27-warning-degenerado');
});

test('28 - tooltip do parâmetro abre ao clicar no "?"', async ({ page }) => {
  await page.click('button.preset-btn[data-preset="direct"]');
  await page.waitForTimeout(300);
  // Clica no primeiro ícone de info
  await page.locator('#paramInputs .pc-info').first().click();
  await page.waitForTimeout(300);
  const tip = page.locator('.tooltip-pop');
  await expect(tip).toBeVisible();
  const text = await tip.textContent();
  expect(text).toMatch(/posição angular|chegada/i);

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '28-tooltip-parametro');
});

test('35 - porkchop direto agora é contínuo após 180° (long-way prógrado)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.selectOption('#porkchopExploration', 'direct-phase-time');
  await page.fill('#porkchopN', '40');
  await page.click('#btnPorkchop');
  await page.waitForFunction(
    () => document.getElementById('porkchop')?.querySelector('svg') !== null,
    { timeout: 90_000 }
  );
  await page.waitForTimeout(500);

  // Verifica continuidade: ΔV em 179, 180, 181 devem ser quase iguais
  const sample = await page.evaluate(() => {
    const z = document.getElementById('porkchop').data[0].z;
    const x = document.getElementById('porkchop').data[0].x;
    const y = document.getElementById('porkchop').data[0].y;
    // Acha a coluna mais próxima de 180 e a linha mais próxima de t=259
    let xi = x.reduce((a, v, i) => (Math.abs(v - 180) < Math.abs(x[a] - 180) ? i : a), 0);
    let yj = y.reduce((a, v, j) => (Math.abs(v - 259) < Math.abs(y[a] - 259) ? j : a), 0);
    return { left: z[yj][xi - 2], mid: z[yj][xi], right: z[yj][xi + 2] };
  });
  // Continuidade: passo de fase ~9° → ΔV varia pouco
  expect(Math.abs(sample.left - sample.mid)).toBeLessThan(2);
  expect(Math.abs(sample.right - sample.mid)).toBeLessThan(2);

  await shoot(page, '35-porkchop-continuo');
});

test('17 - rotação CCW: Marte a 110° vai pro 2º quadrante (cima-esquerda)', async ({ page }) => {
  await page.click('label[for="modeDirect"]');
  await page.waitForTimeout(200);
  // Aplica fase=110°, t=213d
  await page.evaluate(() => {
    const setSlider = (idx, v) => {
      const s = document.querySelector(`#paramInputs .param-control[data-idx="${idx}"] .pc-slider`);
      s.value = String(v);
      s.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setSlider(0, 110);
    setSlider(1, 213);
  });
  await page.waitForTimeout(400);

  // Marte deve estar no quadrante 2 (x<0, y>0); leitura via Plotly data
  const marsPos = await page.evaluate(() => {
    const div = document.getElementById('plot');
    const data = div.data || div._fullData;
    const marsTrace = data.find((t) => Array.isArray(t.text) && t.text.includes && t.text.includes('Marte'))
      || data.find((t) => t.name === 'Marte');
    return marsTrace ? { x: marsTrace.x[0], y: marsTrace.y[0] } : null;
  });
  expect(marsPos).not.toBeNull();
  expect(marsPos.x).toBeLessThan(0);     // esquerda
  expect(marsPos.y).toBeGreaterThan(0);  // cima

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('#plot').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await shoot(page, '17-marte-quadrante-correto');
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
    () => document.getElementById('psoResult').classList.contains('show'),
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
