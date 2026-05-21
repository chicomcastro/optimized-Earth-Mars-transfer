// ============================================================
// Animação da trajetória + frames de referência.
// Propaga estado dos planetas (Kepler circular) e da nave (Kepler 2-body
// pela Lambert arc) em t ∈ [0, t_total_s], aplicando transform pro referencial.
// ============================================================

const Animation = (() => {
  // Propaga uma órbita Kepleriana a partir de (r0, v0, μ) pelo tempo dt (s).
  // Devolve a posição [x, y, 0] em t = t0 + dt.
  function propagate(r0, v0, mi, dt) {
    if (dt === 0) return r0.slice();

    const r0Mag = Vec.norm(r0);
    const v0Mag = Vec.norm(v0);
    const energy = (v0Mag * v0Mag) / 2 - mi / r0Mag;
    if (energy >= 0) return r0.slice(); // parabólica/hiperbólica — não esperada
    const a = -mi / (2 * energy);

    const rDotV = Vec.dot(r0, v0);
    const eVec = Vec.scale(
      Vec.sub(
        Vec.scale(r0, v0Mag * v0Mag - mi / r0Mag),
        Vec.scale(v0, rDotV)
      ),
      1 / mi
    );
    const e = Vec.norm(eVec);
    const h = Vec.cross(r0, v0);
    const n = Math.sqrt(mi / Math.pow(a, 3));

    // ν0 (true anomaly inicial)
    let nu0;
    if (e < 1e-9) {
      nu0 = Math.atan2(r0[1], r0[0]);
    } else {
      const cosNu0 = Math.max(-1, Math.min(1, Vec.dot(eVec, r0) / (e * r0Mag)));
      nu0 = Math.acos(cosNu0);
      if (rDotV < 0) nu0 = 2 * Math.PI - nu0;
    }

    // E0 a partir de ν0
    const E0 = 2 * Math.atan2(
      Math.sqrt(1 - e) * Math.sin(nu0 / 2),
      Math.sqrt(1 + e) * Math.cos(nu0 / 2)
    );
    const M0 = E0 - e * Math.sin(E0);

    // Sentido da órbita
    const sgn = h[2] >= 0 ? 1 : -1;
    const Mt = M0 + sgn * n * dt;

    // Resolve Kepler M = E - e sin(E) (Newton)
    let E = Mt;
    for (let i = 0; i < 30; i++) {
      const f = E - e * Math.sin(E) - Mt;
      const fp = 1 - e * Math.cos(E);
      const dE = f / fp;
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }

    const nu = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));

    const omega = e > 1e-9 ? Math.atan2(eVec[1], eVec[0]) : 0;
    const theta = omega + sgn * nu;
    return [r * Math.cos(theta), r * Math.sin(theta), 0];
  }

  // Planeta circular em t (s) dado raio, fase inicial e ω.
  function planetAt(R, phase0, omega, t) {
    const ang = phase0 + omega * t;
    return [R * Math.cos(ang), R * Math.sin(ang), 0];
  }

  // Posição da nave em t (s desde a partida da Terra).
  // Se trajetorias está vazio (Lambert falhou), interpola linearmente entre
  // r_terra_sol e r_marte_sol como fallback — assim a nave sempre termina em Marte.
  function craftAt(sim, t) {
    if (t < 0) return null;

    if (!sim.trajetorias || sim.trajetorias.length === 0) {
      // Fallback degenerado: interpola Terra → (Vênus →) Marte linearmente
      const total = sim.t_total_s || 1;
      const f = Math.min(1, t / total);
      if (sim.venusSwingBy) {
        const tV = sim.legDurations_s[0] / total;
        if (f <= tV) {
          const ff = f / tV;
          return [
            sim.r_terra_sol[0] * (1 - ff) + sim.r_venus_sol[0] * ff,
            sim.r_terra_sol[1] * (1 - ff) + sim.r_venus_sol[1] * ff,
            0,
          ];
        }
        const ff = (f - tV) / (1 - tV);
        return [
          sim.r_venus_sol[0] * (1 - ff) + sim.r_marte_sol[0] * ff,
          sim.r_venus_sol[1] * (1 - ff) + sim.r_marte_sol[1] * ff,
          0,
        ];
      }
      return [
        sim.r_terra_sol[0] * (1 - f) + sim.r_marte_sol[0] * f,
        sim.r_terra_sol[1] * (1 - f) + sim.r_marte_sol[1] * f,
        0,
      ];
    }

    if (t >= sim.t_total_s) {
      // No fim, garante Marte (posição final, sem propagar pra evitar drift Kepleriano)
      return sim.r_marte_sol.slice();
    }

    // Acha em qual leg estamos
    let legIdx = 0;
    for (let i = 0; i < sim.legDurations_s.length; i++) {
      if (t >= sim.legStarts_s[i] && t < sim.legStarts_s[i + 1]) {
        legIdx = i;
        break;
      }
    }
    const leg = sim.trajetorias[legIdx];
    if (!leg) return sim.r_marte_sol.slice();
    const localT = t - sim.legStarts_s[legIdx];
    const pos = propagate(leg.r0, leg.v0, leg.mi, localT);
    // Sanity check: se propagate deu NaN, fallback
    if (!isFinite(pos[0]) || !isFinite(pos[1])) {
      return leg.r0.slice();
    }
    return pos;
  }

  // Estado completo do sistema em t (no referencial central inercial).
  // Retorna posições por body id (mission.visibleBodies). Aliases legados
  // ('sun', 'earth', 'venus', 'mars') também são mantidos pra retrocompat.
  function stateAt(sim, t) {
    const out = { craft: craftAt(sim, t) };
    const mission = sim.mission;
    if (!mission) {
      // Legado: assume corpos Marte/Vênus/Terra
      const C = PhysicalConstants;
      out.sun = [0, 0, 0];
      out.earth = planetAt(C.r_st, sim.phaseE_initial, sim.omegaE, t);
      out.venus = planetAt(C.r_sv, sim.phaseV_initial, sim.omegaV, t);
      out.mars  = planetAt(C.r_sm, sim.phaseM_initial, sim.omegaM, t);
      return out;
    }
    const centralId = mission.centralBody;
    // Corpo central na origem (no frame helio)
    if (centralId === 'sol') out.sun = [0, 0, 0];
    else out[centralId] = [0, 0, 0];

    // Demais corpos visíveis (que orbitam o central)
    const phasesInitial = sim.phasesInitial || {};
    for (const pid of mission.visibleBodies) {
      if (pid === centralId) continue;
      const b = Bodies[pid];
      if (!b || !b.orbital_radius) continue;
      const phase0 = phasesInitial[pid] ?? 0;
      out[pid] = planetAt(b.orbital_radius, phase0, b.omega, t);
    }
    // Aliases legados (visualize.js/applyFrame ainda usa 'earth/venus/mars/sun')
    if (out.terra) out.earth = out.terra;
    if (out.marte) out.mars = out.marte;
    if (out.sol)   out.sun = out.sol;
    return out;
  }

  // Aplica transformação de referencial preservando todas as chaves do state.
  function applyFrame(state, sim, t, frame) {
    if (frame === 'helio') return state;
    const out = {};
    if (frame === 'geo') {
      // Tudo deslocado pela posição da Terra. Pra missão geocêntrica
      // (centralBody='terra'), a Terra já está na origem, então é no-op.
      const earth = state.earth || state.terra || [0, 0, 0];
      for (const key of Object.keys(state)) {
        const v = state[key];
        if (key === 'earth' || key === 'terra') out[key] = [0, 0, 0];
        else if (Array.isArray(v)) out[key] = Vec.sub(v, earth);
        else out[key] = v;
      }
      return out;
    }
    if (frame === 'synodic') {
      const ang = -sim.omegaE * t;
      for (const key of Object.keys(state)) {
        const v = state[key];
        if (Array.isArray(v)) out[key] = Vec.rotZ(v, ang);
        else out[key] = v;
      }
      return out;
    }
    return state;
  }

  // Trail amostrada: posições da nave de 0 até tNow, transformadas pro frame.
  function trail(sim, tNow, frame, nSamples = 80) {
    const pts = [];
    for (let i = 0; i <= nSamples; i++) {
      const t = (i / nSamples) * tNow;
      const st = stateAt(sim, t);
      const fr = applyFrame(st, sim, t, frame);
      if (fr.craft) pts.push(fr.craft);
    }
    return pts;
  }

  // Trail dos planetas no frame (útil pra ver epicycle no geo/synodic)
  function planetTrail(sim, planet, tEnd, frame, nSamples = 80) {
    const C = PhysicalConstants;
    const pts = [];
    for (let i = 0; i <= nSamples; i++) {
      const t = (i / nSamples) * tEnd;
      const st = stateAt(sim, t);
      const fr = applyFrame(st, sim, t, frame);
      if (fr[planet]) pts.push(fr[planet]);
    }
    return pts;
  }

  return { propagate, planetAt, craftAt, stateAt, applyFrame, trail, planetTrail };
})();
