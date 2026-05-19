// Plot da trajetória + órbitas planetárias com Plotly

function plotTrajectory(divId, sim, opts = {}) {
  const C = PhysicalConstants;
  const UA = C.UA;
  const traces = [];

  // Órbitas planetárias (círculos)
  const orbitCircle = (R, name, color) => {
    const xs = [], ys = [];
    for (let i = 0; i <= 360; i++) {
      const a = (i * Math.PI) / 180;
      xs.push((R * Math.cos(a)) / UA);
      ys.push((R * Math.sin(a)) / UA);
    }
    return {
      x: xs, y: ys, mode: "lines", type: "scatter", name,
      line: { color, dash: "dash", width: 1 },
      hoverinfo: "name",
    };
  };

  traces.push(orbitCircle(C.r_st, "Órbita Terra", "#3da9fc"));
  traces.push(orbitCircle(C.r_sv, "Órbita Vênus", "#f7c948"));
  traces.push(orbitCircle(C.r_sm, "Órbita Marte", "#ef4444"));

  // Sol
  traces.push({
    x: [0], y: [0], mode: "markers", type: "scatter", name: "Sol",
    marker: { size: 14, color: "#fbbf24", line: { color: "#f59e0b", width: 1 } },
  });

  // Planetas
  const drawPlanet = (r, name, color) => ({
    x: [r[0] / UA], y: [r[1] / UA],
    mode: "markers+text", type: "scatter", name,
    text: [name], textposition: "top center",
    marker: { size: 10, color },
  });
  traces.push(drawPlanet(sim.r_terra_sol, "Terra", "#3da9fc"));
  traces.push(drawPlanet(sim.r_venus_sol, "Vênus", "#f7c948"));
  traces.push(drawPlanet(sim.r_marte_sol, "Marte", "#ef4444"));

  // Trajetórias
  const trajColors = ["#22d3ee", "#a78bfa"];
  sim.trajetorias.forEach((t, i) => {
    const pts = sampleOrbit(t.r0, t.v0, t.mi, 720);
    traces.push({
      x: pts.map((p) => p.x / UA),
      y: pts.map((p) => p.y / UA),
      mode: "lines",
      type: "scatter",
      name: t.label,
      line: { color: trajColors[i % trajColors.length], width: 2 },
    });
  });

  const lim = opts.lim || 1.7;
  const layout = {
    paper_bgcolor: "#0b1020",
    plot_bgcolor: "#0b1020",
    font: { color: "#e6edf3" },
    xaxis: {
      title: "x [UA]", range: [-lim, lim],
      gridcolor: "#1f2937", zerolinecolor: "#374151", scaleanchor: "y", scaleratio: 1,
    },
    yaxis: {
      title: "y [UA]", range: [-lim, lim],
      gridcolor: "#1f2937", zerolinecolor: "#374151",
    },
    margin: { t: 30, l: 60, r: 20, b: 50 },
    showlegend: true,
    legend: { bgcolor: "rgba(11,16,32,0.6)", bordercolor: "#1f2937", borderwidth: 1 },
    title: { text: opts.title || "Cônicas da trajetória", font: { size: 14 } },
  };

  Plotly.newPlot(divId, traces, layout, { responsive: true, displaylogo: false });
}

function plotConvergence(divId, history) {
  const trace = {
    x: history.map((_, i) => i),
    y: history,
    mode: "lines+markers",
    type: "scatter",
    line: { color: "#22d3ee", width: 2 },
    marker: { size: 4 },
    name: "Melhor custo",
  };
  const layout = {
    paper_bgcolor: "#0b1020",
    plot_bgcolor: "#0b1020",
    font: { color: "#e6edf3" },
    xaxis: { title: "Iteração", gridcolor: "#1f2937" },
    yaxis: { title: "ΔV [km/s]", gridcolor: "#1f2937" },
    margin: { t: 30, l: 60, r: 20, b: 50 },
    showlegend: false,
    title: { text: "Convergência do PSO", font: { size: 14 } },
  };
  Plotly.newPlot(divId, [trace], layout, { responsive: true, displaylogo: false });
}

function plotPorkchop(divId, opts = {}) {
  const venusSwingBy = false;
  const phaseMarteMin = 0, phaseMarteMax = 2 * Math.PI;
  const tMin = 120, tMax = 360;
  const N = opts.N || 60;
  const z = [];
  const phases = [];
  const times = [];
  for (let i = 0; i < N; i++) phases.push(phaseMarteMin + (phaseMarteMax - phaseMarteMin) * i / (N - 1));
  for (let j = 0; j < N; j++) times.push(tMin + (tMax - tMin) * j / (N - 1));
  for (let j = 0; j < N; j++) {
    const row = [];
    for (let i = 0; i < N; i++) {
      const x = [phases[i], times[j]];
      const c = cost(x, { venusSwingBy });
      row.push(isFinite(c) ? Math.min(c, 30) : 30);
    }
    z.push(row);
  }
  const trace = {
    z, x: phases.map((p) => (p * 180) / Math.PI), y: times,
    type: "contour", colorscale: "Viridis",
    contours: { coloring: "heatmap" },
    colorbar: { title: "ΔV [km/s]" },
  };
  const layout = {
    paper_bgcolor: "#0b1020", plot_bgcolor: "#0b1020",
    font: { color: "#e6edf3" },
    xaxis: { title: "fase de Marte [graus]", gridcolor: "#1f2937" },
    yaxis: { title: "tempo de transferência [dias]", gridcolor: "#1f2937" },
    title: { text: "Porkchop plot: Terra → Marte direto", font: { size: 14 } },
    margin: { t: 40, l: 70, r: 60, b: 50 },
  };
  Plotly.newPlot(divId, [trace], layout, { responsive: true, displaylogo: false });
}
