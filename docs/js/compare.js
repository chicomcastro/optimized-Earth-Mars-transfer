// =============================================================================
// compare.js — overlay até 3 trajetórias no mesmo plot
//
// Compare mode é implícito: se a lista tem ≥ 1 item, o plot mostra os
// snapshots SOBRE o sim atual. Animação fica disabled em compare mode.
// =============================================================================

(function () {
  'use strict';

  // Cores categóricas distintas (combinam com a paleta da app)
  const COLORS = ['#22d3ee', '#a78bfa', '#fb923c']; // ciano, violeta, laranja
  const MAX = 3;

  const state = {
    list: [],     // [{ id, label, missionId, x, sim, color, deltaV }]
    listeners: [],
  };

  function emit() { state.listeners.forEach((fn) => { try { fn(); } catch (_) {} }); }
  function onChange(fn) { state.listeners.push(fn); }

  function add(item) {
    if (state.list.length >= MAX) return false;
    if (!item || !item.sim) return false;
    const usedColors = new Set(state.list.map((i) => i.color));
    const color = COLORS.find((c) => !usedColors.has(c)) || COLORS[0];
    const id = `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const deltaV = item.sim.deltaV_total_kmps != null
      ? item.sim.deltaV_total_kmps
      : (item.sim.deltaV_total || 0);
    state.list.push({
      id, color, deltaV,
      label: item.label || 'sem nome',
      missionId: item.missionId || null,
      x: (item.x || []).slice(),
      sim: item.sim,
    });
    emit();
    return true;
  }

  function remove(id) {
    const before = state.list.length;
    state.list = state.list.filter((i) => i.id !== id);
    if (state.list.length !== before) emit();
  }

  function clear() {
    if (state.list.length === 0) return;
    state.list = [];
    emit();
  }

  function isActive() { return state.list.length > 0; }
  function getList() { return state.list.slice(); }
  function canAddMore() { return state.list.length < MAX; }

  // Constrói traces pra overlay multi-trajetórias.
  // sim0 (sim atual ou primeiro da lista) fornece bodies, orbits, central.
  function buildOverlayTraces(sim0, opts) {
    if (!sim0) return [];
    const frame = (opts && opts.frame) || 'helio';
    if (frame !== 'helio') return []; // compare só faz sentido em helio
    const scale_km = (sim0.mission && sim0.mission.plotUnit === 'kkm') ? 1000 : 1.496e8;

    const traces = [];
    for (const item of state.list) {
      const sim = item.sim;
      if (!sim || !sim.t_total_s) continue;
      // Trail completa da trajetória
      const trail = Animation.trail(sim, sim.t_total_s, 'helio', 160);
      if (trail.length > 1) {
        traces.push({
          x: trail.map((p) => p[0] / scale_km),
          y: trail.map((p) => p[1] / scale_km),
          mode: 'lines', type: 'scatter',
          name: `${item.label} · ${item.deltaV.toFixed(2)} km/s`,
          line: { color: item.color, width: 2.5 },
          hoverinfo: 'name', showlegend: true,
        });
      }
      // Marker no destino (estado final)
      const stFinal = Animation.stateAt(sim, sim.t_total_s);
      const frFinal = Animation.applyFrame(stFinal, sim, sim.t_total_s, 'helio');
      if (frFinal.craft) {
        traces.push({
          x: [frFinal.craft[0] / scale_km],
          y: [frFinal.craft[1] / scale_km],
          mode: 'markers', type: 'scatter', name: item.label + ' (chegada)',
          marker: { size: 9, color: item.color, symbol: 'diamond',
                    line: { color: '#fff', width: 1 } },
          showlegend: false,
          hovertemplate: `${item.label} chegada<extra></extra>`,
        });
      }
    }
    return traces;
  }

  window.Compare = {
    onChange, add, remove, clear, isActive, getList, canAddMore,
    buildOverlayTraces, COLORS, MAX,
  };
})();
