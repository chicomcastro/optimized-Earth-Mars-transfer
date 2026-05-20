// ============================================================
// Controlador da UI — versão mobile-first, sliders, animações,
// porkchop clicável e navegação ativa por scroll-spy.
// ============================================================

// Pontos de partida — melhores configurações encontradas via PSO neste código.
// IMPORTANTE: são *sub-ótimas*. O espaço de busca é grande e multimodal;
// podem existir melhores não exploradas — rode o PSO com mais partículas/iterações.
const PRESETS = {
  swingBy: {
    label: "Swing-by por Vênus (sub-ótimo encontrado)",
    venusSwingBy: true,
    // ΔV ≈ 7.97 km/s — melhor após múltiplos restarts (1500 part × 300 iter × 8 runs)
    x: [6.2824, 3.1416, 121.25, 217.24, 0.0675],
  },
  swingByAlt: {
    label: "Swing-by exploratório",
    venusSwingBy: true,
    x: [Math.PI, Math.PI / 2, 150, 200, 0.05],
  },
  direct: {
    label: "Direta (Hohmann clássica)",
    venusSwingBy: false,
    // ΔV ≈ 5.71 km/s — Hohmann é o ótimo global pra esse caso direto
    x: [Math.PI, 258.8],
  },
};

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const fmt = (x, d = 3) => (!isFinite(x) ? "∞" : Number(x).toFixed(d));
const radToDeg = (r) => (r * 180) / Math.PI;
const degToRad = (d) => (d * Math.PI) / 180;

let currentRun = null;
let convergenceHistory = [];
let porkchopReady = false;

// === Estado da animação ===
const Anim = {
  sim: null,
  t: 0,             // tempo atual em segundos
  speed: 1,         // multiplicador
  frame: 'helio',   // referencial atual
  showShadow: false,
  playing: false,
  lastTs: 0,
  rafId: null,
  // Quantos "segundos de simulação" por segundo de wall-clock @ 1x
  // t_total_s típico é ~22M segundos (259 dias); queremos animar em ~8s.
  baseRate: 0,
};

// ============================================================
// Param controls: sliders + numeric (sincronizados)
// ============================================================

function renderInputs(venusSwingBy, values) {
  const bnd = defaultBounds(venusSwingBy);
  const html = bnd.labels
    .map((label, i) => {
      const lo = bnd.lb[i], hi = bnd.ub[i];
      const isAngle = label.toLowerCase().includes("fase");
      const isTime = label.toLowerCase().includes("dias");
      const unit = isAngle ? "°" : isTime ? " d" : "";
      const dLo = isAngle ? radToDeg(lo) : lo;
      const dHi = isAngle ? radToDeg(hi) : hi;
      const dVal = isAngle ? radToDeg(values[i]) : values[i];
      // step pequeno: o slider tem ~1000px de range, 0.01 dá precisão visual suficiente
      // e não corrompe presets do PSO com mais precisão
      const step = isAngle ? 0.01 : isTime ? 0.01 : 0.0001;
      const decimals = isAngle ? 2 : isTime ? 1 : 4;

      return `
        <div class="param-control" data-idx="${i}" data-angle="${isAngle}">
          <div class="pc-head">
            <span class="pc-label">${label}</span>
            <span class="pc-value" tabindex="0">
              <span class="pc-num">${dVal.toFixed(decimals)}</span><span class="pc-unit">${unit}</span>
            </span>
          </div>
          <div class="pc-slider-row">
            <span class="pc-bounds">${dLo.toFixed(isAngle || isTime ? 0 : 3)}</span>
            <input type="range" class="pc-slider" data-idx="${i}"
                   min="${dLo}" max="${dHi}" step="${step}" value="${dVal}" />
            <span class="pc-bounds">${dHi.toFixed(isAngle || isTime ? 0 : 3)}</span>
          </div>
        </div>
      `;
    })
    .join("");
  $("paramInputs").innerHTML = html;

  // Bind events: slider + click-to-edit no pc-value
  $$(".pc-slider", $("paramInputs")).forEach((slider) => {
    slider.addEventListener("input", onSliderInput);
    updateSliderFill(slider); // pinta o track inicial
  });
  $$(".pc-value", $("paramInputs")).forEach((pc) => {
    pc.addEventListener("click", () => enterEditMode(pc));
    pc.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        enterEditMode(pc);
      }
    });
  });
}

function onSliderInput(e) {
  const slider = e.target;
  const row = slider.closest(".param-control");
  const isAngle = row.dataset.angle === "true";
  const numEl = row.querySelector(".pc-num");
  const v = parseFloat(slider.value);
  const decimals = isAngle ? 2 : v > 10 ? 1 : 4;
  numEl.textContent = v.toFixed(decimals);
  updateSliderFill(slider);
  refreshScenario();
}

function updateSliderFill(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const v = parseFloat(slider.value);
  const pct = ((v - min) / (max - min)) * 100;
  slider.style.setProperty("--val", pct);
}

function enterEditMode(pcValue) {
  const row = pcValue.closest(".param-control");
  const slider = row.querySelector(".pc-slider");
  const isAngle = row.dataset.angle === "true";
  const current = parseFloat(slider.value);
  const unit = pcValue.querySelector(".pc-unit").textContent;
  pcValue.innerHTML = `<input type="number" step="any" value="${current}" />${unit ? `<span class="pc-unit">${unit}</span>` : ""}`;
  const input = pcValue.querySelector("input");
  input.focus();
  input.select();
  const commit = () => {
    const v = parseFloat(input.value);
    if (!isNaN(v)) {
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      const clamped = Math.max(min, Math.min(max, v));
      slider.value = clamped;
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // restaura
      const decimals = isAngle ? 2 : current > 10 ? 1 : 4;
      pcValue.innerHTML = `<span class="pc-num">${current.toFixed(decimals)}</span><span class="pc-unit">${unit}</span>`;
    }
    rebindPcValue(pcValue);
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") {
      e.preventDefault();
      const decimals = isAngle ? 2 : current > 10 ? 1 : 4;
      pcValue.innerHTML = `<span class="pc-num">${current.toFixed(decimals)}</span><span class="pc-unit">${unit}</span>`;
      rebindPcValue(pcValue);
    }
  });
}

function rebindPcValue(pcValue) {
  pcValue.addEventListener("click", () => enterEditMode(pcValue));
}

function readInputs(venusSwingBy) {
  const rows = $$(".param-control", $("paramInputs"));
  const x = new Array(rows.length);
  rows.forEach((row) => {
    const idx = parseInt(row.dataset.idx, 10);
    const isAngle = row.dataset.angle === "true";
    const v = parseFloat(row.querySelector(".pc-slider").value);
    x[idx] = isAngle ? degToRad(v) : v;
  });
  return x;
}

// ============================================================
// Simulação + render
// ============================================================

function refreshScenario(opts = {}) {
  const venusSwingBy = $("modeSwingBy").checked;
  const bnd = defaultBounds(venusSwingBy);
  const x = readInputs(venusSwingBy);
  const xClamped = clampVec(x, bnd.lb, bnd.ub);
  const sim = simulate(xClamped, { venusSwingBy });
  renderCost(sim, venusSwingBy, opts.pulse);

  // Atualiza estado da animação
  Anim.sim = sim;
  // Por padrão, deixa no final (estado completo da trajetória)
  if (!opts.keepTime) Anim.t = sim.t_total_s;
  // Base rate: simula a missão inteira em ~8s wall-clock @ 1x
  Anim.baseRate = sim.t_total_s / 8;
  updateAnimUI();

  plotTrajectory("plot", sim, {
    t: Anim.t,
    frame: Anim.frame,
    showShadow: Anim.showShadow,
  });
}

// === Animação ===

function updateAnimUI() {
  if (!Anim.sim) return;
  const total = Anim.sim.t_total_s;
  const pct = total > 0 ? Math.round((Anim.t / total) * 1000) : 1000;
  const scrubber = $("animTime");
  if (scrubber && document.activeElement !== scrubber) {
    scrubber.value = String(pct);
  }
  const label = $("animTimeLabel");
  if (label) {
    const cur = (Anim.t / 86400).toFixed(0);
    const tot = (total / 86400).toFixed(0);
    label.textContent = `${cur} / ${tot} d`;
  }
}

function renderFrame() {
  if (!Anim.sim) return;
  updateTrajectoryFrame("plot", Anim.sim, {
    t: Anim.t,
    frame: Anim.frame,
    showShadow: Anim.showShadow,
  });
  updateAnimUI();
}

function animTick(ts) {
  if (!Anim.playing) return;
  if (Anim.lastTs === 0) Anim.lastTs = ts;
  const dt = (ts - Anim.lastTs) / 1000; // wall seconds
  Anim.lastTs = ts;
  Anim.t += Anim.baseRate * Anim.speed * dt;
  if (Anim.t >= Anim.sim.t_total_s) {
    Anim.t = Anim.sim.t_total_s;
    animPause();
  }
  renderFrame();
  if (Anim.playing) Anim.rafId = requestAnimationFrame(animTick);
}

function animPlay() {
  if (!Anim.sim) return;
  if (Anim.t >= Anim.sim.t_total_s) Anim.t = 0; // reinicia se no fim
  Anim.playing = true;
  Anim.lastTs = 0;
  $("animPlayIcon").textContent = "⏸";
  $("animPlay").classList.add("playing");
  Anim.rafId = requestAnimationFrame(animTick);
}

function animPause() {
  Anim.playing = false;
  if (Anim.rafId) cancelAnimationFrame(Anim.rafId);
  Anim.rafId = null;
  $("animPlayIcon").textContent = "▶";
  $("animPlay").classList.remove("playing");
}

function animReset() {
  animPause();
  Anim.t = 0;
  renderFrame();
}

function bindAnim() {
  $("animPlay").addEventListener("click", () => {
    if (Anim.playing) animPause();
    else animPlay();
  });
  $("animReset").addEventListener("click", animReset);
  $("animTime").addEventListener("input", (e) => {
    if (!Anim.sim) return;
    const pct = parseInt(e.target.value, 10) / 1000;
    Anim.t = pct * Anim.sim.t_total_s;
    if (Anim.playing) animPause();
    renderFrame();
  });
  // Speed radios
  const speedMap = { speedHalf: 0.5, speed1: 1, speed2: 2, speed5: 5 };
  Object.keys(speedMap).forEach((id) => {
    $(id).addEventListener("change", () => {
      if ($(id).checked) Anim.speed = speedMap[id];
    });
  });
  // Frame radios
  const frameMap = { frameHelio: 'helio', frameGeo: 'geo', frameSyn: 'synodic' };
  Object.keys(frameMap).forEach((id) => {
    $(id).addEventListener("change", () => {
      if ($(id).checked) {
        Anim.frame = frameMap[id];
        // Re-plot inteiro pq legendas/órbitas mudam
        if (Anim.sim) {
          plotTrajectory("plot", Anim.sim, {
            t: Anim.t, frame: Anim.frame, showShadow: Anim.showShadow,
          });
        }
      }
    });
  });
  // Shadow toggle
  $("toggleShadow").addEventListener("change", (e) => {
    Anim.showShadow = e.target.checked;
    renderFrame();
  });
}

let costTween = { rafId: null, current: NaN };
function tweenCost(to, duration = 220) {
  const el = $("costValue");
  const from = isFinite(costTween.current) ? costTween.current : to;
  const start = performance.now();
  if (costTween.rafId) cancelAnimationFrame(costTween.rafId);
  if (!isFinite(to)) {
    el.textContent = "∞";
    costTween.current = NaN;
    return;
  }
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    const v = from + (to - from) * eased;
    el.textContent = v.toFixed(3);
    if (t < 1) costTween.rafId = requestAnimationFrame(step);
    else {
      el.textContent = to.toFixed(3);
      costTween.current = to;
      costTween.rafId = null;
    }
  };
  costTween.rafId = requestAnimationFrame(step);
}

function renderCost(sim, venusSwingBy, pulse) {
  const costSub = $("costSub");
  tweenCost(sim.cost);
  if (pulse) {
    const cd = $("costDisplay");
    cd.classList.remove("pulse-once");
    void cd.offsetWidth;
    cd.classList.add("pulse-once");
  }

  const labels = venusSwingBy
    ? ["partida", "swing-by Vênus", "captura Marte"]
    : ["partida", "captura Marte"];
  const pills = sim.deltaV
    .map(
      (d, i) =>
        `<span class="deltaV-pill">${labels[i] || `ΔV${i + 1}`} <b>${fmt(d, 2)}</b></span>`
    )
    .join("");
  costSub.innerHTML = pills;
}

function applyPreset(key, opts = {}) {
  const p = PRESETS[key];
  if (!p) return;
  $("modeSwingBy").checked = p.venusSwingBy;
  $("modeDirect").checked = !p.venusSwingBy;
  renderInputs(p.venusSwingBy, p.x.slice());
  $$(".preset-btn").forEach((b) => b.classList.toggle("active", b.dataset.preset === key));
  refreshScenario({ pulse: true });
  if (opts.toast) showToast(`Preset aplicado: ${p.label}`);
}

// ============================================================
// PSO
// ============================================================

let lastPSOResult = null; // pra mostrar comparação no próximo run

async function runPSO() {
  const venusSwingBy = $("modeSwingBy").checked;
  const N = parseInt($("psoParticles").value, 10) || 200;
  const maxIter = parseInt($("psoIterations").value, 10) || 60;
  convergenceHistory = [];

  // Avisa se N for muito alto (consumo de memória)
  if (N > 100_000) {
    const ok = window.confirm(
      `Você pediu ${N.toLocaleString()} partículas. ` +
      `Isso pode consumir bastante memória (>100 MB) e congelar o navegador por alguns segundos. ` +
      `Continuar mesmo assim?`
    );
    if (!ok) return;
  }

  if (currentRun) currentRun.stop();

  // Esconde card de resultado anterior; aparecerá só ao final do novo run
  $("psoResult").classList.remove("show");

  const t0 = performance.now();
  const pso = new PSO({
    numParticles: N,
    maxIteration: maxIter,
    venusSwingBy,
    onProgress: (st) => {
      convergenceHistory = st.history;
      $("psoStatus").textContent =
        `iter ${st.iteration}/${st.maxIteration} · melhor até agora: ${fmt(st.bestGlobalCost, 3)} km/s`;
      $("psoProgressBar").style.width =
        `${(st.iteration / st.maxIteration) * 100}%`;
      plotConvergence("convergence", convergenceHistory);
    },
  });
  currentRun = pso;
  $("btnRun").disabled = true;
  $("btnRun").innerHTML = '<span class="spinner"></span> rodando...';
  $("btnStop").disabled = false;
  $("psoStatus").textContent = `iniciando ${N.toLocaleString()} partículas × ${maxIter} iterações...`;

  const result = await pso.run({ chunkMs: 50 });
  const elapsed = (performance.now() - t0) / 1000;

  $("btnRun").disabled = false;
  $("btnRun").textContent = "▶ rodar PSO";
  $("btnStop").disabled = true;
  $("psoStatus").textContent = "—";

  // Aplica no simulador
  renderInputs(venusSwingBy, result.bestGlobal.slice());
  refreshScenario({ pulse: true });

  // Renderiza card de resultado destacado
  showPSOResult({
    cost: result.bestGlobalCost,
    x: result.bestGlobal,
    venusSwingBy,
    iterations: result.iteration,
    particles: N,
    elapsed,
    prev: lastPSOResult,
  });

  lastPSOResult = { cost: result.bestGlobalCost, venusSwingBy };
  currentRun = null;
}

function showPSOResult({ cost, x, venusSwingBy, iterations, particles, elapsed, prev }) {
  const card = $("psoResult");
  const paramNames = defaultBounds(venusSwingBy).labels;
  const paramRows = paramNames.map((name, i) => {
    let val = x[i];
    let unit = "";
    if (name.toLowerCase().includes("fase")) {
      val = radToDeg(val);
      unit = "°";
    } else if (name.toLowerCase().includes("dias")) {
      unit = " d";
    }
    return `<div class="psr-param">
      <span class="psr-pname">${name}</span>
      <span class="psr-pvalue">${fmt(val, 3)}${unit}</span>
    </div>`;
  }).join("");

  // Comparação opcional vs run anterior do mesmo modo
  let delta = "";
  if (prev && prev.venusSwingBy === venusSwingBy && isFinite(prev.cost)) {
    const diff = cost - prev.cost;
    if (Math.abs(diff) > 1e-4) {
      const sign = diff < 0 ? "▼" : "▲";
      const cls = diff < 0 ? "better" : "worse";
      delta = `<span class="psr-delta ${cls}">${sign} ${Math.abs(diff).toFixed(3)} km/s vs último</span>`;
    } else {
      delta = `<span class="psr-delta">= último run</span>`;
    }
  }

  card.innerHTML = `
    <div class="psr-head">
      <span class="psr-badge">🏆 melhor encontrado</span>
      ${delta}
    </div>
    <div class="psr-cost">
      <span class="psr-value">${fmt(cost, 3)}</span>
      <span class="psr-unit">km/s</span>
    </div>
    <div class="psr-sub">
      ${particles.toLocaleString()} partículas · ${iterations} iter · ${elapsed.toFixed(1)} s
    </div>
    <div class="psr-divider"></div>
    <div class="psr-params-label">Parâmetros ótimos</div>
    <div class="psr-params">${paramRows}</div>
    <div class="psr-note">
      Aplicado no simulador ✓ — role para cima pra ver a trajetória.
      Lembre: este é o <b>melhor de N runs</b>, não o ótimo global garantido.
      Rode mais vezes pra explorar outras bacias.
    </div>
  `;
  // trigger CSS transition
  requestAnimationFrame(() => card.classList.add("show"));
}

function stopPSO() {
  if (currentRun) currentRun.stop();
}

// ============================================================
// Mode change
// ============================================================

function bindModeRadios() {
  ["modeSwingBy", "modeDirect"].forEach((id) => {
    $(id).addEventListener("change", () => {
      const venusSwingBy = $("modeSwingBy").checked;
      const preset = venusSwingBy ? PRESETS.swingBy : PRESETS.direct;
      renderInputs(venusSwingBy, preset.x.slice());
      $$(".preset-btn").forEach((b) => b.classList.remove("active"));
      refreshScenario({ pulse: true });
    });
  });
}

// ============================================================
// Porkchop — gera + click pra aplicar
// ============================================================

function bindPorkchop() {
  $("btnPorkchop").addEventListener("click", () => {
    const btn = $("btnPorkchop");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> calculando...';
    setTimeout(() => {
      plotPorkchop("porkchop", { N: 50, onClick: onPorkchopClick });
      btn.disabled = false;
      btn.textContent = "↻ regerar porkchop";
      porkchopReady = true;
      $("porkchopHint").style.display = "flex";
    }, 20);
  });
}

function onPorkchopClick(point) {
  // point: { phaseDeg, tDays, cost }
  // Aplica no simulador (modo direto), pulsa o cost, e dá scroll
  $("modeDirect").checked = true;
  $("modeSwingBy").checked = false;
  renderInputs(false, [degToRad(point.phaseDeg), point.tDays]);
  $$(".preset-btn").forEach((b) => b.classList.remove("active"));
  refreshScenario({ pulse: true });

  const target = $("simulador");
  const top = target.getBoundingClientRect().top + window.scrollY - 10;
  window.scrollTo({ top, behavior: "smooth" });

  showToast(`Aplicado: fase ${point.phaseDeg.toFixed(1)}°, t = ${point.tDays.toFixed(0)}d · ΔV ${fmt(point.cost, 2)} km/s`);
}

// ============================================================
// Toast
// ============================================================

let toastTimer = null;
function showToast(text) {
  const t = $("toast");
  $("toastText").textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ============================================================
// Navegação: smooth scroll + scroll-spy
// ============================================================

function bindNav() {
  const allNavLinks = $$('nav.tabs a, nav.bottom-nav a');
  allNavLinks.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = a.dataset.target;
      const el = document.getElementById(target);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 10;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  // Scroll-spy via IntersectionObserver
  const sections = $$("main section");
  const setActive = (id) => {
    allNavLinks.forEach((a) =>
      a.classList.toggle("active", a.dataset.target === id)
    );
  };
  const observer = new IntersectionObserver(
    (entries) => {
      // Pega a section mais próxima do topo que está visível
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) setActive(visible[0].target.id);
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
  );
  sections.forEach((s) => observer.observe(s));
}

// ============================================================
// Reveal animations on scroll
// ============================================================

function bindReveal() {
  const revealEls = $$(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.05 }
  );
  revealEls.forEach((el) => observer.observe(el));
}

// ============================================================
// Init
// ============================================================

function bindEvents() {
  $("btnRun").addEventListener("click", runPSO);
  $("btnStop").addEventListener("click", stopPSO);
  $$(".preset-btn").forEach((b) =>
    b.addEventListener("click", () => applyPreset(b.dataset.preset, { toast: true }))
  );
  bindModeRadios();
  bindPorkchop();
  bindNav();
  bindReveal();
  bindAnim();
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  applyPreset("swingBy");
});
