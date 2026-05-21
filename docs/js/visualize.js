// Visualizações com Plotly: trajetória (estática ou animada por frame),
// porkchop interativo e convergência do PSO.

const UA = 1.496e8;

// Constrói os traces base da trajetória em um dado frame de referência.
// Mission-aware: respeita visibleBodies, plotUnit, e centralBody.
function buildTrajectoryTraces(sim, opts) {
  const t = opts.t ?? sim.t_total_s;
  const frame = opts.frame || 'helio';
  const showShadow = !!opts.showShadow;
  const traces = [];

  // Escala de plot: UA pra missões heliocêntricas, 1000 km pra geo (Lua).
  // sim.mission.plotUnit é 'AU' ou 'kkm'
  const mission = sim.mission;
  const scale_km = (mission && mission.plotUnit === 'kkm') ? 1000 : UA;
  const unitLabel = (mission && mission.plotUnit === 'kkm') ? 'mil km' : 'UA';

  // Estado atual e shadow
  const stCur = Animation.stateAt(sim, t);
  const frCur = Animation.applyFrame(stCur, sim, t, frame);
  const st0 = Animation.stateAt(sim, 0);
  const fr0 = Animation.applyFrame(st0, sim, 0, frame);

  // Lista de corpos a renderizar (vem da missão; fallback nos default)
  const visibleBodies = (mission && mission.visibleBodies)
    || ['sol', 'terra', 'venus', 'marte'];
  // Sol/corpo central vai à parte
  const centralId = mission ? mission.centralBody : 'sol';
  const planetIds = visibleBodies.filter((id) => id !== centralId);

  // === ÓRBITAS DE FUNDO ===
  if (frame === 'helio') {
    // Círculos das órbitas (em torno do corpo central) — apenas para corpos visíveis
    const circleAt = (R, name, color) => {
      const xs = [], ys = [];
      for (let i = 0; i <= 360; i++) {
        const a = (i * Math.PI) / 180;
        xs.push((R * Math.cos(a)) / scale_km);
        ys.push((R * Math.sin(a)) / scale_km);
      }
      return {
        x: xs, y: ys, mode: 'lines', type: 'scatter', name,
        line: { color, dash: 'dash', width: 1 },
        hoverinfo: 'name', showlegend: true,
      };
    };
    for (const pid of planetIds) {
      const b = Bodies[pid];
      if (b && b.orbital_radius) {
        traces.push(circleAt(b.orbital_radius, `Órbita ${b.label}`, b.color));
      }
    }
  } else {
    // Em geo/synodic, plota os traços (epicycles) dos planetas no frame
    for (const pid of planetIds) {
      const b = Bodies[pid];
      if (!b) continue;
      const pts = Animation.planetTrail(sim, pid, sim.t_total_s, frame, 200);
      traces.push({
        x: pts.map((q) => q[0] / scale_km),
        y: pts.map((q) => q[1] / scale_km),
        mode: 'lines', type: 'scatter', name: `Caminho ${b.label}`,
        line: { color: b.color, dash: 'dot', width: 1 },
        hoverinfo: 'name', showlegend: true, opacity: 0.55,
      });
    }
  }

  // === SHADOWS (posição inicial dos planetas) ===
  if (showShadow) {
    for (const pid of planetIds) {
      const b = Bodies[pid];
      const pos = fr0[pid] || (pid === 'earth' && fr0.earth) || (pid === 'venus' && fr0.venus) || (pid === 'mars' && fr0.mars);
      if (!b || !pos) continue;
      traces.push({
        x: [pos[0] / scale_km], y: [pos[1] / scale_km],
        mode: 'markers', type: 'scatter', name: `${b.label} (t=0)`,
        marker: { size: 9, color: b.color, opacity: 0.32, symbol: 'circle-open', line: { width: 2, color: b.color } },
        hovertemplate: `${b.label} em t=0<extra></extra>`, showlegend: true,
      });
    }
  }

  // === CORPO CENTRAL ===
  const central = Bodies[centralId];
  if (central) {
    // No frame helio, central body fica na origem; em geo/sinódico, frCur.sun é o sol deslocado
    const centralPos = (centralId === 'sol') ? frCur.sun : [0, 0, 0];
    traces.push({
      x: [centralPos[0] / scale_km], y: [centralPos[1] / scale_km],
      mode: 'markers', type: 'scatter', name: central.label,
      marker: { size: 14, color: central.color, line: { color: '#f59e0b', width: 1 } },
      hovertemplate: `${central.label}<extra></extra>`,
    });
  }

  // === PLANETAS NA POSIÇÃO ATUAL ===
  const drawBody = (pos, label, color) => ({
    x: [pos[0] / scale_km], y: [pos[1] / scale_km],
    mode: 'markers+text', type: 'scatter', name: label,
    text: [label], textposition: 'top center',
    textfont: { size: 11 },
    marker: { size: 11, color },
    hovertemplate: `${label}<extra></extra>`,
  });
  for (const pid of planetIds) {
    const b = Bodies[pid];
    // frCur usa chaves 'earth'/'venus'/'mars'/'sun' (legado), mapeamento:
    const frKey = pid === 'terra' ? 'earth' : pid === 'venus' ? 'venus' : pid === 'marte' ? 'mars' : pid;
    const pos = frCur[frKey] || frCur[pid];
    if (!b || !pos) continue;
    traces.push(drawBody(pos, b.label, b.color));
  }

  // === TRAIL DA NAVE ===
  if (t > 0) {
    const trailPts = Animation.trail(sim, t, frame, 100);
    if (trailPts.length > 1) {
      traces.push({
        x: trailPts.map((p) => p[0] / scale_km),
        y: trailPts.map((p) => p[1] / scale_km),
        mode: 'lines', type: 'scatter', name: 'Trajetória',
        line: { color: '#22d3ee', width: 2.5 },
        hoverinfo: 'name', showlegend: true,
      });
    }
  }

  // === NAVE (ponto atual) ===
  if (frCur.craft) {
    traces.push({
      x: [frCur.craft[0] / scale_km], y: [frCur.craft[1] / scale_km],
      mode: 'markers', type: 'scatter', name: 'Nave',
      marker: {
        size: 12, color: '#a78bfa', symbol: 'diamond',
        line: { color: '#fff', width: 1.5 },
      },
      hovertemplate: 'Nave<extra></extra>',
    });
  }

  return traces;
}

// Computa o range correto pro frame e missão (auto-zoom)
function computeLim(sim, frame) {
  const mission = sim.mission;
  const isKkm = mission && mission.plotUnit === 'kkm';
  if (isKkm) return 500;
  const visible = (mission && mission.visibleBodies) || ['terra', 'venus', 'marte'];
  let maxR_AU = 0;
  for (const pid of visible) {
    const b = Bodies[pid];
    if (b && b.orbital_radius) maxR_AU = Math.max(maxR_AU, b.orbital_radius / UA);
  }
  const lim = maxR_AU > 0 ? maxR_AU * 1.15 : 1.7;
  if (frame === 'geo') return lim * 1.6;
  if (frame === 'synodic') return lim * 1.1;
  return lim;
}

function plotTrajectory(divId, sim, opts = {}) {
  const t = opts.t ?? sim.t_total_s;
  const frame = opts.frame || 'helio';
  const isNarrow = window.innerWidth < 820;
  const traces = buildTrajectoryTraces(sim, { t, frame, showShadow: !!opts.showShadow });
  const lim = computeLim(sim, frame);
  const isKkm = sim.mission && sim.mission.plotUnit === 'kkm';
  const unit = isKkm ? 'mil km' : 'UA';

  const centralLabel = sim.mission ? Bodies[sim.mission.centralBody].label : 'Sol';
  const titleMap = {
    helio: `${centralLabel}-cêntrico inercial`,
    geo: `Geocêntrico (Terra fixa)`,
    synodic: `Sinódico Terra-${centralLabel} (rotativo)`,
  };

  const layout = {
    paper_bgcolor: '#070912',
    plot_bgcolor: '#070912',
    font: { color: '#e8eefb', size: 11 },
    xaxis: {
      title: { text: `x [${unit}]` }, range: [-lim, lim],
      gridcolor: '#1d2742', zerolinecolor: '#2c3a66',
      scaleanchor: 'y', scaleratio: 1,
    },
    yaxis: {
      title: { text: `y [${unit}]` }, range: [-lim, lim],
      gridcolor: '#1d2742', zerolinecolor: '#2c3a66',
    },
    margin: isNarrow ? { t: 30, l: 40, r: 12, b: 70 } : { t: 30, l: 50, r: 12, b: 40 },
    showlegend: true,
    legend: isNarrow
      ? { bgcolor: 'rgba(7,9,18,0.7)', bordercolor: '#1d2742', borderwidth: 1,
          font: { size: 9 }, orientation: 'h',
          x: 0.5, xanchor: 'center', y: -0.18, yanchor: 'top' }
      : { bgcolor: 'rgba(7,9,18,0.7)', bordercolor: '#1d2742', borderwidth: 1,
          font: { size: 10 }, orientation: 'v',
          x: 1.02, xanchor: 'left', y: 1, yanchor: 'top' },
    title: { text: opts.title || titleMap[frame], font: { size: 13 } },
  };

  Plotly.newPlot(divId, traces, layout, { responsive: true, displaylogo: false });
}

// Atualização rápida da animação — re-renderiza só os traces que mudam.
function updateTrajectoryFrame(divId, sim, opts) {
  const traces = buildTrajectoryTraces(sim, opts);
  const div = document.getElementById(divId);
  if (!div || !div.data) {
    plotTrajectory(divId, sim, opts);
    return;
  }
  Plotly.react(divId, traces, div.layout, { responsive: true, displaylogo: false });
}

function plotConvergence(divId, history) {
  const trace = {
    x: history.map((_, i) => i),
    y: history,
    mode: 'lines+markers',
    type: 'scatter',
    line: { color: '#22d3ee', width: 2, shape: 'spline' },
    marker: { size: 5, color: '#a78bfa' },
    fill: 'tozeroy',
    fillcolor: 'rgba(34, 211, 238, 0.08)',
    name: 'Melhor ΔV',
  };
  const layout = {
    paper_bgcolor: '#070912', plot_bgcolor: '#070912',
    font: { color: '#e8eefb', size: 11 },
    xaxis: { title: 'Iteração', gridcolor: '#1d2742' },
    yaxis: { title: 'ΔV [km/s]', gridcolor: '#1d2742' },
    margin: { t: 24, l: 50, r: 12, b: 40 },
    showlegend: false,
  };
  Plotly.newPlot(divId, [trace], layout, { responsive: true, displaylogo: false });
}

// =============================================================================
// Porkchop genérico — varia dois parâmetros quaisquer, os outros ficam fixos.
// =============================================================================
//
// exploration = {
//   venusSwingBy: bool,
//   xIdx, yIdx: índice no vetor de parâmetros (depende do modo)
//   xKind, yKind: 'angle' | 'days' | 'ratio'
//   xMin, xMax, yMin, yMax: defaults em unidades de display (graus, dias, ratio)
//   xLabel, yLabel: rótulos pros eixos
// }
// opts.baseX = vetor de parâmetros base (os fixos vêm daqui)
// opts.xMin/xMax/yMin/yMax = override dos ranges
// opts.N = densidade da grade (default 50)
// opts.onClick = (point) => apply (x value, y value)
function plotPorkchop(divId, opts) {
  const e = opts.exploration;
  const xMin = opts.xMin ?? e.xMin;
  const xMax = opts.xMax ?? e.xMax;
  const yMin = opts.yMin ?? e.yMin;
  const yMax = opts.yMax ?? e.yMax;
  const N = opts.N || 50;
  const baseX = opts.baseX.slice();

  const xVals = [];
  const yVals = [];
  for (let i = 0; i < N; i++) xVals.push(xMin + ((xMax - xMin) * i) / (N - 1));
  for (let j = 0; j < N; j++) yVals.push(yMin + ((yMax - yMin) * j) / (N - 1));

  const toModel = (val, kind) => (kind === 'angle' ? (val * Math.PI) / 180 : val);

  const z = [];
  for (let j = 0; j < N; j++) {
    const row = [];
    for (let i = 0; i < N; i++) {
      const xv = baseX.slice();
      xv[e.xIdx] = toModel(xVals[i], e.xKind);
      xv[e.yIdx] = toModel(yVals[j], e.yKind);
      // Aceita exploration.missionId (nova) ou fallback pra venusSwingBy (legado)
      const c = e.missionId
        ? cost(e.missionId, xv)
        : cost(xv, { venusSwingBy: e.venusSwingBy });
      row.push(isFinite(c) ? Math.min(c, 30) : 30);
    }
    z.push(row);
  }

  const trace = {
    z, x: xVals, y: yVals,
    type: 'contour', colorscale: 'Viridis',
    contours: { coloring: 'heatmap' },
    colorbar: { title: 'ΔV [km/s]', thickness: 14 },
    hovertemplate: `${e.xLabel}: %{x:.2f}<br>${e.yLabel}: %{y:.2f}<br>ΔV = %{z:.2f} km/s<extra></extra>`,
  };
  const layout = {
    paper_bgcolor: '#070912', plot_bgcolor: '#070912',
    font: { color: '#e8eefb', size: 11 },
    xaxis: {
      title: { text: e.xLabel, standoff: 12, font: { size: 12 } },
      gridcolor: '#1d2742',
      automargin: true,
    },
    yaxis: {
      title: { text: e.yLabel, standoff: 12, font: { size: 12 } },
      gridcolor: '#1d2742',
      automargin: true,
    },
    title: { text: opts.title || 'Porkchop (clique para aplicar)', font: { size: 13 } },
    margin: { t: 40, l: 80, r: 60, b: 60 },
  };
  Plotly.newPlot(divId, [trace], layout, { responsive: true, displaylogo: false });

  if (opts.onClick) {
    document.getElementById(divId).on('plotly_click', (data) => {
      if (!data.points || data.points.length === 0) return;
      const p = data.points[0];
      opts.onClick({
        xValue: p.x,
        yValue: p.y,
        cost: p.z,
        xIdx: e.xIdx,
        yIdx: e.yIdx,
        xKind: e.xKind,
        yKind: e.yKind,
        venusSwingBy: e.venusSwingBy,
      });
    });
  }
}
