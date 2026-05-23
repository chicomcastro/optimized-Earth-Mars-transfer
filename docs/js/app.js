// ============================================================
// Controlador da UI — versão mobile-first, sliders, animações,
// porkchop clicável e navegação ativa por scroll-spy.
// ============================================================

let currentMissionId = 'mars-direct-leo';
const currentMission = () => Missions[currentMissionId];

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

// Tooltips por nome explícito de parâmetro
const PARAM_TOOLTIPS = {
  "fase de Marte": "Posição angular de Marte na sua órbita ao redor do Sol no MOMENTO DA CHEGADA da nave. Medido a partir do eixo +x (referencial heliocêntrico inercial). 0° = alinhado com a Terra inicial; 180° = oposição (Hohmann clássica).",
  "fase de Vênus": "Posição angular de Vênus no momento do sobrevoo (gravity assist). Determina onde Vênus está quando a nave passa por ele.",
  "fase de Mercúrio": "Posição angular de Mercúrio no momento da chegada da nave.",
  "fase de Júpiter": "Posição angular de Júpiter no momento da chegada da nave.",
  "fase da Lua": "Posição angular da Lua na sua órbita ao redor da Terra, no momento da chegada da nave.",
  "T-V (dias)": "Tempo de voo do segmento Terra → Vênus.",
  "V-M (dias)": "Tempo de voo do segmento Vênus → Marte.",
  "V-Mer (dias)": "Tempo de voo do segmento Vênus → Mercúrio.",
  "T-M (dias)": "Tempo de voo total Terra → Marte (direta). Hohmann ≈ 259 dias.",
  "M-J (dias)": "Tempo de voo do segmento Marte → Júpiter.",
  "T-L (dias)": "Tempo de voo Terra → Lua. Hohmann LEO→Lua ≈ 5 dias.",
  "r_p / R_SOI Vênus": "Periapsis do sobrevoo em Vênus, em fração da SOI (sphere of influence). Quanto menor, mais perto a nave passa (mais deflexão). Limite físico: 1.0 = entrada da SOI; típico ótimo ~0.03–0.1.",
  "r_p / R_SOI Marte": "Periapsis do sobrevoo em Marte, em fração da SOI de Marte.",
};
// Fallback por tipo
const PARAM_TOOLTIPS_BY_KIND = {
  angle: "Posição angular do corpo no momento relevante da missão.",
  days:  "Tempo de voo da perna (Lambert) correspondente.",
  ratio: "Razão adimensional — periapsis do sobrevoo em fração da SOI.",
};

function renderInputs(values) {
  const m = currentMission();
  const html = m.params
    .map((p, i) => {
      const [lo, hi] = p.bounds;
      const isAngle = p.kind === 'angle';
      const isTime = p.kind === 'days';
      const unit = isAngle ? "°" : isTime ? " d" : "";
      const dLo = isAngle ? radToDeg(lo) : lo;
      const dHi = isAngle ? radToDeg(hi) : hi;
      const dVal = isAngle ? radToDeg(values[i]) : values[i];
      const step = isAngle ? 0.01 : isTime ? 0.01 : 0.0001;
      const decimals = isAngle ? 2 : isTime ? 1 : 4;
      const tip = PARAM_TOOLTIPS[p.label] || PARAM_TOOLTIPS_BY_KIND[p.kind] || "";

      return `
        <div class="param-control" data-idx="${i}" data-angle="${isAngle}">
          <div class="pc-head">
            <span class="pc-label">
              ${p.label}
              ${tip ? `<button type="button" class="pc-info" aria-label="info sobre ${p.label}" data-tip="${tip.replace(/"/g, '&quot;')}">?</button>` : ""}
            </span>
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

  // Bind events: slider + click-to-edit no pc-value + info tooltips
  $$(".pc-slider", $("paramInputs")).forEach((slider) => {
    slider.addEventListener("input", onSliderInput);
    updateSliderFill(slider);
  });
  $$(".pc-info", $("paramInputs")).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTooltip(btn, btn.dataset.tip);
    });
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

function readInputs() {
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
  const m = currentMission();
  const lb = m.params.map((p) => p.bounds[0]);
  const ub = m.params.map((p) => p.bounds[1]);
  const x = readInputs();
  const xClamped = clampVec(x, lb, ub);
  const sim = simulate(currentMissionId, xClamped);
  renderCost(sim, m, opts.pulse);

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
  if (typeof scheduleURLSync === 'function') scheduleURLSync();
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
        if (typeof scheduleURLSync === 'function') scheduleURLSync();
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
  const trendEl = $("costTrend");
  const from = isFinite(costTween.current) ? costTween.current : to;
  const start = performance.now();
  if (costTween.rafId) cancelAnimationFrame(costTween.rafId);
  // Indicador de tendência (▲ ▼ ●) só se houve mudança significativa
  if (trendEl) {
    const diff = to - from;
    if (!isFinite(to)) {
      trendEl.textContent = '';
      trendEl.className = 'cost-trend';
    } else if (!isFinite(from) || Math.abs(diff) < 0.001) {
      trendEl.textContent = '';
      trendEl.className = 'cost-trend';
    } else if (diff < 0) {
      trendEl.textContent = '▼';
      trendEl.className = 'cost-trend trend-down';
      trendEl.title = `−${Math.abs(diff).toFixed(2)} km/s`;
    } else {
      trendEl.textContent = '▲';
      trendEl.className = 'cost-trend trend-up';
      trendEl.title = `+${diff.toFixed(2)} km/s`;
    }
  }
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

// Gera labels descritivos de ΔV pelas legs da missão
function deltaVLabels(mission) {
  const labels = ['partida'];
  for (const leg of mission.legs) {
    if (leg.kind === 'flyby') labels.push(`swing-by ${Bodies[leg.at].label}`);
    // Lambert intermediário não tem custo próprio (handled at next leg or arrival)
  }
  labels.push(`captura ${Bodies[mission.arrival.body].label}`);
  return labels;
}

function renderCost(sim, mission, pulse) {
  const costSub = $("costSub");
  tweenCost(sim.cost);
  if (pulse) {
    const cd = $("costDisplay");
    cd.classList.remove("pulse-once");
    void cd.offsetWidth;
    cd.classList.add("pulse-once");
  }

  const cd = $("costDisplay");
  const degenerate = sim.degenerate || !isFinite(sim.cost) || sim.cost > 50;
  cd.classList.toggle("degenerate", degenerate);
  const warnEl = $("costWarn");
  if (degenerate) {
    warnEl.style.display = 'flex';
    warnEl.innerHTML = `<span class="warn-icon">⚠</span>
      <span>Configuração próxima ao degenerado (transferência ~0° ou ~180°, ou tempo incompatível).
      Tente outros valores de fase/tempo para uma trajetória física razoável.</span>`;
  } else {
    warnEl.style.display = 'none';
  }

  const labels = deltaVLabels(mission);
  const pills = sim.deltaV
    .map(
      (d, i) =>
        `<span class="deltaV-pill">${labels[i] || `ΔV${i + 1}`} <b>${fmt(d, 2)}</b></span>`
    )
    .join("");
  costSub.innerHTML = pills;
}

function applyPreset(presetId, opts = {}) {
  const m = currentMission();
  const p = m.presets.find((p) => p.id === presetId);
  if (!p) return;
  renderInputs(p.x.slice());
  $$(".preset-btn").forEach((b) => b.classList.toggle("active", b.dataset.preset === presetId));
  refreshScenario({ pulse: true });
  if (opts.toast) showToast(`Preset aplicado: ${p.label}`);
}

// Renderiza os botões de preset da missão atual
function renderPresetButtons() {
  const m = currentMission();
  const html = m.presets.map((p) =>
    `<button class="chip preset-btn" data-preset="${p.id}">⭐ ${p.label}</button>`
  ).join('');
  $("presetRow").innerHTML = html;
  $$(".preset-btn").forEach((b) => {
    b.addEventListener("click", () => applyPreset(b.dataset.preset, { toast: true }));
  });
}

// ============================================================
// PSO
// ============================================================

let lastPSOResult = null; // pra mostrar comparação no próximo run

async function runPSO() {
  const m = currentMission();
  const N = parseInt($("psoParticles").value, 10) || 200;
  const maxIter = parseInt($("psoIterations").value, 10) || 60;
  convergenceHistory = [];

  if (N > 100_000) {
    const ok = window.confirm(
      `Você pediu ${N.toLocaleString()} partículas. ` +
      `Isso pode consumir bastante memória (>100 MB) e congelar o navegador por alguns segundos. ` +
      `Continuar mesmo assim?`
    );
    if (!ok) return;
  }

  if (currentRun) currentRun.stop();
  $("psoResult").classList.remove("show");

  const t0 = performance.now();
  const pso = new PSO({
    numParticles: N,
    maxIteration: maxIter,
    missionId: currentMissionId,
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

  renderInputs(result.bestGlobal.slice());
  refreshScenario({ pulse: true });

  showPSOResult({
    cost: result.bestGlobalCost,
    x: result.bestGlobal,
    mission: m,
    iterations: result.iteration,
    particles: N,
    elapsed,
    prev: lastPSOResult,
  });

  lastPSOResult = { cost: result.bestGlobalCost, missionId: currentMissionId };
  currentRun = null;
}

function showPSOResult({ cost, x, mission, iterations, particles, elapsed, prev }) {
  const card = $("psoResult");
  const paramRows = mission.params.map((p, i) => {
    const name = p.label;
    let val = x[i];
    let unit = "";
    if (p.kind === 'angle') { val = radToDeg(val); unit = "°"; }
    else if (p.kind === 'days') { unit = " d"; }
    return `<div class="psr-param">
      <span class="psr-pname">${name}</span>
      <span class="psr-pvalue">${fmt(val, 3)}${unit}</span>
    </div>`;
  }).join("");

  // Comparação opcional vs run anterior do mesmo modo
  let delta = "";
  if (prev && prev.missionId === mission.id && isFinite(prev.cost)) {
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

function setMission(missionId, opts = {}) {
  if (!Missions[missionId]) return;
  const wasDifferent = missionId !== currentMissionId;
  currentMissionId = missionId;
  const m = currentMission();

  // Skeleton shimmer no simulador (feedback visual de troca de missão)
  if (wasDifferent) {
    const sim = $("simulador");
    if (sim) {
      sim.classList.remove("skeleton-flash");
      void sim.offsetWidth;
      sim.classList.add("skeleton-flash");
    }
  }

  // Em mobile usa label curto (m.short); desktop usa o longo (m.label)
  const isNarrow = window.matchMedia('(max-width: 820px)').matches;
  $("missionTitle").textContent = (isNarrow && m.short) ? m.short : m.label;
  // Tipa o badge por categoria (cor)
  const badgeKind = (label) => {
    const t = String(label || '').toLowerCase();
    if (t.includes('hohmann')) return 'ok';
    if (t.includes('cara') || t.includes('alto')) return 'danger';
    if (t.includes('ganhador') || t.includes('eficiente')) return 'ok';
    if (t.includes('geocêntrico')) return 'info';
    return '';
  };
  $("missionBadge").dataset.kind = badgeKind(m.badge);
  $("missionBadge").textContent = m.badge || '';
  $("missionDescription").textContent = m.description || '';

  const preset = m.presets[0];
  renderInputs(preset ? preset.x.slice() : m.params.map((p) => p.bounds[0]));
  renderPresetButtons();
  refreshScenario({ pulse: true });

  if (typeof renderExplorationControls === 'function') {
    currentExplorationIdx = 0;
    renderExplorationControls();
  }

  // Atualiza card ativo na galeria
  renderGallery();

  if (opts.toast) showToast(`Missão: ${m.label}`);
}

// ============================================================
// Galeria de missões
// ============================================================

let currentDestFilter = 'all';

function renderGallery() {
  // Renderiza chips de filtro (uma vez)
  const filterBox = $("galleryFilters");
  if (filterBox && filterBox.querySelectorAll('.filter-chip').length <= 1) {
    const html = ['<button class="chip filter-chip" data-dest="all">Todos</button>'];
    for (const d of Destinations) {
      html.push(`<button class="chip filter-chip" data-dest="${d.id}" style="--dest-color:${d.color};">${d.label}</button>`);
    }
    filterBox.innerHTML = html.join('');
    $$('.filter-chip').forEach((b) => {
      b.addEventListener('click', () => {
        currentDestFilter = b.dataset.dest;
        renderGallery();
      });
    });
  }

  // Atualiza estado ativo dos chips
  $$('.filter-chip').forEach((b) =>
    b.classList.toggle('active', b.dataset.dest === currentDestFilter)
  );

  // Renderiza cards
  const grid = $("galleryGrid");
  if (!grid) return;
  const missions = MissionOrder
    .map((id) => Missions[id])
    .filter((m) => m && (currentDestFilter === 'all' || m.destination === currentDestFilter));

  const badgeKind = (label) => {
    const t = String(label || '').toLowerCase();
    if (t.includes('hohmann')) return 'ok';
    if (t.includes('cara') || t.includes('alto')) return 'danger';
    if (t.includes('ganhador')) return 'ok';
    if (t.includes('geocêntrico')) return 'info';
    return '';
  };
  const cards = missions.map((m) => {
    const dest = Destinations.find((d) => d.id === m.destination);
    const destColor = dest ? dest.color : '#888';
    const destLabel = dest ? dest.label : m.destination;
    const flybyTxt = m.flybyAt ? ` · via ${Bodies[m.flybyAt].label}` : '';
    const active = m.id === currentMissionId ? 'active' : '';
    const kind = badgeKind(m.badge);
    return `
      <div class="mission-card ${active}" data-mission="${m.id}">
        <div class="mc-badge" data-kind="${kind}" style="--dest-color:${destColor}">
          <span class="mc-dest-dot" style="background:${destColor}"></span>
          ${destLabel}
        </div>
        <div class="mc-title">Terra → ${destLabel}</div>
        <div class="mc-subtitle">de ${m.departureLabel}${flybyTxt}</div>
        <div class="mc-cost">
          <span class="mc-cost-value">${m.estimatedCost.toFixed(2)}</span>
          <span class="mc-cost-unit">km/s</span>
        </div>
        <div class="mc-desc">${m.description}</div>
        <div class="mc-cta">${active ? '✓ ativa' : 'Explorar →'}</div>
      </div>
    `;
  }).join('');

  grid.innerHTML = cards || '<p class="muted">Nenhuma missão para esse filtro.</p>';

  $$('.mission-card', grid).forEach((card) => {
    card.addEventListener('click', () => {
      const mid = card.dataset.mission;
      // Atualiza hash → router faz o setMission e scroll
      window.location.hash = `#/mission/${mid}`;
    });
  });
}

// ============================================================
// Hash routing: #/mission/{id} → carrega missão + scroll pro simulador
// ============================================================

function handleHashRoute() {
  const hash = window.location.hash;
  // Nova rota com state: #/m/<id>?s=<b64>
  const parsed = window.Share ? Share.parseHash(hash) : null;
  if (parsed && parsed.missionId && Missions[parsed.missionId]) {
    const wasDifferent = parsed.missionId !== currentMissionId;
    if (wasDifferent) setMission(parsed.missionId);
    if (parsed.state) {
      // Aplica params + frame antes do refresh
      applySharedState(parsed.state);
    }
    if (isMobileTabs()) setActiveTab('simulador');
    return;
  }
  const m = hash.match(/^#\/mission\/([\w-]+)/);
  if (m) {
    const missionId = m[1];
    if (Missions[missionId] && missionId !== currentMissionId) {
      setMission(missionId);
    }
    if (isMobileTabs()) {
      setActiveTab('simulador');
    } else {
      setTimeout(() => {
        const target = $("simulador");
        if (target) {
          const top = target.getBoundingClientRect().top + window.scrollY - 10;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }, 50);
    }
  }
}

// ============================================================
// Porkchop — gera + click pra aplicar
// ============================================================

// ============================================================
// Porkchop: explorações geradas dinamicamente por missão.
// Gera todos os pares (i, j) de parâmetros da missão atual.
// ============================================================

let currentExplorationIdx = 0; // índice no array gerado pra missão atual

function getExplorationsForMission(missionId) {
  const m = Missions[missionId];
  const exps = [];
  for (let i = 0; i < m.params.length; i++) {
    for (let j = i + 1; j < m.params.length; j++) {
      const px = m.params[i];
      const py = m.params[j];
      const unitOf = (p) =>
        p.kind === 'angle' ? ' [°]' : p.kind === 'days' ? ' [d]' : '';
      const minMax = (p) => {
        if (p.kind === 'angle') return [0, 360];
        return [p.bounds[0], p.bounds[1]];
      };
      const [xMin, xMax] = minMax(px);
      const [yMin, yMax] = minMax(py);
      exps.push({
        id: `${px.key}__${py.key}`,
        label: `${px.label} × ${py.label}`,
        xIdx: i, yIdx: j,
        xKind: px.kind, yKind: py.kind,
        xMin, xMax, yMin, yMax,
        xLabel: px.label + unitOf(px),
        yLabel: py.label + unitOf(py),
      });
    }
  }
  return exps;
}

function currentExploration() {
  const exps = getExplorationsForMission(currentMissionId);
  return exps[currentExplorationIdx] || exps[0];
}

function getBaseX() {
  return readInputs();
}

function renderExplorationControls() {
  const m = currentMission();
  const exps = getExplorationsForMission(currentMissionId);

  // Popula select
  const sel = $("porkchopExploration");
  sel.innerHTML = exps.map((e, i) =>
    `<option value="${i}">${e.label}</option>`
  ).join('');
  currentExplorationIdx = Math.min(currentExplorationIdx, exps.length - 1);
  sel.value = String(currentExplorationIdx);

  const e = exps[currentExplorationIdx];
  const exp = $("porkchopExplain");
  if (exp) {
    exp.textContent = `Mapa de ΔV variando ${e.xLabel} e ${e.yLabel} para a missão atual (${m.label}). Outros parâmetros são mantidos fixos nos valores atuais do simulador.`;
  }

  $("porkchopXLabel").textContent = e.xLabel;
  $("porkchopYLabel").textContent = e.yLabel;
  $("porkchopXMin").value = e.xMin;
  $("porkchopXMax").value = e.xMax;
  $("porkchopYMin").value = e.yMin;
  $("porkchopYMax").value = e.yMax;

  const baseX = getBaseX();
  const fixedHtml = m.params.map((p, i) => {
    if (i === e.xIdx || i === e.yIdx) return null;
    let v = baseX[i];
    let unit = '';
    if (p.kind === 'angle') { v = radToDeg(v); unit = '°'; }
    else if (p.kind === 'days') { unit = ' d'; }
    return `<span class="fixed-pill"><span class="fp-name">${p.label}</span> <b>${fmt(v, 2)}${unit}</b></span>`;
  }).filter(Boolean).join('');
  $("porkchopFixed").innerHTML = fixedHtml
    ? `<span class="fp-label">com:</span> ${fixedHtml}`
    : '';
}

function bindPorkchop() {
  $("porkchopExploration").addEventListener("change", (e) => {
    currentExplorationIdx = parseInt(e.target.value, 10);
    renderExplorationControls();
  });

  $("porkchopReset").addEventListener("click", () => {
    const e = currentExploration();
    $("porkchopXMin").value = e.xMin;
    $("porkchopXMax").value = e.xMax;
    $("porkchopYMin").value = e.yMin;
    $("porkchopYMax").value = e.yMax;
  });

  $("btnPorkchop").addEventListener("click", () => {
    const btn = $("btnPorkchop");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> calculando...';
    setTimeout(() => {
      const e = currentExploration();
      const explorationCfg = {
        ...e,
        missionId: currentMissionId,
        venusSwingBy: currentMission().legs.some((l) => l.kind === 'flyby' && l.at === 'venus'),
      };
      plotPorkchop("porkchop", {
        exploration: explorationCfg,
        baseX: getBaseX(),
        xMin: parseFloat($("porkchopXMin").value),
        xMax: parseFloat($("porkchopXMax").value),
        yMin: parseFloat($("porkchopYMin").value),
        yMax: parseFloat($("porkchopYMax").value),
        N: parseInt($("porkchopN").value, 10) || 50,
        title: `Porkchop · ${currentMission().short} · ${e.label} (clique para aplicar)`,
        onClick: onPorkchopClick,
      });
      btn.disabled = false;
      btn.textContent = "↻ regerar";
      porkchopReady = true;
      $("porkchopHint").style.display = "flex";
    }, 20);
  });
}

function onPorkchopClick(point) {
  const e = currentExploration();
  const newX = getBaseX();
  newX[e.xIdx] = e.xKind === 'angle' ? degToRad(point.xValue) : point.xValue;
  newX[e.yIdx] = e.yKind === 'angle' ? degToRad(point.yValue) : point.yValue;

  renderInputs(newX);
  $$(".preset-btn").forEach((b) => b.classList.remove("active"));
  refreshScenario({ pulse: true });

  const target = $("simulador");
  const top = target.getBoundingClientRect().top + window.scrollY - 10;
  window.scrollTo({ top, behavior: "smooth" });

  const formatVal = (v, kind) => {
    if (kind === 'angle') return `${v.toFixed(1)}°`;
    if (kind === 'days') return `${v.toFixed(0)} d`;
    return v.toFixed(3);
  };
  showToast(
    `Aplicado: ${formatVal(point.xValue, e.xKind)}, ${formatVal(point.yValue, e.yKind)} · ΔV ${fmt(point.cost, 2)} km/s`
  );
}

// ============================================================
// Tooltip (popover acionado por click no "?")
// ============================================================

let activeTooltip = null;
function showTooltip(anchor, text) {
  // Fecha qualquer aberta
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
  const tip = document.createElement('div');
  tip.className = 'tooltip-pop';
  tip.textContent = text;
  document.body.appendChild(tip);
  activeTooltip = tip;

  // Posiciona acima do anchor
  const r = anchor.getBoundingClientRect();
  const tipR = tip.getBoundingClientRect();
  let left = r.left + r.width / 2 - tipR.width / 2;
  left = Math.max(8, Math.min(window.innerWidth - tipR.width - 8, left));
  let top = r.top + window.scrollY - tipR.height - 10;
  if (top < window.scrollY + 8) top = r.bottom + window.scrollY + 10;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  requestAnimationFrame(() => tip.classList.add('show'));

  // Fecha em qualquer click subsequente
  const close = (e) => {
    if (e.target === anchor) return;
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
    document.removeEventListener('click', close);
  };
  setTimeout(() => document.addEventListener('click', close), 50);
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

// Estado da tab ativa (usado em mobile pra mostrar só uma section por vez).
// No desktop, a CSS ignora `.tab-active` e mostra tudo (scroll normal).
let currentTab = 'galeria';

function isMobileTabs() {
  return window.matchMedia('(max-width: 820px)').matches;
}

function setActiveTab(id) {
  if (!id) return;
  currentTab = id;
  // Marca section
  $$("main > section").forEach((s) =>
    s.classList.toggle('tab-active', s.id === id)
  );
  // Marca nav links
  $$('nav.tabs a, nav.bottom-nav a').forEach((a) =>
    a.classList.toggle('active', a.dataset.target === id)
  );
  // No mobile, sobe pro topo da viewport quando troca de tab
  if (isMobileTabs()) {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  // Plotly precisa redimensionar quando o container muda de display:none → visible
  // (mede a width na inicialização — se zero, fica gigante depois)
  if (typeof Plotly !== 'undefined') {
    requestAnimationFrame(() => {
      const plotIds = ['plot', 'porkchop', 'convergence'];
      for (const pid of plotIds) {
        const el = document.getElementById(pid);
        if (el && el.offsetWidth > 0 && el._fullLayout) {
          try { Plotly.Plots.resize(el); } catch (e) {}
        }
      }
    });
  }
}

function bindNav() {
  const allNavLinks = $$('nav.tabs a, nav.bottom-nav a');
  allNavLinks.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = a.dataset.target;
      if (!target) return;
      if (isMobileTabs()) {
        setActiveTab(target);
      } else {
        const el = document.getElementById(target);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 10;
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
  });

  // Marca todas as sections como tab-active inicialmente — display:none aplica só em mobile (via CSS)
  // mas precisa de UMA marcada como tab-active senão mobile fica vazio.
  setActiveTab(currentTab);

  // Scroll-spy desktop: usa IntersectionObserver
  const sections = $$("main > section");
  const setSpyActive = (id) => {
    if (isMobileTabs()) return; // mobile usa tabs, não scroll-spy
    $$('nav.tabs a, nav.bottom-nav a').forEach((a) =>
      a.classList.toggle('active', a.dataset.target === id)
    );
  };
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) setSpyActive(visible[0].target.id);
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
  );
  sections.forEach((s) => observer.observe(s));

  // Reage a resize entre mobile/desktop
  window.addEventListener('resize', () => {
    if (!isMobileTabs()) {
      // Em desktop, garantir que todas as sections estão visíveis
      $$("main > section").forEach((s) => s.classList.add('tab-active'));
    } else {
      // Em mobile, deixa só a current
      setActiveTab(currentTab);
    }
  });
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

// Onboarding tour — mostra 3 passos na primeira visita
const ONBOARD_KEY = 'onboard-v1-seen';
const ONBOARD_STEPS = [
  {
    title: '🛰 Boas-vindas',
    text: 'Este é um simulador de transferências interplanetárias. Resolve Lambert + PSO no navegador, sem servidor.',
  },
  {
    title: '🪐 Escolha uma missão',
    text: 'Toque num card da galeria. Compare LEO vs GEO vs swing-by por destino — cada um com seu próprio ΔV.',
  },
  {
    title: '🎛 Edite e otimize',
    text: 'No simulador, mexa os sliders e veja a trajetória recalcular. Quer encontrar o ótimo? Use a aba PSO.',
  },
];
let onboardIdx = 0;

function showOnboard() {
  try {
    if (localStorage.getItem(ONBOARD_KEY) === '1') return;
  } catch (_) {}
  onboardIdx = 0;
  $("onboard").hidden = false;
  renderOnboardStep();
}
function renderOnboardStep() {
  const step = ONBOARD_STEPS[onboardIdx];
  $("onboardStep").textContent = `${onboardIdx + 1} / ${ONBOARD_STEPS.length}`;
  $("onboardTitle").textContent = step.title;
  $("onboardText").textContent = step.text;
  $("onboardNext").textContent = onboardIdx === ONBOARD_STEPS.length - 1
    ? 'começar →' : 'próximo →';
}
function dismissOnboard() {
  $("onboard").hidden = true;
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (_) {}
}
function bindOnboard() {
  $("onboardNext").addEventListener("click", () => {
    haptic();
    if (onboardIdx >= ONBOARD_STEPS.length - 1) {
      dismissOnboard();
    } else {
      onboardIdx++;
      renderOnboardStep();
    }
  });
  $("onboardSkip").addEventListener("click", dismissOnboard);
  $("onboard").querySelector('.onboard-backdrop').addEventListener("click", dismissOnboard);
}

// Haptic feedback (no-op se browser não suportar)
function haptic(ms = 8) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) {}
  }
}

function bindTheoryTOC() {
  $$('.theory-toc a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.dataset.toc;
      const target = document.getElementById(id);
      if (!target) return;
      haptic();
      // Scroll suave dentro da tab (não troca de tab)
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ============================================================
// Compare mode — overlay de trajetórias salvas
// ============================================================

function renderCompareDrawer() {
  if (!window.Compare) return;
  const drawer = $("compareDrawer");
  const list = $("compareList");
  const count = $("compareCount");
  const items = Compare.getList();
  if (!drawer || !list || !count) return;
  count.textContent = items.length;
  if (items.length === 0) {
    drawer.hidden = true;
    list.innerHTML = '';
  } else {
    drawer.hidden = false;
    list.innerHTML = items.map((it) => `
      <div class="compare-item" data-id="${it.id}">
        <span class="compare-swatch" style="background:${it.color};color:${it.color}"></span>
        <span class="compare-item-label">${it.label}</span>
        <span class="compare-item-dv">${it.deltaV.toFixed(2)}</span>
        <button class="compare-item-remove" data-remove="${it.id}" aria-label="remover">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Compare.remove(btn.dataset.remove);
        haptic(6);
      });
    });
  }
  // Atualiza estado do botão "adicionar"
  const btnAdd = $("btnCompareAdd");
  if (btnAdd) {
    btnAdd.disabled = !Compare.canAddMore();
    btnAdd.style.opacity = btnAdd.disabled ? '0.45' : '1';
  }
  // Pausa animação em compare mode
  if (Compare.isActive() && Anim.playing) animPause();
}

function bindCompare() {
  if (!window.Compare) return;
  const btnAdd = $("btnCompareAdd");
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      if (!Anim.sim) return;
      const m = currentMission();
      const x = readInputs();
      const ok = Compare.add({
        label: m.short || m.label,
        missionId: m.id, x, sim: Anim.sim,
      });
      haptic(ok ? 10 : 18);
    });
  }
  const btnClear = $("compareClear");
  if (btnClear) btnClear.addEventListener('click', () => { Compare.clear(); haptic(8); });
  // Quando lista muda → re-render plot + drawer
  Compare.onChange(() => {
    renderCompareDrawer();
    if (Anim.sim) {
      plotTrajectory("plot", Anim.sim, {
        t: Anim.t, frame: Anim.frame, showShadow: Anim.showShadow,
      });
    }
  });
  renderCompareDrawer();
}

// ============================================================
// Share / Export — URL com state, copiar link, baixar PNG
// ============================================================

// Aplica state decodificado do hash nos inputs + frame, sem disparar
// updateURL (evita loop hashchange).
function applySharedState(state) {
  if (!state) return;
  if (Array.isArray(state.x) && state.x.length) {
    const m = currentMission();
    const lb = m.params.map((p) => p.bounds[0]);
    const ub = m.params.map((p) => p.bounds[1]);
    renderInputs(clampVec(state.x, lb, ub));
  }
  if (state.frame && state.frame !== Anim.frame) {
    Anim.frame = state.frame;
    const radioMap = { helio: 'frameHelio', geo: 'frameGeo', synodic: 'frameSyn' };
    const r = $(radioMap[state.frame]);
    if (r) r.checked = true;
  }
  refreshScenario({ pulse: false });
}

let _urlSyncTimer = 0;
function scheduleURLSync() {
  if (!window.Share || !currentMissionId) return;
  clearTimeout(_urlSyncTimer);
  _urlSyncTimer = setTimeout(() => {
    const x = readInputs();
    Share.updateURLWithState(currentMissionId, x, Anim.frame);
  }, 500);
}

function showShareModal() {
  const modal = $("shareModal");
  const url = Share.buildShareURL(currentMissionId, readInputs(), Anim.frame);
  $("shareURL").value = url;
  $("shareToast").hidden = true;
  modal.hidden = false;
  setTimeout(() => $("shareURL").select(), 50);
}
function hideShareModal() { $("shareModal").hidden = true; }

function bindShare() {
  const btn = $("btnShare");
  if (btn) btn.addEventListener('click', () => { haptic(8); showShareModal(); });
  const close = $("shareClose");
  if (close) close.addEventListener('click', hideShareModal);
  document.querySelectorAll('#shareModal [data-close]').forEach((el) =>
    el.addEventListener('click', hideShareModal)
  );
  const copyBtn = $("shareCopy");
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const url = $("shareURL").value;
      const ok = await Share.copyToClipboard(url);
      const toast = $("shareToast");
      toast.textContent = ok ? '✓ link copiado' : 'falha ao copiar — selecione manualmente';
      toast.hidden = false;
      haptic(ok ? 8 : 16);
    });
  }
  const pngBtn = $("sharePNG");
  if (pngBtn) {
    pngBtn.addEventListener('click', async () => {
      pngBtn.disabled = true;
      const m = currentMission();
      const fname = `${m.id || 'trajectory'}-${Date.now()}.png`;
      const ok = await Share.downloadPlotPNG('plot', fname);
      const toast = $("shareToast");
      toast.textContent = ok ? `✓ ${fname} baixado` : 'falha ao gerar PNG';
      toast.hidden = false;
      haptic(8);
      pngBtn.disabled = false;
    });
  }
  // Esc fecha
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$("shareModal").hidden) hideShareModal();
  });
}

function bindEvents() {
  $("btnRun").addEventListener("click", runPSO);
  $("btnStop").addEventListener("click", stopPSO);
  bindPorkchop();
  bindNav();
  bindReveal();
  bindAnim();
  bindTheoryTOC();
  bindOnboard();
  bindShare();
  bindCompare();
  // Haptic feedback em interações principais (mobile)
  $$('nav.bottom-nav a').forEach((a) =>
    a.addEventListener('click', () => haptic(6))
  );
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.matches('.preset-btn, .filter-chip, .mission-card, #btnRun, #btnPorkchop, .btn-icon')) {
      haptic(8);
    }
  }, true);
  window.addEventListener('hashchange', handleHashRoute);
}

function applyDetailsStateForViewport() {
  const isMobile = isMobileTabs();
  $$("details.params-accordion, details.porkchop-ranges-details").forEach((d) => {
    d.open = !isMobile;
  });
}

// ResizeObserver: força Plotly re-layout quando o container do plot muda
function bindPlotResize() {
  if (typeof ResizeObserver === 'undefined') return;
  const plotIds = ['plot', 'porkchop', 'convergence'];
  const ro = new ResizeObserver((entries) => {
    if (typeof Plotly === 'undefined') return;
    for (const e of entries) {
      if (e.contentRect.width > 0 && e.target._fullLayout) {
        try { Plotly.Plots.resize(e.target); } catch (_) {}
      }
    }
  });
  // Observa quando os elementos existem
  plotIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) ro.observe(el);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  applyDetailsStateForViewport();
  bindPlotResize();
  window.addEventListener('resize', applyDetailsStateForViewport);
  const initialHash = window.location.hash;
  // Parse nova rota #/m/<id>?s=<b64> e legacy #/mission/<id>
  const parsedShare = window.Share ? Share.parseHash(initialHash) : null;
  const legacy = initialHash.match(/^#\/mission\/([\w-]+)/);
  let initialMission = 'mars-direct-leo';
  let initialState = null;
  if (parsedShare && parsedShare.missionId && Missions[parsedShare.missionId]) {
    initialMission = parsedShare.missionId;
    initialState = parsedShare.state;
  } else if (legacy && Missions[legacy[1]]) {
    initialMission = legacy[1];
  }
  setMission(initialMission);
  if (initialState) applySharedState(initialState);
  renderGallery();
  const m = parsedShare || legacy; // truthy se URL pediu uma missão específica
  // Mobile: começa na galeria; se URL pediu missão, vai pro simulador
  if (isMobileTabs()) {
    setActiveTab(m ? 'simulador' : 'galeria');
  } else if (m) {
    setTimeout(() => {
      const target = $("simulador");
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 10;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }, 200);
  }
  // Onboarding tour só na primeira visita
  setTimeout(showOnboard, 500);
});
