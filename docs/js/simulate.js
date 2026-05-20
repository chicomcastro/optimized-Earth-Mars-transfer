// Porte de simulate.m + custo.m
// Calcula o custo (deltaV total) de uma trajetória dados parâmetros em x
// e retorna também dados auxiliares para visualização.

function simulate(x, options = {}) {
  const venusSwingBy = options.venusSwingBy !== false; // default true
  const C = PhysicalConstants;
  const base = [1, 0, 0];
  const banco_v_chegada = [];
  const banco_v_saida = [];
  const banco_v_inicial = [];
  const deltaV = [];

  // pega_parametro com índice
  let idx = 0;
  const peek = () => x[idx++];

  const phase_terra = 0;
  const phase_marte = peek();
  let phase_venus, t_terra_venus, t_venus_marte, rp_factor, t_terra_marte;
  if (venusSwingBy) {
    phase_venus = peek();
    t_terra_venus = peek();
    t_venus_marte = peek();
    rp_factor = peek();
  } else {
    phase_venus = 0;
    t_terra_marte = peek();
  }

  const r_terra_sol = Vec.rotZ(Vec.scale(base, C.r_st), phase_terra);
  const r_venus_sol = Vec.rotZ(Vec.scale(base, C.r_sv), phase_venus);
  const r_marte_sol = Vec.rotZ(Vec.scale(base, C.r_sm), phase_marte);
  const v_terra_sol = Vec.rotZ(
    Vec.scale(base, Math.sqrt(C.mi_sol / Vec.norm(r_terra_sol))),
    phase_terra + Math.PI / 2
  );
  const v_venus_sol = Vec.rotZ(
    Vec.scale(base, Math.sqrt(C.mi_sol / Vec.norm(r_venus_sol))),
    phase_venus + Math.PI / 2
  );
  const v_marte_sol = Vec.rotZ(
    Vec.scale(base, Math.sqrt(C.mi_sol / Vec.norm(r_marte_sol))),
    phase_marte + Math.PI / 2
  );

  const omegaVec = (r, v) =>
    Vec.scale(Vec.cross(r, v), 1 / Math.pow(Vec.norm(r), 2));
  const omega_venus_sol = omegaVec(r_venus_sol, v_venus_sol);

  let v_chegada_final;
  const trajetorias = [];

  try {
    if (venusSwingBy) {
      // 1. Transferência Terra-Vênus
      const rp = rp_factor * C.R_soi_venus;
      let res = Lambert.solve(
        r_terra_sol, r_venus_sol, t_terra_venus, 0, C.mi_sol
      );
      if (!isFinite(res.V1[0]) || res.exitflag < 0) return inf();

      banco_v_chegada.push(res.V2);
      banco_v_saida.push(res.V1);
      trajetorias.push({
        label: "Trajetória Terra-Vênus",
        r0: r_terra_sol, v0: res.V1, mi: C.mi_sol,
      });

      let v_inicial = Math.sqrt(C.mi_terra / C.R_oe_terra);
      let v_inf_vec = Vec.sub(res.V1, v_terra_sol);
      let v_saida_mag = Math.sqrt(
        Vec.dot(v_inf_vec, v_inf_vec) + (2 * C.mi_terra) / C.R_oe_terra
      );
      deltaV.push(Math.abs(v_saida_mag - v_inicial));

      // 2. Venus swing-by
      let v_inf2 = Vec.sub(res.V2, Vec.cross(omega_venus_sol, r_venus_sol));
      const sin_def_venus = 1 / (1 + (rp * Math.abs(v_inicial)) / C.mi_venus);
      const def_venus = Math.asin(clamp(sin_def_venus, -1, 1));
      const v_p_versor = Vec.rotZ(
        Vec.scale(v_inf2, 1 / Vec.norm(v_inf2)), def_venus
      );
      const v_p_mag = Math.sqrt(
        Vec.dot(v_inf2, v_inf2) + (2 * C.mi_venus) / (C.R_v + rp)
      );
      // ignorado conforme original (linhas comentadas) - apenas para vis
      void Vec.scale(v_p_versor, v_p_mag);

      // 3. Transferência Vênus-Marte
      const v_inicial_vm = Vec.add(
        Vec.rotZ(v_inf2, 2 * def_venus),
        Vec.cross(omega_venus_sol, r_venus_sol)
      );
      const res2 = Lambert.solve(
        r_venus_sol, r_marte_sol, t_venus_marte, 0, C.mi_sol
      );
      if (!isFinite(res2.V1[0]) || res2.exitflag < 0) return inf();

      banco_v_chegada.push(res2.V2);
      banco_v_saida.push(res2.V1);
      trajetorias.push({
        label: "Trajetória Vênus-Marte",
        r0: r_venus_sol, v0: res2.V1, mi: C.mi_sol,
      });

      deltaV.push(Vec.norm(Vec.sub(res2.V1, v_inicial_vm)));
      v_chegada_final = res2.V2;
    } else {
      // Transferência Terra-Marte direta
      const res = Lambert.solve(
        r_terra_sol, r_marte_sol, t_terra_marte, 0, C.mi_sol
      );
      if (!isFinite(res.V1[0]) || res.exitflag < 0) return inf();

      const v_inicial = Math.sqrt(C.mi_terra / C.R_oe_terra);
      const v_inf_vec = Vec.sub(res.V1, v_terra_sol);
      const v_final = Math.sqrt(
        Vec.dot(v_inf_vec, v_inf_vec) + (2 * C.mi_terra) / C.R_oe_terra
      );
      deltaV.push(Math.abs(v_final - v_inicial));

      banco_v_chegada.push(res.V2);
      banco_v_inicial.push(v_inicial);
      banco_v_saida.push(res.V1);
      trajetorias.push({
        label: "Trajetória Terra-Marte",
        r0: r_terra_sol, v0: res.V1, mi: C.mi_sol,
      });
      v_chegada_final = res.V2;
    }

    // Chegada em Marte
    const v_inf_m = Vec.sub(v_chegada_final, v_marte_sol);
    const v_p = Math.sqrt(
      Vec.dot(v_inf_m, v_inf_m) + (2 * C.mi_marte) / C.R_oe_marte
    );
    const v_inicial = v_p;
    const v_final = Math.sqrt(C.mi_marte / C.R_oe_marte);
    deltaV.push(Math.abs(v_final - v_inicial));

    const total = deltaV.reduce((a, b) => a + b, 0);
    if (!isFinite(total)) return inf();

    // Tempo total da missão em segundos
    const DAYS = 86400;
    const legDurations_s = venusSwingBy
      ? [t_terra_venus * DAYS, t_venus_marte * DAYS]
      : [t_terra_marte * DAYS];
    const t_total_s = legDurations_s.reduce((a, b) => a + b, 0);

    // Mean motion dos planetas (rad/s, CCW)
    const omegaPlanet = (r) => Math.sqrt(C.mi_sol / Math.pow(r, 3));
    const omegaE = omegaPlanet(C.r_st);
    const omegaV = omegaPlanet(C.r_sv);
    const omegaM = omegaPlanet(C.r_sm);

    // Posições iniciais (t=0, momento da partida da Terra)
    // Terra: sempre parte de fase 0. Vênus e Marte: voltam o tempo de voo
    // até onde estavam no t=0 (eles giram CCW, então sub).
    const phaseE_initial = 0;
    const phaseV_initial = venusSwingBy
      ? phase_venus - omegaV * (t_terra_venus * DAYS)
      : 0;
    const phaseM_initial = phase_marte - omegaM * t_total_s;

    const r_terra_sol_initial = r_terra_sol;
    const r_venus_sol_initial = Vec.rotZ(Vec.scale(base, C.r_sv), phaseV_initial);
    const r_marte_sol_initial = Vec.rotZ(Vec.scale(base, C.r_sm), phaseM_initial);

    // Acumula durações pra saber em qual leg estamos a cada t
    const legStarts_s = [0];
    for (let i = 0; i < legDurations_s.length; i++) {
      legStarts_s.push(legStarts_s[i] + legDurations_s[i]);
    }

    return {
      cost: total,
      deltaV,
      trajetorias,
      r_terra_sol, r_venus_sol, r_marte_sol,
      v_terra_sol, v_venus_sol, v_marte_sol,
      banco_v_saida, banco_v_chegada,
      phase_terra, phase_venus, phase_marte,
      // Estado inicial (t=0)
      r_terra_sol_initial, r_venus_sol_initial, r_marte_sol_initial,
      phaseE_initial, phaseV_initial, phaseM_initial,
      // Animação
      t_total_s,
      legDurations_s,
      legStarts_s,
      omegaE, omegaV, omegaM,
      venusSwingBy,
    };
  } catch (e) {
    return inf();
  }

  function inf() {
    return {
      cost: Infinity,
      deltaV: [Infinity],
      trajetorias: [],
      r_terra_sol, r_venus_sol, r_marte_sol,
      v_terra_sol, v_venus_sol, v_marte_sol,
      banco_v_saida, banco_v_chegada,
      phase_terra, phase_venus, phase_marte,
    };
  }
}

function cost(x, options) {
  return simulate(x, options).cost;
}
