// =============================================================================
// Registro de missões.
//
// Cada missão é uma config declarativa que o simulate.js interpreta:
//   - central body (Sol ou Terra)
//   - lista de legs (Lambert): de qual corpo pra qual corpo, com tempo
//   - departure: corpo + órbita de partida (raio ou altitude)
//   - arrival: corpo + órbita de captura
//   - flyby opcional (corpo no meio)
//   - params: lista declarativa dos parâmetros otimizáveis
//   - presets: pontos de partida bons (do PSO ou conhecidos)
//   - plotUnit_km: escala de visualização (AU ou km)
//
// A leitura do vetor x segue a ordem em `params`.
// =============================================================================

const Missions = {
  // -----------------------------------------------------------------------
  // A1 — Terra → Marte direta (LEO → LMO)
  // -----------------------------------------------------------------------
  'mars-direct-leo': {
    id: 'mars-direct-leo',
    label: 'Terra → Marte (direta de LEO)',
    short: 'Marte · direta',
    badge: 'Hohmann',
    description: 'Transferência clássica da órbita baixa terrestre (h=200 km) para uma órbita baixa marciana. É a referência canônica — o ótimo global é uma Hohmann.',
    estimatedCost: 5.71,
    centralBody: 'sol',
    visibleBodies: ['sol', 'terra', 'venus', 'marte'],
    departure: { body: 'terra', orbit: { kind: 'circular', alt_km: 200 } },
    arrival:   { body: 'marte', orbit: { kind: 'circular', alt_km: 200 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'marte', timeParam: 't_TM' },
    ],
    params: [
      { key: 'phase_marte', label: 'fase de Marte', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TM',        label: 'T-M (dias)',    kind: 'days',  bounds: [120, 360] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann (ótimo)', x: [Math.PI, 258.8] },
    ],
    porkchopExplorations: ['direct-phase-time'],
    plotUnit: 'AU',
  },

  // -----------------------------------------------------------------------
  // A2 — Terra → Marte com swing-by por Vênus
  // -----------------------------------------------------------------------
  'mars-venus-flyby': {
    id: 'mars-venus-flyby',
    label: 'Terra → Marte (swing-by Vênus)',
    short: 'Marte · swing-by Vênus',
    badge: 'Swing-by',
    description: 'Mesma missão com sobrevoo em Vênus. Mostra que swing-by nem sempre ganha — para Marte (planeta externo próximo), a Hohmann direta vence (~5.7 vs ~7.97 km/s).',
    estimatedCost: 7.97,
    centralBody: 'sol',
    visibleBodies: ['sol', 'terra', 'venus', 'marte'],
    departure: { body: 'terra', orbit: { kind: 'circular', alt_km: 200 } },
    arrival:   { body: 'marte', orbit: { kind: 'circular', alt_km: 200 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'venus', timeParam: 't_TV' },
      { kind: 'flyby',   at: 'venus',   rpParam: 'rp' },
      { kind: 'lambert', from: 'venus', to: 'marte', timeParam: 't_VM' },
    ],
    params: [
      { key: 'phase_marte', label: 'fase de Marte', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 'phase_venus', label: 'fase de Vênus', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TV',        label: 'T-V (dias)',    kind: 'days',  bounds: [30, 180] },
      { key: 't_VM',        label: 'V-M (dias)',    kind: 'days',  bounds: [30, 240] },
      { key: 'rp',          label: 'r_p / R_SOI Vênus', kind: 'ratio', bounds: [0.015, 0.1] },
    ],
    presets: [
      { id: 'best', label: 'Melhor encontrado', x: [6.2824, Math.PI, 121.25, 217.24, 0.0675] },
    ],
    porkchopExplorations: ['sb-phases', 'sb-times', 'sb-venus-time', 'sb-rp-venus'],
    plotUnit: 'AU',
  },

  // -----------------------------------------------------------------------
  // A3 — Terra → Marte saindo de GEO
  // -----------------------------------------------------------------------
  'mars-direct-geo': {
    id: 'mars-direct-geo',
    label: 'Terra → Marte (direta de GEO)',
    short: 'Marte · de GEO',
    badge: 'Direta',
    description: 'Mesma transferência interplanetária, mas partindo de uma órbita geoestacionária (h≈35786 km) em vez de LEO. Você já paga a maior parte da escapada da Terra na ida pra GEO, então a saída pra Marte fica bem mais barata.',
    estimatedCost: 4.28,
    centralBody: 'sol',
    visibleBodies: ['sol', 'terra', 'marte'],
    departure: { body: 'terra', orbit: { kind: 'circular', alt_km: 35786 } },
    arrival:   { body: 'marte', orbit: { kind: 'circular', alt_km: 200 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'marte', timeParam: 't_TM' },
    ],
    params: [
      { key: 'phase_marte', label: 'fase de Marte', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TM',        label: 'T-M (dias)',    kind: 'days',  bounds: [120, 360] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann (ótimo)', x: [Math.PI, 258.8] },
    ],
    porkchopExplorations: ['direct-phase-time'],
    plotUnit: 'AU',
  },

  // -----------------------------------------------------------------------
  // A4 — Terra → Vênus direta
  // -----------------------------------------------------------------------
  'venus-direct': {
    id: 'venus-direct',
    label: 'Terra → Vênus (direta)',
    short: 'Vênus · direta',
    badge: 'Hohmann interna',
    description: 'Espelho do A1 — em vez de subir para Marte, descemos para Vênus. Hohmann interna (transferência abaixo da órbita da Terra). Mostra que o solver é simétrico.',
    estimatedCost: 6.82,
    centralBody: 'sol',
    visibleBodies: ['sol', 'venus', 'terra'],
    departure: { body: 'terra', orbit: { kind: 'circular', alt_km: 200 } },
    arrival:   { body: 'venus', orbit: { kind: 'circular', alt_km: 300 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'venus', timeParam: 't_TV' },
    ],
    params: [
      { key: 'phase_venus', label: 'fase de Vênus', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TV',        label: 'T-V (dias)',    kind: 'days',  bounds: [60, 300] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann interna', x: [Math.PI, 146] },
    ],
    porkchopExplorations: ['venus-phase-time'],
    plotUnit: 'AU',
  },

  // -----------------------------------------------------------------------
  // A6 — Terra → Mercúrio com swing-by por Vênus
  // -----------------------------------------------------------------------
  'mercury-venus-flyby': {
    id: 'mercury-venus-flyby',
    label: 'Terra → Mercúrio (swing-by Vênus)',
    short: 'Mercúrio · swing-by Vênus',
    badge: 'Swing-by ganhador',
    description: 'Para Mercúrio o swing-by realmente paga: direta custa ~13-17 km/s, mas com sobrevoo em Vênus dá pra fazer com ~9-10 km/s. Foi exatamente o que a missão BepiColombo usou (várias vezes).',
    estimatedCost: 8.68,
    centralBody: 'sol',
    visibleBodies: ['sol', 'terra', 'venus', 'mercurio'],
    departure: { body: 'terra',    orbit: { kind: 'circular', alt_km: 200 } },
    arrival:   { body: 'mercurio', orbit: { kind: 'circular', alt_km: 200 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'venus',    timeParam: 't_TV' },
      { kind: 'flyby',   at: 'venus',   rpParam: 'rp' },
      { kind: 'lambert', from: 'venus', to: 'mercurio', timeParam: 't_VMer' },
    ],
    params: [
      { key: 'phase_mercurio', label: 'fase de Mercúrio', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 'phase_venus',    label: 'fase de Vênus',    kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TV',           label: 'T-V (dias)',       kind: 'days',  bounds: [30, 180] },
      { key: 't_VMer',         label: 'V-Mer (dias)',     kind: 'days',  bounds: [30, 200] },
      { key: 'rp',             label: 'r_p / R_SOI Vênus', kind: 'ratio', bounds: [0.015, 0.1] },
    ],
    presets: [
      { id: 'best', label: 'Melhor encontrado', x: [5.2272, 2.0935, 104.98, 75.50, 0.0163] },
    ],
    porkchopExplorations: ['sb-mercurio-phases', 'sb-mercurio-times'],
    plotUnit: 'AU',
  },

  // -----------------------------------------------------------------------
  // A8 — Terra → Júpiter com swing-by por Marte
  // -----------------------------------------------------------------------
  'jupiter-mars-flyby': {
    id: 'jupiter-mars-flyby',
    label: 'Terra → Júpiter (swing-by Marte)',
    short: 'Júpiter · swing-by Marte',
    badge: 'Swing-by externo',
    description: 'Direta para Júpiter custa ~14 km/s. Sobrevoando Marte primeiro, dá pra reduzir pra ~9-10 km/s — o gravity assist em Marte adiciona energia heliocêntrica.',
    estimatedCost: 14.4,
    centralBody: 'sol',
    visibleBodies: ['sol', 'terra', 'marte', 'jupiter'],
    departure: { body: 'terra',   orbit: { kind: 'circular', alt_km: 200 } },
    arrival:   { body: 'jupiter', orbit: { kind: 'circular', alt_km: 10000 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'marte',   timeParam: 't_TM' },
      { kind: 'flyby',   at: 'marte',   rpParam: 'rp' },
      { kind: 'lambert', from: 'marte', to: 'jupiter', timeParam: 't_MJ' },
    ],
    params: [
      { key: 'phase_jupiter', label: 'fase de Júpiter', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 'phase_marte',   label: 'fase de Marte',   kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TM',          label: 'T-M (dias)',      kind: 'days',  bounds: [120, 360] },
      { key: 't_MJ',          label: 'M-J (dias)',      kind: 'days',  bounds: [400, 1500] },
      { key: 'rp',            label: 'r_p / R_SOI Marte', kind: 'ratio', bounds: [0.02, 0.2] },
    ],
    presets: [
      { id: 'best', label: 'Melhor encontrado', x: [1.2682, 3.7401, 130.55, 417.16, 0.0557] },
    ],
    porkchopExplorations: ['sb-jupiter-phases', 'sb-jupiter-times'],
    plotUnit: 'AU',
  },

  // -----------------------------------------------------------------------
  // B1 — Terra → Lua (LEO → LLO), referencial GEOCÊNTRICO
  // -----------------------------------------------------------------------
  'earth-moon': {
    id: 'earth-moon',
    label: 'Terra → Lua (LEO → LLO)',
    short: 'Lua',
    badge: 'Geocêntrico',
    description: 'Mudança total de escala e referencial: a Terra é o corpo central, a Lua orbita a 384 mil km. Tempos em dias, não meses. Mostra que a abstração de missão funciona fora do paradigma heliocêntrico.',
    estimatedCost: 4.49,
    centralBody: 'terra',
    visibleBodies: ['terra', 'lua'],
    departure: { body: 'terra', orbit: { kind: 'circular', alt_km: 200 } },
    arrival:   { body: 'lua',   orbit: { kind: 'circular', alt_km: 100 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'lua', timeParam: 't_TL' },
    ],
    params: [
      { key: 'phase_lua', label: 'fase da Lua', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TL',      label: 'T-L (dias)',  kind: 'days',  bounds: [2.5, 14] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann LEO→Lua', x: [Math.PI, 4.98] },
    ],
    porkchopExplorations: ['moon-phase-time'],
    plotUnit: 'kkm', // milhares de km
  },
};

// Ordem de exibição na galeria
const MissionOrder = [
  'mars-direct-leo',
  'mars-venus-flyby',
  'mars-direct-geo',
  'venus-direct',
  'mercury-venus-flyby',
  'jupiter-mars-flyby',
  'earth-moon',
];
