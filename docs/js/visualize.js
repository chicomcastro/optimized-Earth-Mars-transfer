// Visualizações com Plotly: trajetória (estática ou animada por frame),
// porkchop interativo e convergência do PSO.

const UA = 1.496e8;

// Constrói os traces base da trajetória em um dado frame de referência.
// Inclui órbitas planetárias (helio only), planetas, nave, trail, shadows.
function buildTrajectoryTraces(sim, opts) {
  const t = opts.t ?? sim.t_total_s;
  const frame = opts.frame || 'helio';
  const showShadow = !!opts.showShadow;
  const C = PhysicalConstants;
  const traces = [];

  // Estado atual e shadow
  const stCur = Animation.stateAt(sim, t);
  const frCur = Animation.applyFrame(stCur, sim, t, frame);
  const st0 = Animation.stateAt(sim, 0);
  const fr0 = Animation.applyFrame(st0, sim, 0, frame);

  // === ÓRBITAS DE FUNDO ===
  if (frame === 'helio') {
    // Círculos das órbitas planetárias (Sun-centered, planos)
    const circleAt = (R, name, color) => {
      const xs = [], ys = [];
      for (let i = 0; i <= 360; i++) {
        const a = (i * Math.PI) / 180;
        xs.push((R * Math.cos(a)) / UA);
        ys.push((R * Math.sin(a)) / UA);
      }
      return {
        x: xs, y: ys, mode: 'lines', type: 'scatter', name,
        line: { color, dash: 'dash', width: 1 },
        hoverinfo: 'name', showlegend: true,
      };
    };
    traces.push(circleAt(C.r_st, 'Órbita Terra', '#3da9fc'));
    traces.push(circleAt(C.r_sv, 'Órbita Vênus', '#f7c948'));
    traces.push(circleAt(C.r_sm, 'Órbita Marte', '#ef4444'));
  } else {
    // Em geo/synodic, plota os traços (epicycles) dos planetas no frame
    const planets = [
      { key: 'earth', name: 'Caminho Terra', color: '#3da9fc' },
      { key: 'venus', name: 'Caminho Vênus', color: '#f7c948' },
      { key: 'mars', name: 'Caminho Marte', color: '#ef4444' },
    ];
    for (const p of planets) {
      const pts = Animation.planetTrail(sim, p.key, sim.t_total_s, frame, 200);
      traces.push({
        x: pts.map((q) => q[0] / UA),
        y: pts.map((q) => q[1] / UA),
        mode: 'lines', type: 'scatter', name: p.name,
        line: { color: p.color, dash: 'dot', width: 1 },
        hoverinfo: 'name', showlegend: true, opacity: 0.55,
      });
    }
  }

  // === SHADOWS (posição inicial dos planetas) ===
  if (showShadow) {
    const shadowMarker = (pos, name, color) => ({
      x: [pos[0] / UA], y: [pos[1] / UA],
      mode: 'markers', type: 'scatter', name: `${name} (t=0)`,
      marker: { size: 9, color, opacity: 0.32, symbol: 'circle-open', line: { width: 2, color } },
      hovertemplate: `${name} em t=0<extra></extra>`, showlegend: true,
    });
    traces.push(shadowMarker(fr0.earth, 'Terra', '#3da9fc'));
    traces.push(shadowMarker(fr0.venus, 'Vênus', '#f7c948'));
    traces.push(shadowMarker(fr0.mars, 'Marte', '#ef4444'));
  }

  // === SOL ===
  traces.push({
    x: [frCur.sun[0] / UA], y: [frCur.sun[1] / UA],
    mode: 'markers', type: 'scatter', name: 'Sol',
    marker: { size: 14, color: '#fbbf24', line: { color: '#f59e0b', width: 1 } },
    hovertemplate: 'Sol<extra></extra>',
  });

  // === PLANETAS NA POSIÇÃO ATUAL ===
  const drawPlanet = (pos, name, color) => ({
    x: [pos[0] / UA], y: [pos[1] / UA],
    mode: 'markers+text', type: 'scatter', name,
    text: [name], textposition: 'top center',
    textfont: { size: 11 },
    marker: { size: 11, color },
    hovertemplate: `${name}<extra></extra>`,
  });
  traces.push(drawPlanet(frCur.earth, 'Terra', '#3da9fc'));
  traces.push(drawPlanet(frCur.venus, 'Vênus', '#f7c948'));
  traces.push(drawPlanet(frCur.mars, 'Marte', '#ef4444'));

  // === TRAIL DA NAVE ===
  if (t > 0) {
    const trailPts = Animation.trail(sim, t, frame, 100);
    if (trailPts.length > 1) {
      traces.push({
        x: trailPts.map((p) => p[0] / UA),
        y: trailPts.map((p) => p[1] / UA),
        mode: 'lines', type: 'scatter', name: 'Trajetória',
        line: { color: '#22d3ee', width: 2.5 },
        hoverinfo: 'name', showlegend: true,
      });
    }
  }

  // === NAVE (ponto atual) ===
  if (frCur.craft) {
    traces.push({
      x: [frCur.craft[0] / UA], y: [frCur.craft[1] / UA],
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

// Computa o range correto pro frame e config (auto-zoom)
function computeLim(sim, frame) {
  if (frame === 'helio') return 1.7;
  if (frame === 'geo') {
    // Mostra até Marte máximo a partir da Terra: ~2.5 UA
    return 2.7;
  }
  if (frame === 'synodic') return 1.9;
  return 1.7;
}

function plotTrajectory(divId, sim, opts = {}) {
  const t = opts.t ?? sim.t_total_s;
  const frame = opts.frame || 'helio';
  const isNarrow = window.innerWidth < 820;
  const traces = buildTrajectoryTraces(sim, { t, frame, showShadow: !!opts.showShadow });
  const lim = computeLim(sim, frame);

  const titleMap = {
    helio: 'Heliocêntrico inercial',
    geo: 'Geocêntrico (Terra fixa)',
    synodic: 'Sinódico Terra-Sol (rotativo)',
  };

  const layout = {
    paper_bgcolor: '#070912',
    plot_bgcolor: '#070912',
    font: { color: '#e8eefb', size: 11 },
    xaxis: {
      title: 'x [UA]', range: [-lim, lim],
      gridcolor: '#1d2742', zerolinecolor: '#2c3a66',
      scaleanchor: 'y', scaleratio: 1,
    },
    yaxis: {
      title: 'y [UA]', range: [-lim, lim],
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

function plotPorkchop(divId, opts = {}) {
  const venusSwingBy = false;
  const phaseMin = 0, phaseMax = 2 * Math.PI;
  const tMin = 120, tMax = 360;
  const N = opts.N || 60;
  const z = [];
  const phases = [];
  const times = [];
  for (let i = 0; i < N; i++) phases.push(phaseMin + (phaseMax - phaseMin) * i / (N - 1));
  for (let j = 0; j < N; j++) times.push(tMin + (tMax - tMin) * j / (N - 1));
  for (let j = 0; j < N; j++) {
    const row = [];
    for (let i = 0; i < N; i++) {
      const c = cost([phases[i], times[j]], { venusSwingBy });
      row.push(isFinite(c) ? Math.min(c, 30) : 30);
    }
    z.push(row);
  }
  const phaseDeg = phases.map((p) => (p * 180) / Math.PI);
  const trace = {
    z, x: phaseDeg, y: times,
    type: 'contour', colorscale: 'Viridis',
    contours: { coloring: 'heatmap' },
    colorbar: { title: 'ΔV [km/s]', thickness: 14 },
    hovertemplate: 'fase Marte: %{x:.1f}°<br>t = %{y:.0f} d<br>ΔV = %{z:.2f} km/s<extra></extra>',
  };
  const layout = {
    paper_bgcolor: '#070912', plot_bgcolor: '#070912',
    font: { color: '#e8eefb', size: 11 },
    xaxis: { title: 'fase de Marte [°]', gridcolor: '#1d2742' },
    yaxis: { title: 'tempo de voo [d]', gridcolor: '#1d2742' },
    title: { text: 'Porkchop — Terra → Marte (clique para aplicar)', font: { size: 13 } },
    margin: { t: 40, l: 56, r: 60, b: 50 },
  };
  Plotly.newPlot(divId, [trace], layout, { responsive: true, displaylogo: false });

  if (opts.onClick) {
    document.getElementById(divId).on('plotly_click', (data) => {
      if (!data.points || data.points.length === 0) return;
      const p = data.points[0];
      opts.onClick({ phaseDeg: p.x, tDays: p.y, cost: p.z });
    });
  }
}
