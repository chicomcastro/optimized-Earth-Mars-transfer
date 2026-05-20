// ============================================================
// Controlador da UI — versão mobile-first, sliders, animações,
// porkchop clicável e navegação ativa por scroll-spy.
// ============================================================

const PRESETS = {
  swingBy: {
    label: "Swing-by por Vênus (ótimo PSO)",
    venusSwingBy: true,
    x: [6.1836, 3.1398, 120.76, 215.14, 0.0943],
  },
  swingByAlt: {
    label: "Swing-by exploratório",
    venusSwingBy: true,
    x: [Math.PI, Math.PI / 2, 150, 200, 0.05],
  },
  direct: {
    label: "Direta (Hohmann)",
    venusSwingBy: false,
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
      const step = isAngle ? 0.5 : isTime ? 0.5 : 0.001;
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
  refreshScenario();
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
  plotTrajectory("plot", sim, {
    title: venusSwingBy ? "Terra → Vênus → Marte" : "Terra → Marte",
  });
}

function renderCost(sim, venusSwingBy, pulse) {
  const costValue = $("costValue");
  const costSub = $("costSub");

  costValue.classList.add("updating");
  setTimeout(() => {
    costValue.textContent = fmt(sim.cost, 3);
    costValue.classList.remove("updating");
    if (pulse) {
      $("costDisplay").classList.remove("pulse-once");
      void $("costDisplay").offsetWidth; // reflow
      $("costDisplay").classList.add("pulse-once");
    }
  }, 60);

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

async function runPSO() {
  const venusSwingBy = $("modeSwingBy").checked;
  const N = parseInt($("psoParticles").value, 10) || 200;
  const maxIter = parseInt($("psoIterations").value, 10) || 60;
  convergenceHistory = [];

  if (currentRun) currentRun.stop();

  const pso = new PSO({
    numParticles: N,
    maxIteration: maxIter,
    venusSwingBy,
    onProgress: (st) => {
      convergenceHistory = st.history;
      $("psoStatus").textContent =
        `iter ${st.iteration}/${st.maxIteration} · melhor ΔV = ${fmt(st.bestGlobalCost, 3)} km/s`;
      $("psoProgressBar").style.width =
        `${(st.iteration / st.maxIteration) * 100}%`;
      plotConvergence("convergence", convergenceHistory);
    },
  });
  currentRun = pso;
  $("btnRun").disabled = true;
  $("btnRun").innerHTML = '<span class="spinner"></span> rodando...';
  $("btnStop").disabled = false;
  $("psoStatus").textContent = "executando PSO...";

  const result = await pso.run({ chunkMs: 50 });

  $("btnRun").disabled = false;
  $("btnRun").textContent = "▶ rodar PSO";
  $("btnStop").disabled = true;
  $("psoStatus").textContent =
    `finalizado · melhor ΔV = ${fmt(result.bestGlobalCost, 3)} km/s em ${result.iteration} iter`;
  renderInputs(venusSwingBy, result.bestGlobal.slice());
  refreshScenario({ pulse: true });
  showToast(`PSO terminou — melhor ΔV: ${fmt(result.bestGlobalCost, 3)} km/s`);
  currentRun = null;
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
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  applyPreset("swingBy");
});
