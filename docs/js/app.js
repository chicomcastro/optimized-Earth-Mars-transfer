// Controlador principal da UI

// Pontos de partida da exploração — obtidos por PSO neste mesmo código JS.
const PRESETS = {
  swingBy: {
    label: "Swing-by por Vênus (ótimo PSO)",
    venusSwingBy: true,
    // ΔV ≈ 8.02 km/s
    x: [6.1836, 3.1398, 120.76, 215.14, 0.0943],
  },
  swingByAlt: {
    label: "Swing-by — chute exploratório",
    venusSwingBy: true,
    x: [Math.PI, Math.PI / 2, 150, 200, 0.05],
  },
  direct: {
    label: "Transferência direta (ótimo PSO ≈ Hohmann)",
    venusSwingBy: false,
    // ΔV ≈ 5.71 km/s — phase ≈ π (oposição) e tempo ≈ 259 dias
    x: [Math.PI, 258.8],
  },
};

const $ = (id) => document.getElementById(id);

let currentRun = null;
let convergenceHistory = [];

function fmt(x, d = 4) {
  if (!isFinite(x)) return "∞";
  return Number(x).toFixed(d);
}

function radToDeg(r) { return (r * 180) / Math.PI; }

function renderInputs(venusSwingBy, values) {
  const bnd = defaultBounds(venusSwingBy);
  const html = bnd.labels.map((label, i) => {
    const lo = bnd.lb[i], hi = bnd.ub[i];
    const isAngle = label.toLowerCase().includes("fase");
    const display = isAngle ? radToDeg(values[i]).toFixed(2) : values[i].toFixed(3);
    return `
      <div class="param-row">
        <label>${label}${isAngle ? " [°]" : ""}</label>
        <input type="number" step="any" data-idx="${i}" data-angle="${isAngle}"
               value="${display}" min="${isAngle ? radToDeg(lo) : lo}"
               max="${isAngle ? radToDeg(hi) : hi}" />
        <span class="bounds">[${isAngle ? radToDeg(lo).toFixed(1) : lo}, ${isAngle ? radToDeg(hi).toFixed(1) : hi}]</span>
      </div>
    `;
  }).join("");
  $("paramInputs").innerHTML = html;
}

function readInputs(venusSwingBy) {
  const inputs = $("paramInputs").querySelectorAll("input");
  const x = new Array(inputs.length);
  inputs.forEach((inp) => {
    const idx = parseInt(inp.dataset.idx, 10);
    const isAngle = inp.dataset.angle === "true";
    const v = parseFloat(inp.value);
    x[idx] = isAngle ? (v * Math.PI) / 180 : v;
  });
  return x;
}

function refreshScenario() {
  const venusSwingBy = $("modeSwingBy").checked;
  const bnd = defaultBounds(venusSwingBy);
  const x = readInputs(venusSwingBy);
  const xClamped = clampVec(x, bnd.lb, bnd.ub);
  const sim = simulate(xClamped, { venusSwingBy });
  renderResults(sim, xClamped, venusSwingBy);
  plotTrajectory("plot", sim, {
    title: venusSwingBy
      ? "Trajetória Terra → Vênus → Marte"
      : "Trajetória Terra → Marte (direta)",
  });
}

function renderResults(sim, x, venusSwingBy) {
  const lines = [];
  lines.push(`<div class="result-line"><strong>ΔV total:</strong> <span class="cost">${fmt(sim.cost, 4)} km/s</span></div>`);
  const labels = venusSwingBy
    ? ["partida (Terra)", "saída Vênus pós swing-by", "captura em Marte"]
    : ["partida (Terra)", "captura em Marte"];
  sim.deltaV.forEach((d, i) => {
    lines.push(`<div class="result-line">ΔV${i + 1} (${labels[i] || ""}): <code>${fmt(d, 4)}</code> km/s</div>`);
  });
  const paramNames = defaultBounds(venusSwingBy).labels;
  paramNames.forEach((name, i) => {
    let val = x[i];
    let unit = "";
    if (name.toLowerCase().includes("fase")) {
      val = radToDeg(val);
      unit = "°";
    } else if (name.toLowerCase().includes("dias")) {
      unit = " dias";
    }
    lines.push(`<div class="result-line muted">${name}: <code>${fmt(val, 3)}${unit}</code></div>`);
  });
  $("results").innerHTML = lines.join("");
}

function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  $("modeSwingBy").checked = p.venusSwingBy;
  $("modeDirect").checked = !p.venusSwingBy;
  renderInputs(p.venusSwingBy, p.x.slice());
  refreshScenario();
}

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
      convergenceHistory.push(st.bestGlobalCost);
      $("psoStatus").textContent =
        `iteração ${st.iteration}/${st.maxIteration} • melhor ΔV = ${fmt(st.bestGlobalCost, 4)} km/s`;
      $("psoProgressBar").style.width =
        `${(st.iteration / st.maxIteration) * 100}%`;
      plotConvergence("convergence", convergenceHistory);
    },
  });
  currentRun = pso;
  $("btnRun").disabled = true;
  $("btnStop").disabled = false;
  $("psoStatus").textContent = "executando PSO...";

  const result = await pso.run({ chunkMs: 50 });

  $("btnRun").disabled = false;
  $("btnStop").disabled = true;
  $("psoStatus").textContent =
    `finalizado • melhor ΔV = ${fmt(result.bestGlobalCost, 4)} km/s em ${result.iteration} iterações`;
  renderInputs(venusSwingBy, result.bestGlobal.slice());
  refreshScenario();
  currentRun = null;
}

function stopPSO() {
  if (currentRun) currentRun.stop();
}

function bindModeRadios() {
  ["modeSwingBy", "modeDirect"].forEach((id) => {
    $(id).addEventListener("change", () => {
      const venusSwingBy = $("modeSwingBy").checked;
      const preset = venusSwingBy ? PRESETS.swingBy : PRESETS.direct;
      renderInputs(venusSwingBy, preset.x.slice());
      refreshScenario();
    });
  });
}

function bindEvents() {
  $("paramInputs").addEventListener("input", () => refreshScenario());
  $("btnRun").addEventListener("click", runPSO);
  $("btnStop").addEventListener("click", stopPSO);
  $("btnPorkchop").addEventListener("click", () => {
    $("btnPorkchop").disabled = true;
    $("btnPorkchop").textContent = "calculando...";
    setTimeout(() => {
      plotPorkchop("porkchop", { N: 50 });
      $("btnPorkchop").disabled = false;
      $("btnPorkchop").textContent = "gerar porkchop";
    }, 20);
  });
  $$.qsa(".preset-btn").forEach((b) =>
    b.addEventListener("click", () => applyPreset(b.dataset.preset))
  );
  bindModeRadios();
}

const $$ = {
  qsa: (sel) => Array.from(document.querySelectorAll(sel)),
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  applyPreset("swingBy");
});
