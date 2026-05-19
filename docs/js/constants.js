// Constantes físicas portadas de dados.m
const PhysicalConstants = (() => {
  const G = 6.67408e-20; // km^3 kg^-1 s^-2

  const m_terra = 5.972e24;
  const m_sol = 1.98892e30;
  const m_marte = 6.39e23;
  const m_venus = 4.8685e24;

  const R_t = 6.371e3; // km (raio Terra)
  const R_m = 3.389e3; // km (raio Marte)
  const R_v = 6.0518e3; // km (raio Vênus)

  const r_st = 1.496e8; // km (raio Sol-Terra, 1 UA)
  const r_sm = 2.279e8; // km
  const r_sv = 1.0821e8; // km

  const mi_terra = G * m_terra;
  const mi_sol = G * m_sol;
  const mi_marte = G * m_marte;
  const mi_venus = G * m_venus;

  const UA = 1.496e8; // km

  // SOI - Sphere of Influence
  const soi = (a, m, M) => 0.9431 * a * Math.pow(m / M, 2 / 5);

  // Parâmetros de projeto
  const h_o = 200; // altitude da órbita inicial (Terra) em km
  const h_f = 200; // altitude da órbita final (Marte) em km

  const R_oe_terra = R_t + h_o;
  const R_oe_marte = R_m + h_f;
  const R_soi_terra = soi(r_st, m_terra, m_sol);
  const R_soi_marte = soi(r_sm, m_marte, m_sol);
  const R_soi_venus = soi(r_sv, m_venus, m_sol);

  return {
    G,
    m_terra, m_sol, m_marte, m_venus,
    R_t, R_m, R_v,
    r_st, r_sm, r_sv,
    mi_terra, mi_sol, mi_marte, mi_venus,
    UA,
    h_o, h_f,
    R_oe_terra, R_oe_marte,
    R_soi_terra, R_soi_marte, R_soi_venus,
    soi,
  };
})();
