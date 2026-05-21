// =============================================================================
// Registro de corpos celestes.
// Cada corpo tem μ (gravitational parameter), raio físico, e — se orbita
// outro corpo — o raio orbital e o pai. Tudo em km, km/s, km³/s².
// =============================================================================

const Bodies = (() => {
  const G = 6.67408e-20;

  // Massas (kg)
  const m_sol     = 1.98892e30;
  const m_mercury = 3.3011e23;
  const m_venus   = 4.8685e24;
  const m_terra   = 5.972e24;
  const m_lua     = 7.342e22;
  const m_marte   = 6.39e23;
  const m_jupiter = 1.898e27;

  // Raios físicos (km)
  const R_sol     = 695700;
  const R_mercury = 2439.7;
  const R_venus   = 6051.8;
  const R_terra   = 6371.0;
  const R_lua     = 1737.4;
  const R_marte   = 3389.0;
  const R_jupiter = 69911;

  // Raios orbitais médios (km)
  const r_mercury_sol = 5.7909e7;
  const r_venus_sol   = 1.0821e8;
  const r_terra_sol   = 1.496e8;
  const r_marte_sol   = 2.279e8;
  const r_jupiter_sol = 7.7857e8;
  const r_lua_terra   = 384400;

  // SOI = 0.9431 * a * (m/M)^(2/5)
  const soi = (a, m, M) => 0.9431 * a * Math.pow(m / M, 2 / 5);

  const bodies = {
    sol: {
      id: 'sol', label: 'Sol', symbol: '☀',
      mu: G * m_sol, radius: R_sol,
      color: '#fbbf24',
      parent: null,
    },
    mercurio: {
      id: 'mercurio', label: 'Mercúrio', symbol: '☿',
      mu: G * m_mercury, radius: R_mercury,
      color: '#a78b6a',
      parent: 'sol', orbital_radius: r_mercury_sol,
      soi: soi(r_mercury_sol, m_mercury, m_sol),
    },
    venus: {
      id: 'venus', label: 'Vênus', symbol: '♀',
      mu: G * m_venus, radius: R_venus,
      color: '#f7c948',
      parent: 'sol', orbital_radius: r_venus_sol,
      soi: soi(r_venus_sol, m_venus, m_sol),
    },
    terra: {
      id: 'terra', label: 'Terra', symbol: '🜨',
      mu: G * m_terra, radius: R_terra,
      color: '#3da9fc',
      parent: 'sol', orbital_radius: r_terra_sol,
      soi: soi(r_terra_sol, m_terra, m_sol),
    },
    lua: {
      id: 'lua', label: 'Lua', symbol: '☽',
      mu: G * m_lua, radius: R_lua,
      color: '#cbd5e1',
      parent: 'terra', orbital_radius: r_lua_terra,
      // SOI da Lua em relação à Terra
      soi: soi(r_lua_terra, m_lua, m_terra),
    },
    marte: {
      id: 'marte', label: 'Marte', symbol: '♂',
      mu: G * m_marte, radius: R_marte,
      color: '#ef4444',
      parent: 'sol', orbital_radius: r_marte_sol,
      soi: soi(r_marte_sol, m_marte, m_sol),
    },
    jupiter: {
      id: 'jupiter', label: 'Júpiter', symbol: '♃',
      mu: G * m_jupiter, radius: R_jupiter,
      color: '#d97706',
      parent: 'sol', orbital_radius: r_jupiter_sol,
      soi: soi(r_jupiter_sol, m_jupiter, m_sol),
    },
  };

  // Velocidade angular orbital (rad/s) — Kepler circular
  for (const b of Object.values(bodies)) {
    if (b.parent) {
      const parent = bodies[b.parent];
      b.omega = Math.sqrt(parent.mu / Math.pow(b.orbital_radius, 3));
      b.period_days = (2 * Math.PI / b.omega) / 86400;
    }
  }

  return bodies;
})();
