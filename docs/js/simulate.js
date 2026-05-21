// =============================================================================
// Simulação genérica baseada em definição declarativa de missão.
//
// API:
//   simulate(missionId, x)  → { cost, deltaV, trajetorias, ... }
//   cost(missionId, x)      → number
//
// Backward-compat:
//   simulate(x, { venusSwingBy }) → mapeia pra missão mars-direct-leo ou mars-venus-flyby
// =============================================================================

function _isMissionId(arg) {
  return typeof arg === 'string' && Missions[arg];
}

function simulate(missionOrX, xOrOptions) {
  // Dispatch: nova API (missionId, x) ou legacy (x, options)
  let mission, x;
  if (_isMissionId(missionOrX)) {
    mission = Missions[missionOrX];
    x = xOrOptions;
  } else {
    // legacy
    x = missionOrX;
    const opts = xOrOptions || {};
    const id = opts.venusSwingBy !== false ? 'mars-venus-flyby' : 'mars-direct-leo';
    mission = Missions[id];
  }
  return _simulateMission(mission, x);
}

function cost(missionOrX, xOrOptions) {
  return simulate(missionOrX, xOrOptions).cost;
}

function _simulateMission(m, x) {
  const central = Bodies[m.centralBody];
  const mu_central = central.mu;
  const base = [1, 0, 0];

  // Lê parâmetros declarativos do vetor x na ordem definida
  const paramMap = {};
  m.params.forEach((p, i) => { paramMap[p.key] = x[i]; });

  // Resolve a fase angular de cada corpo visível
  // - Corpo de partida (departure.body): sempre na fase 0 do nosso referencial
  // - Outros corpos: usam phase_<body>; corpo destino usa o param que existe
  const departureBodyId = m.departure.body;
  const phases = { [departureBodyId]: 0 };
  for (const p of m.params) {
    const match = p.key.match(/^phase_(.+)$/);
    if (match) phases[match[1]] = paramMap[p.key];
  }

  // Posições dos corpos no referencial inercial central no momento "padrão"
  // (na verdade, cada leg tem seu próprio referencial temporal — abordamos abaixo)
  const positionOf = (bodyId, phase) => {
    const b = Bodies[bodyId];
    if (!b.parent || b.parent !== m.centralBody) {
      // Corpo central: na origem
      if (bodyId === m.centralBody) return [0, 0, 0];
      // Caso edge: corpo não orbita o central diretamente — sem suporte por enquanto
      return [0, 0, 0];
    }
    return Vec.rotZ(Vec.scale(base, b.orbital_radius), phase);
  };
  const velocityOf = (bodyId, phase) => {
    const b = Bodies[bodyId];
    if (bodyId === m.centralBody || b.parent !== m.centralBody) return [0, 0, 0];
    const vMag = Math.sqrt(mu_central / b.orbital_radius);
    return Vec.rotZ(Vec.scale(base, vMag), phase + Math.PI / 2);
  };

  // Órbitas de partida/chegada (alt_km → raio em torno do corpo)
  const orbitRadius = (orbit, bodyId) => {
    const b = Bodies[bodyId];
    if (orbit.kind === 'circular') {
      if ('r_km' in orbit) return orbit.r_km;
      return b.radius + orbit.alt_km;
    }
    throw new Error('orbita não suportada: ' + orbit.kind);
  };
  const R_departure = orbitRadius(m.departure.orbit, m.departure.body);
  const R_arrival   = orbitRadius(m.arrival.orbit,   m.arrival.body);
  const mu_departure = Bodies[m.departure.body].mu;
  const mu_arrival   = Bodies[m.arrival.body].mu;

  // Constrói as posições "alvo" de cada leg no momento certo
  const positions = {};
  const velocities = {};
  for (const bodyId of m.visibleBodies) {
    const phase = phases[bodyId] ?? 0;
    positions[bodyId] = positionOf(bodyId, phase);
    velocities[bodyId] = velocityOf(bodyId, phase);
  }
  // Edge case: se o corpo de partida É o corpo central (Terra→Lua, geocêntrico),
  // a nave começa em órbita ao redor dele a R_departure. Deslocamos posições[departureBody]
  // pra essa órbita inicial — Lambert tem um r1 ≠ (0,0,0).
  if (m.departure.body === m.centralBody) {
    positions[m.departure.body] = [R_departure, 0, 0];
    velocities[m.departure.body] = [0, Math.sqrt(mu_central / R_departure), 0];
  }

  const deltaV = [];
  const trajetorias = [];
  const banco_v_chegada = [];
  const banco_v_saida = [];

  let v_chegada_anterior = null; // velocidade da nave ao chegar no fim da leg anterior
  let r_chegada_anterior = null;

  // Velocidade circular na órbita de partida — usada no cálculo da deflexão
  // do flyby (replicando convenção do código MATLAB original)
  const v_circ_departure = Math.sqrt(mu_departure / R_departure);

  try {
    for (let legIdx = 0; legIdx < m.legs.length; legIdx++) {
      const leg = m.legs[legIdx];

      if (leg.kind === 'lambert') {
        const r1 = positions[leg.from];
        const r2 = positions[leg.to];
        const tof = paramMap[leg.timeParam];
        const res = Lambert.solve(r1, r2, tof, 0, mu_central);
        if (!isFinite(res.V1[0]) || res.exitflag < 0) return _inf(m, x);

        banco_v_saida.push(res.V1);
        banco_v_chegada.push(res.V2);
        trajetorias.push({
          label: `Trajetória ${Bodies[leg.from].label}-${Bodies[leg.to].label}`,
          r0: r1, v0: res.V1, mi: mu_central,
        });

        // Se é a primeira leg, calcula ΔV de partida (escape da SOI do corpo de partida)
        if (legIdx === 0) {
          const v_inicial = Math.sqrt(mu_departure / R_departure); // circular
          const v_inf = Vec.sub(res.V1, velocities[m.departure.body]);
          const v_partida = Math.sqrt(Vec.dot(v_inf, v_inf) + (2 * mu_departure) / R_departure);
          deltaV.push(Math.abs(v_partida - v_inicial));
        } else {
          // Vem de uma leg anterior (flyby ou outra). ΔV é o match entre velocidade
          // pós-flyby e a velocidade Lambert requerida nesta leg.
          if (v_chegada_anterior) {
            deltaV.push(Vec.norm(Vec.sub(res.V1, v_chegada_anterior)));
          }
        }

        v_chegada_anterior = res.V2;
        r_chegada_anterior = r2;
      } else if (leg.kind === 'flyby') {
        // Approximação 2D: deflexão da velocidade hiperbólica em torno do corpo
        const flybyBody = Bodies[leg.at];
        const rp_factor = paramMap[leg.rpParam];
        const rp = rp_factor * flybyBody.soi;

        // omega do corpo no central
        const r_flyby = positions[leg.at];
        const v_flyby = velocities[leg.at];
        const omega = Vec.scale(
          Vec.cross(r_flyby, v_flyby),
          1 / Math.pow(Vec.norm(r_flyby), 2)
        );

        // v_inf (relativa ao corpo do flyby)
        let v_inf = Vec.sub(v_chegada_anterior, Vec.cross(omega, r_flyby));

        // Aprox. usada no código MATLAB original: usa a velocidade circular
        // de partida (escalar) no cálculo da deflexão. É uma simplificação que
        // mantém os presets calibrados — o usuário pode rodar PSO pra refinar.
        const sin_def = 1 / (1 + (rp * v_circ_departure) / flybyBody.mu);
        const def = Math.asin(clamp(sin_def, -1, 1));

        // Aplica deflexão 2D
        v_chegada_anterior = Vec.add(
          Vec.rotZ(v_inf, 2 * def),
          Vec.cross(omega, r_flyby)
        );
        // flyby não custa ΔV (gravity assist puro)
      }
    }

    // ΔV de captura na chegada
    const arrivalBodyVel = velocities[m.arrival.body];
    const v_inf_arrival = Vec.sub(v_chegada_anterior, arrivalBodyVel);
    const v_inf_mag = Vec.norm(v_inf_arrival);
    const v_p = Math.sqrt(v_inf_mag * v_inf_mag + (2 * mu_arrival) / R_arrival);
    const v_circ = Math.sqrt(mu_arrival / R_arrival);
    deltaV.push(Math.abs(v_p - v_circ));

    const total = deltaV.reduce((a, b) => a + b, 0);
    if (!isFinite(total)) return _inf(m, x);

    // ----- Dados auxiliares pra animação/visualização -----
    const DAYS = 86400;
    const legDurations_s = m.legs
      .filter((l) => l.kind === 'lambert')
      .map((l) => paramMap[l.timeParam] * DAYS);
    const t_total_s = legDurations_s.reduce((a, b) => a + b, 0);

    const legStarts_s = [0];
    for (let i = 0; i < legDurations_s.length; i++) {
      legStarts_s.push(legStarts_s[i] + legDurations_s[i]);
    }

    // Fases iniciais (t=0) de cada corpo visível
    const phasesInitial = {};
    for (const bodyId of m.visibleBodies) {
      if (bodyId === m.centralBody) { phasesInitial[bodyId] = 0; continue; }
      const phaseAtArrival = phases[bodyId] ?? 0;
      // O "tempo de chegada" do corpo depende de quando ele aparece na missão.
      // Aproximação: usamos t_total_s (tempo até o fim). Vale exatamente pro
      // corpo de destino. Para corpos intermediários (flyby), tempo é diferente —
      // a aproximação não afeta o cálculo do custo, só a vis dos shadows.
      const b = Bodies[bodyId];
      phasesInitial[bodyId] = phaseAtArrival - b.omega * t_total_s;
    }

    // Para flyby bodies: usa o tempo de cada leg
    let elapsed_s = 0;
    for (const leg of m.legs) {
      if (leg.kind === 'lambert') {
        elapsed_s += paramMap[leg.timeParam] * DAYS;
      } else if (leg.kind === 'flyby') {
        const b = Bodies[leg.at];
        phasesInitial[leg.at] = (phases[leg.at] ?? 0) - b.omega * elapsed_s;
      }
    }

    const positionsInitial = {};
    for (const bodyId of m.visibleBodies) {
      positionsInitial[bodyId] = positionOf(bodyId, phasesInitial[bodyId] ?? 0);
    }

    return {
      cost: total,
      deltaV,
      trajetorias,
      mission: m,
      positions, velocities, phases,
      positionsInitial, phasesInitial,
      banco_v_saida, banco_v_chegada,
      // Aliases para retrocompatibilidade com animation/visualize antigos
      r_terra_sol: positions['terra'] || [0, 0, 0],
      r_venus_sol: positions['venus'] || [0, 0, 0],
      r_marte_sol: positions['marte'] || [0, 0, 0],
      v_terra_sol: velocities['terra'] || [0, 0, 0],
      v_venus_sol: velocities['venus'] || [0, 0, 0],
      v_marte_sol: velocities['marte'] || [0, 0, 0],
      r_terra_sol_initial: positionsInitial['terra'] || [0, 0, 0],
      r_venus_sol_initial: positionsInitial['venus'] || [0, 0, 0],
      r_marte_sol_initial: positionsInitial['marte'] || [0, 0, 0],
      phaseE_initial: phasesInitial[m.departure.body] ?? 0,
      phaseV_initial: phasesInitial['venus'] ?? 0,
      phaseM_initial: phasesInitial['marte'] ?? phasesInitial[m.arrival.body] ?? 0,
      phase_terra: phases['terra'] ?? 0,
      phase_venus: phases['venus'] ?? 0,
      phase_marte: phases['marte'] ?? phases[m.arrival.body] ?? 0,
      t_total_s, legDurations_s, legStarts_s,
      omegaE: Bodies['terra']?.omega || 0,
      omegaV: Bodies['venus']?.omega || 0,
      omegaM: Bodies['marte']?.omega || 0,
      venusSwingBy: m.legs.some((l) => l.kind === 'flyby' && l.at === 'venus'),
    };
  } catch (e) {
    return _inf(m, x);
  }
}

function _inf(m, x) {
  const central = Bodies[m.centralBody];
  const base = [1, 0, 0];
  const positionOf = (bodyId, phase) => {
    const b = Bodies[bodyId];
    if (bodyId === m.centralBody) return [0, 0, 0];
    return Vec.rotZ(Vec.scale(base, b.orbital_radius), phase);
  };
  const velocityOf = (bodyId, phase) => {
    const b = Bodies[bodyId];
    if (bodyId === m.centralBody) return [0, 0, 0];
    const vMag = Math.sqrt(central.mu / b.orbital_radius);
    return Vec.rotZ(Vec.scale(base, vMag), phase + Math.PI / 2);
  };

  const paramMap = {};
  m.params.forEach((p, i) => { paramMap[p.key] = x[i]; });
  const phases = { [m.departure.body]: 0 };
  for (const p of m.params) {
    const match = p.key.match(/^phase_(.+)$/);
    if (match) phases[match[1]] = paramMap[p.key];
  }

  const positions = {}, velocities = {};
  for (const bodyId of m.visibleBodies) {
    const ph = phases[bodyId] ?? 0;
    positions[bodyId] = positionOf(bodyId, ph);
    velocities[bodyId] = velocityOf(bodyId, ph);
  }

  const DAYS = 86400;
  const legDurations_s = m.legs
    .filter((l) => l.kind === 'lambert')
    .map((l) => (paramMap[l.timeParam] || 100) * DAYS);
  const t_total_s = legDurations_s.reduce((a, b) => a + b, 0);
  const legStarts_s = [0];
  for (let i = 0; i < legDurations_s.length; i++) {
    legStarts_s.push(legStarts_s[i] + legDurations_s[i]);
  }

  const phasesInitial = {};
  const positionsInitial = {};
  for (const bodyId of m.visibleBodies) {
    if (bodyId === m.centralBody) { phasesInitial[bodyId] = 0; positionsInitial[bodyId] = [0,0,0]; continue; }
    const b = Bodies[bodyId];
    phasesInitial[bodyId] = (phases[bodyId] ?? 0) - b.omega * t_total_s;
    positionsInitial[bodyId] = positionOf(bodyId, phasesInitial[bodyId]);
  }

  return {
    cost: Infinity,
    deltaV: [Infinity],
    trajetorias: [],
    degenerate: true,
    mission: m,
    positions, velocities, phases,
    positionsInitial, phasesInitial,
    banco_v_saida: [], banco_v_chegada: [],
    r_terra_sol: positions['terra'] || [0, 0, 0],
    r_venus_sol: positions['venus'] || [0, 0, 0],
    r_marte_sol: positions['marte'] || [0, 0, 0],
    v_terra_sol: velocities['terra'] || [0, 0, 0],
    v_venus_sol: velocities['venus'] || [0, 0, 0],
    v_marte_sol: velocities['marte'] || [0, 0, 0],
    r_terra_sol_initial: positionsInitial['terra'] || [0, 0, 0],
    r_venus_sol_initial: positionsInitial['venus'] || [0, 0, 0],
    r_marte_sol_initial: positionsInitial['marte'] || [0, 0, 0],
    phaseE_initial: phasesInitial[m.departure.body] ?? 0,
    phaseV_initial: phasesInitial['venus'] ?? 0,
    phaseM_initial: phasesInitial['marte'] ?? phasesInitial[m.arrival.body] ?? 0,
    phase_terra: phases['terra'] ?? 0,
    phase_venus: phases['venus'] ?? 0,
    phase_marte: phases['marte'] ?? phases[m.arrival.body] ?? 0,
    t_total_s, legDurations_s, legStarts_s,
    omegaE: Bodies['terra']?.omega || 0,
    omegaV: Bodies['venus']?.omega || 0,
    omegaM: Bodies['marte']?.omega || 0,
    venusSwingBy: m.legs.some((l) => l.kind === 'flyby' && l.at === 'venus'),
  };
}
