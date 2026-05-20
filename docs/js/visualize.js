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
    paper_bgcolor: "#070912",
    plot_bgcolor: "#070912",
    font: { color: "#e8eefb", size: 11 },
    xaxis: {
      title: "x [UA]", range: [-lim, lim],
      gridcolor: "#1d2742", zerolinecolor: "#2c3a66", scaleanchor: "y", scaleratio: 1,
    },
    yaxis: {
      title: "y [UA]", range: [-lim, lim],
      gridcolor: "#1d2742", zerolinecolor: "#2c3a66",
    },
    margin: { t: 30, l: 50, r: 12, b: 40 },
    showlegend: true,
    legend: {
      bgcolor: "rgba(7,9,18,0.7)", bordercolor: "#1d2742", borderwidth: 1,
      font: { size: 10 }, orientation: "v",
      x: 1.02, xanchor: "left", y: 1, yanchor: "top",
    },
    title: { text: opts.title || "Cônicas da trajetória", font: { size: 13 } },
  };

  Plotly.newPlot(divId, traces, layout, { responsive: true, displaylogo: false });
}

function plotConvergence(divId, history) {
  const trace = {
    x: history.map((_, i) => i),
    y: history,
    mode: "lines+markers",
    type: "scatter",
    line: { color: "#22d3ee", width: 2, shape: "spline" },
    marker: { size: 5, color: "#a78bfa" },
    fill: "tozeroy",
    fillcolor: "rgba(34, 211, 238, 0.08)",
    name: "Melhor ΔV",
  };
  const layout = {
    paper_bgcolor: "#070912",
    plot_bgcolor: "#070912",
    font: { color: "#e8eefb", size: 11 },
    xaxis: { title: "Iteração", gridcolor: "#1d2742" },
    yaxis: { title: "ΔV [km/s]", gridcolor: "#1d2742" },
    margin: { t: 24, l: 50, r: 12, b: 40 },
    showlegend: false,
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
  const phaseDeg = phases.map((p) => (p * 180) / Math.PI);
  const trace = {
    z, x: phaseDeg, y: times,
    type: "contour", colorscale: "Viridis",
    contours: { coloring: "heatmap" },
    colorbar: { title: "ΔV [km/s]", thickness: 14 },
    hovertemplate: "fase Marte: %{x:.1f}°<br>t = %{y:.0f} d<br>ΔV = %{z:.2f} km/s<extra></extra>",
  };
  const layout = {
    paper_bgcolor: "#070912", plot_bgcolor: "#070912",
    font: { color: "#e8eefb", size: 11 },
    xaxis: { title: "fase de Marte [°]", gridcolor: "#1d2742" },
    yaxis: { title: "tempo de voo [d]", gridcolor: "#1d2742" },
    title: { text: "Porkchop — Terra → Marte (clique para aplicar)", font: { size: 13 } },
    margin: { t: 40, l: 56, r: 60, b: 50 },
  };
  Plotly.newPlot(divId, [trace], layout, { responsive: true, displaylogo: false });

  // Click handler — aplica params no simulador
  if (opts.onClick) {
    const div = document.getElementById(divId);
    div.on("plotly_click", (data) => {
      if (!data.points || data.points.length === 0) return;
      const p = data.points[0];
      opts.onClick({
        phaseDeg: p.x,
        tDays: p.y,
        cost: p.z,
      });
    });
  }
}
