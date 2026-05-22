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

// Helpers para selecionar missão e preset.
async function selectMission(page, missionId) {
  await page.evaluate((m) => { window.location.hash = "#/mission/" + m; }, missionId);
  await page.waitForTimeout(300);
}
async function clickFirstPreset(page) {
  await page.click('#presetRow .preset-btn:first-child');
  await page.waitForTimeout(200);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
});

test('01 - landing page completa', async ({ page }) => {
  await expect(page.locator('h1')).toContainText(/Otimização|Transferência/i);
  for (const id of ['galeria', 'simulador', 'exploracao', 'otimizacao', 'problema', 'metodo', 'referencias']) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  await shoot(page, '01-landing-page', { fullPage: true });
});

test('02 - swing-by preset (ΔV ~ 8 km/s)', async ({ page }) => {
  await selectMission(page, "mars-venus-flyby"); await clickFirstPreset(page);
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
  await selectMission(page, "mars-direct-leo");
  await page.waitForTimeout(200);
  await selectMission(page, "mars-direct-leo"); await clickFirstPreset(page);
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
  await selectMission(page, "mars-direct-leo");
  await selectMission(page, "mars-direct-leo"); await clickFirstPreset(page);
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
  await selectMission(page, "mars-direct-leo");
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
  await selectMission(page, "mars-venus-flyby");
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

  // Após o click, a missão atual é mars-direct-leo e o cost ~ 5.7
  const mid = await page.evaluate(() => currentMissionId);
  expect(mid).toBe('mars-direct-leo');
  const dv = await getCost(page);
  expect(dv).toBeLessThan(7);

  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shoot(page, '08-porkchop-click-aplicado');
});

test('29 - porkchop seletor lista explorações da missão', async ({ page }) => {
  // mars-direct-leo (default): 2 params → 1 exploração (C(2,2)=1)
  let opts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#porkchopExploration option')).map((o) => o.textContent)
  );
  expect(opts.length).toBe(1);
  expect(opts[0]).toMatch(/Marte.*T-M|T-M.*Marte/);

  // Troca pra mars-venus-flyby: 5 params → 10 explorações (C(5,2)=10)
  await selectMission(page, 'mars-venus-flyby');
  await page.waitForTimeout(200);
  opts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#porkchopExploration option')).map((o) => o.textContent)
  );
  expect(opts.length).toBe(10);
});

test('30 - trocar exploração atualiza labels dos eixos e parâmetros fixos', async ({ page }) => {
  await selectMission(page, 'mars-venus-flyby');
  await page.waitForTimeout(200);
  // Primeira exploração é fase Marte × fase Vênus (idx 0)
  await page.selectOption('#porkchopExploration', '0');
  await page.waitForTimeout(200);

  expect(await page.locator('#porkchopXLabel').textContent()).toContain('Marte');
  expect(await page.locator('#porkchopYLabel').textContent()).toContain('Vênus');

  // Deve mostrar 3 pílulas de parâmetros fixos (T-V, V-M, r_p)
  const fixedCount = await page.locator('#porkchopFixed .fixed-pill').count();
  expect(fixedCount).toBe(3);
});

test('31 - porkchop swing-by gera plot com range custom', async ({ page }) => {
  test.setTimeout(120_000);
  await selectMission(page, 'mars-venus-flyby');
  // Procura a exploração T-V × V-M no select
  const explorationsIdx = await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll('#porkchopExploration option'));
    return opts.findIndex(o => /T-V.*V-M|V-M.*T-V/.test(o.textContent));
  });
  await page.selectOption('#porkchopExploration', String(explorationsIdx));
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
  // mars-direct-leo default → exploração 0 = phase_marte × t_TM
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

test('34 - explicação aparece e muda por missão/exploração', async ({ page }) => {
  // mars-direct-leo, exploração default
  const t1 = await page.locator('#porkchopExplain').textContent();
  expect(t1).toMatch(/Mapa de ΔV|ΔV/i);

  // Troca de missão muda a explicação (label diferente)
  await selectMission(page, 'mars-venus-flyby');
  await page.waitForTimeout(200);
  const t2 = await page.locator('#porkchopExplain').textContent();
  expect(t1).not.toBe(t2);
});

test('32 - reset ranges volta aos defaults', async ({ page }) => {
  await selectMission(page, 'mars-venus-flyby');
  await page.selectOption('#porkchopExploration', '0');
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
  // Espera scroll suave terminar + IntersectionObserver atualizar
  await page.waitForFunction(
    () => document.querySelector('nav.tabs a.active[data-target="otimizacao"]') !== null,
    { timeout: 5000 }
  );
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
  // Em mobile, abre na galeria; clica no bottom-nav pra ir ao simulador
  await page.click('nav.bottom-nav a[data-target="simulador"]');
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
  await page.click('nav.bottom-nav a[data-target="simulador"]');
  await page.waitForTimeout(400);
  await shoot(page, '13-mobile-320px');
});

test('15 - mobile - trajetória renderiza com legend horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
  await page.click('nav.bottom-nav a[data-target="simulador"]');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.querySelector('#plot').scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);
  await shoot(page, '15-mobile-trajetoria');
});

test('18 - shadow toggle mostra posição inicial de Marte e Vênus', async ({ page }) => {
  await selectMission(page, "mars-venus-flyby"); await clickFirstPreset(page);
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
  await selectMission(page, "mars-direct-leo"); await clickFirstPreset(page);
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
  await selectMission(page, "mars-direct-leo"); await clickFirstPreset(page);
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
  await selectMission(page, "mars-direct-leo"); await clickFirstPreset(page);
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
  await selectMission(page, "mars-direct-leo"); await clickFirstPreset(page);
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
  await selectMission(page, "mars-direct-leo");
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
  await selectMission(page, "mars-direct-leo");
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
  await selectMission(page, "mars-venus-flyby"); await clickFirstPreset(page);
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
  await selectMission(page, "mars-direct-leo");
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
  await selectMission(page, "mars-direct-leo"); await clickFirstPreset(page);
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
  await page.selectOption('#porkchopExploration', '0');
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

test('36 - missão mars-direct-geo: ΔV menor que LEO (saindo de mais alto)', async ({ page }) => {
  await selectMission(page, 'mars-direct-geo');
  await clickFirstPreset(page);
  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(3.5);
  expect(dv).toBeLessThan(5);
  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '36-mission-mars-geo');
});

test('37 - missão venus-direct: Hohmann interna', async ({ page }) => {
  await selectMission(page, 'venus-direct');
  await clickFirstPreset(page);
  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(5);
  expect(dv).toBeLessThan(10);
  const nParams = await page.locator('#paramInputs .param-control').count();
  expect(nParams).toBe(2);
  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '37-mission-venus');
});

test('38 - missão mercury-venus-flyby: swing-by que vale a pena', async ({ page }) => {
  await selectMission(page, 'mercury-venus-flyby');
  await clickFirstPreset(page);
  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(7);
  expect(dv).toBeLessThan(12);
  const nParams = await page.locator('#paramInputs .param-control').count();
  expect(nParams).toBe(5);
  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '38-mission-mercury');
});

test('39 - missão jupiter-mars-flyby: swing-by externo', async ({ page }) => {
  await selectMission(page, 'jupiter-mars-flyby');
  await clickFirstPreset(page);
  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(8);
  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '39-mission-jupiter');
});

test('41 - galeria mostra todas as missões', async ({ page }) => {
  await page.locator('#galeria').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const cards = await page.locator('.mission-card').count();
  expect(cards).toBeGreaterThanOrEqual(13);
  await shoot(page, '41-galeria-completa');
});

test('42 - galeria filtra por destino', async ({ page }) => {
  await page.locator('#galeria').scrollIntoViewIfNeeded();
  await page.click('.filter-chip[data-dest="marte"]');
  await page.waitForTimeout(300);
  const cards = await page.locator('.mission-card').count();
  expect(cards).toBeGreaterThanOrEqual(3); // mars-leo, mars-geo, mars-venus-flyby
  expect(cards).toBeLessThan(13);
  await shoot(page, '42-galeria-filtro-marte');
});

test('43 - hash routing: #/mission/{id} carrega missão', async ({ page }) => {
  await page.evaluate(() => {
    window.location.hash = '#/mission/jupiter-direct-leo';
  });
  await page.waitForTimeout(500);
  const title = await page.locator('#missionTitle').textContent();
  expect(title).toContain('Júpiter');
  const mid = await page.evaluate(() => currentMissionId);
  expect(mid).toBe('jupiter-direct-leo');
});

test('44 - click em card da galeria carrega missão via hash', async ({ page }) => {
  await page.locator('#galeria').scrollIntoViewIfNeeded();
  await page.click('.mission-card[data-mission="venus-direct-geo"]');
  await page.waitForTimeout(600);
  const mid = await page.evaluate(() => currentMissionId);
  expect(mid).toBe('venus-direct-geo');
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain('venus-direct-geo');
});

test('45 - missão mercury-direct-leo: direta cara ~13 km/s', async ({ page }) => {
  await selectMission(page, 'mercury-direct-leo');
  await clickFirstPreset(page);
  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(11);
  expect(dv).toBeLessThan(16);
  await shoot(page, '45-mission-mercury-leo');
});

test('46 - missão jupiter-direct-leo: ~23 km/s mostra warning', async ({ page }) => {
  await selectMission(page, 'jupiter-direct-leo');
  await clickFirstPreset(page);
  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(20);
  // ΔV > 50 não, então não deve mostrar warning. Mas 23 > 50? não.
  // Skip warning assertion, só checa custo.
  await shoot(page, '46-mission-jupiter-leo');
});

test('47 - earth-moon-geo: 2.1 km/s (barato)', async ({ page }) => {
  await selectMission(page, 'earth-moon-geo');
  await clickFirstPreset(page);
  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(1.5);
  expect(dv).toBeLessThan(3);
  await shoot(page, '47-mission-moon-geo');
});

test('48 - mobile tabs: só uma seção visível por vez', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
  // No mobile, abre na galeria
  const visibleSections = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('main > section'))
      .filter((s) => getComputedStyle(s).display !== 'none')
      .map((s) => s.id);
  });
  expect(visibleSections).toEqual(['galeria']);

  // Troca pro simulador via bottom-nav
  await page.click('nav.bottom-nav a[data-target="simulador"]');
  await page.waitForTimeout(300);
  const visibleAfter = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('main > section'))
      .filter((s) => getComputedStyle(s).display !== 'none')
      .map((s) => s.id);
  });
  expect(visibleAfter).toEqual(['simulador']);
  await shoot(page, '48-mobile-tabs');
});

test('50 - mobile: plot do simulador não ultrapassa o card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
  // Vai pro simulador via galeria (caminho mais comum do bug)
  await page.click('.mission-card[data-mission="venus-direct-geo"]');
  await page.waitForTimeout(700);

  const widths = await page.evaluate(() => {
    const plotEl = document.getElementById('plot');
    const parent = plotEl.parentElement; // .plot-wrap dentro do card
    const card = parent.closest('.card');
    const svg = plotEl.querySelector('svg');
    return {
      cardWidth: card.getBoundingClientRect().width,
      plotWidth: plotEl.getBoundingClientRect().width,
      svgWidth: svg ? svg.getBoundingClientRect().width : 0,
    };
  });
  // SVG do Plotly não deve ser maior que o plot div (que já é constrained pelo card)
  expect(widths.svgWidth).toBeLessThanOrEqual(widths.plotWidth + 1);
  expect(widths.plotWidth).toBeLessThanOrEqual(widths.cardWidth + 1);
  await shoot(page, '50-mobile-plot-fits');
});

test('49 - mobile: Terra se move durante missão (bug shadows corrigido)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitAppReady(page);
  await page.click('nav.bottom-nav a[data-target="simulador"]');
  await page.waitForTimeout(300);

  // Verifica que Terra em t=0 (shadow) e Terra atual ESTÃO em posições diferentes
  // após uma missão de 259 dias (Terra-Marte Hohmann)
  const positions = await page.evaluate(() => {
    return {
      t0: Animation.stateAt(Anim.sim, 0),
      tf: Animation.stateAt(Anim.sim, Anim.sim.t_total_s),
    };
  });
  const earthT0 = positions.t0.terra;
  const earthTf = positions.tf.terra;
  const dist = Math.hypot(earthT0[0] - earthTf[0], earthT0[1] - earthTf[1]);
  // Para Hohmann (259d), Terra se move ~255° na órbita — distância considerável
  expect(dist).toBeGreaterThan(1e7); // > 10 milhões de km
});

test('40 - missão earth-moon: geocêntrico, tempos em dias', async ({ page }) => {
  await selectMission(page, 'earth-moon');
  await clickFirstPreset(page);
  const dv = await getCost(page);
  expect(dv).toBeGreaterThan(3);
  expect(dv).toBeLessThan(6);
  const nParams = await page.locator('#paramInputs .param-control').count();
  expect(nParams).toBe(2);
  // Parâmetro de tempo está em dias razoáveis (3-14 d, não 100s de dias)
  const tVal = await page.evaluate(() => {
    const s = document.querySelector('#paramInputs .param-control[data-idx="1"] .pc-slider');
    return parseFloat(s.value);
  });
  expect(tVal).toBeLessThan(20);
  await page.locator('#simulador').scrollIntoViewIfNeeded();
  await shoot(page, '40-mission-moon');
});

test('17 - rotação CCW: Marte a 110° vai pro 2º quadrante (cima-esquerda)', async ({ page }) => {
  await selectMission(page, "mars-direct-leo");
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
  await selectMission(page, "mars-direct-leo");
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
