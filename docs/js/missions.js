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
    destination: 'marte',
    departureLabel: 'LEO',
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
    destination: 'marte',
    departureLabel: 'LEO',
    flybyAt: 'venus',
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
    destination: 'marte',
    departureLabel: 'GEO',
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
    label: 'Terra → Vênus (direta de LEO)',
    short: 'Vênus · direta',
    badge: 'Hohmann interna',
    destination: 'venus',
    departureLabel: 'LEO',
    description: 'Espelho do Marte direto — em vez de subir, descemos para Vênus. Hohmann interna (transferência abaixo da órbita da Terra). Mostra que o solver é simétrico.',
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
    destination: 'mercurio',
    departureLabel: 'LEO',
    flybyAt: 'venus',
    description: 'Para Mercúrio o swing-by realmente paga: direta custa ~13 km/s, mas com sobrevoo em Vênus dá pra fazer com ~8.7 km/s. Foi exatamente o que a missão BepiColombo usou (várias vezes).',
    estimatedCost: 8.67,
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
      { id: 'best', label: 'Melhor encontrado', x: [5.3205, 2.1564, 109.07, 76.52, 0.0150] },
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
    destination: 'jupiter',
    departureLabel: 'LEO',
    flybyAt: 'marte',
    description: 'Direta para Júpiter custa ~23 km/s. Sobrevoando Marte só ajuda marginalmente (~21 km/s) porque a massa de Marte é pequena demais pra um swing-by eficiente. Missões reais (Galileo, Juno) usam Vênus e Terra como flybys.',
    estimatedCost: 21.0,
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
      { id: 'best', label: 'Melhor encontrado', x: [4.2579, 1.8463, 127.17, 1032.83, 0.020] },
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
    destination: 'lua',
    departureLabel: 'LEO',
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
    plotUnit: 'kkm',
  },

  // -----------------------------------------------------------------------
  // Variantes adicionais — completando a matriz [destino × departure × estratégia]
  // -----------------------------------------------------------------------

  // Vênus — saindo de GEO
  'venus-direct-geo': {
    id: 'venus-direct-geo',
    label: 'Terra → Vênus (direta de GEO)',
    short: 'Vênus · de GEO',
    badge: 'Direta',
    destination: 'venus',
    departureLabel: 'GEO',
    description: 'Hohmann interna pra Vênus partindo de GEO. ΔV menor que de LEO porque v_∞ pra Vênus é baixo — vale a pena estar mais alto na escapada (não vence o Oberth nesse caso).',
    estimatedCost: 5.26,
    centralBody: 'sol',
    visibleBodies: ['sol', 'venus', 'terra'],
    departure: { body: 'terra', orbit: { kind: 'circular', alt_km: 35786 } },
    arrival:   { body: 'venus', orbit: { kind: 'circular', alt_km: 300 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'venus', timeParam: 't_TV' },
    ],
    params: [
      { key: 'phase_venus', label: 'fase de Vênus', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TV',        label: 'T-V (dias)',    kind: 'days',  bounds: [60, 300] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann interna', x: [Math.PI, 146.06] },
    ],
    plotUnit: 'AU',
  },

  // Mercúrio — direta de LEO (cara, motiva flyby)
  'mercury-direct-leo': {
    id: 'mercury-direct-leo',
    label: 'Terra → Mercúrio (direta de LEO)',
    short: 'Mercúrio · direta',
    badge: 'Direta cara',
    destination: 'mercurio',
    departureLabel: 'LEO',
    description: 'Hohmann pra Mercúrio direto, sem flyby. Custa ~13 km/s — uma das missões interplanetárias mais caras existentes. Motiva o uso de swing-bys (ver variante com Vênus).',
    estimatedCost: 13.11,
    centralBody: 'sol',
    visibleBodies: ['sol', 'terra', 'venus', 'mercurio'],
    departure: { body: 'terra', orbit: { kind: 'circular', alt_km: 200 } },
    arrival:   { body: 'mercurio', orbit: { kind: 'circular', alt_km: 200 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'mercurio', timeParam: 't_TMer' },
    ],
    params: [
      { key: 'phase_mercurio', label: 'fase de Mercúrio', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TMer',         label: 'T-Mer (dias)',     kind: 'days',  bounds: [80, 250] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann Terra→Mercúrio', x: [Math.PI, 105.47] },
    ],
    plotUnit: 'AU',
  },

  // Mercúrio — direta de GEO
  'mercury-direct-geo': {
    id: 'mercury-direct-geo',
    label: 'Terra → Mercúrio (direta de GEO)',
    short: 'Mercúrio · de GEO',
    badge: 'Direta cara',
    destination: 'mercurio',
    departureLabel: 'GEO',
    description: 'Mercúrio direto de GEO. Curiosidade física: para v_∞ muito alto (caso Mercury), GEO fica *ligeiramente* PIOR que LEO por causa do efeito Oberth — burn em órbita mais baixa aproveita mais o poço gravitacional terrestre.',
    estimatedCost: 13.18,
    centralBody: 'sol',
    visibleBodies: ['sol', 'terra', 'venus', 'mercurio'],
    departure: { body: 'terra', orbit: { kind: 'circular', alt_km: 35786 } },
    arrival:   { body: 'mercurio', orbit: { kind: 'circular', alt_km: 200 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'mercurio', timeParam: 't_TMer' },
    ],
    params: [
      { key: 'phase_mercurio', label: 'fase de Mercúrio', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TMer',         label: 'T-Mer (dias)',     kind: 'days',  bounds: [80, 250] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann Terra→Mercúrio', x: [Math.PI, 105.47] },
    ],
    plotUnit: 'AU',
  },

  // Júpiter — direta de LEO
  'jupiter-direct-leo': {
    id: 'jupiter-direct-leo',
    label: 'Terra → Júpiter (direta de LEO)',
    short: 'Júpiter · direta',
    badge: 'Direta cara',
    destination: 'jupiter',
    departureLabel: 'LEO',
    description: 'Hohmann pra Júpiter direto. Custa ~23 km/s (!) — inviável na prática. Por isso missões reais (Galileo, Juno) usam multi-flyby. A variante com swing-by por Marte reduz isso pra ~14 km/s.',
    estimatedCost: 23.08,
    centralBody: 'sol',
    visibleBodies: ['sol', 'terra', 'marte', 'jupiter'],
    departure: { body: 'terra',   orbit: { kind: 'circular', alt_km: 200 } },
    arrival:   { body: 'jupiter', orbit: { kind: 'circular', alt_km: 10000 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'jupiter', timeParam: 't_TJ' },
    ],
    params: [
      { key: 'phase_jupiter', label: 'fase de Júpiter', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TJ',          label: 'T-J (dias)',      kind: 'days',  bounds: [500, 1500] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann Terra→Júpiter', x: [Math.PI, 997.76] },
    ],
    plotUnit: 'AU',
  },

  // Júpiter — direta de GEO
  'jupiter-direct-geo': {
    id: 'jupiter-direct-geo',
    label: 'Terra → Júpiter (direta de GEO)',
    short: 'Júpiter · de GEO',
    badge: 'Direta cara',
    destination: 'jupiter',
    departureLabel: 'GEO',
    description: 'Júpiter direto de GEO. Igual Mercury: para v_∞ alto, GEO é *levemente* pior que LEO (Oberth).',
    estimatedCost: 23.51,
    centralBody: 'sol',
    visibleBodies: ['sol', 'terra', 'marte', 'jupiter'],
    departure: { body: 'terra',   orbit: { kind: 'circular', alt_km: 35786 } },
    arrival:   { body: 'jupiter', orbit: { kind: 'circular', alt_km: 10000 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'jupiter', timeParam: 't_TJ' },
    ],
    params: [
      { key: 'phase_jupiter', label: 'fase de Júpiter', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TJ',          label: 'T-J (dias)',      kind: 'days',  bounds: [500, 1500] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann Terra→Júpiter', x: [Math.PI, 997.76] },
    ],
    plotUnit: 'AU',
  },

  // Lua — de GEO
  'earth-moon-geo': {
    id: 'earth-moon-geo',
    label: 'Terra → Lua (GEO → LLO)',
    short: 'Lua · de GEO',
    badge: 'Geocêntrico',
    destination: 'lua',
    departureLabel: 'GEO',
    description: 'Saindo de GEO já se está a quase metade do caminho pra Lua. ΔV cai drasticamente vs LEO (2.1 vs 4.5 km/s). Motivação real do GTO (Geo Transfer Orbit) como ponto de partida.',
    estimatedCost: 2.14,
    centralBody: 'terra',
    visibleBodies: ['terra', 'lua'],
    departure: { body: 'terra', orbit: { kind: 'circular', alt_km: 35786 } },
    arrival:   { body: 'lua',   orbit: { kind: 'circular', alt_km: 100 } },
    legs: [
      { kind: 'lambert', from: 'terra', to: 'lua', timeParam: 't_TL' },
    ],
    params: [
      { key: 'phase_lua', label: 'fase da Lua', kind: 'angle', bounds: [0, 2*Math.PI] },
      { key: 't_TL',      label: 'T-L (dias)',  kind: 'days',  bounds: [2.5, 14] },
    ],
    presets: [
      { id: 'hohmann', label: 'Hohmann GEO→Lua', x: [Math.PI, 5.67] },
    ],
    plotUnit: 'kkm',
  },
};

// Ordem de exibição na galeria: por destino, com LEO primeiro, depois GEO, depois flyby
const MissionOrder = [
  // Marte
  'mars-direct-leo',
  'mars-direct-geo',
  'mars-venus-flyby',
  // Vênus
  'venus-direct',
  'venus-direct-geo',
  // Mercúrio
  'mercury-direct-leo',
  'mercury-direct-geo',
  'mercury-venus-flyby',
  // Júpiter
  'jupiter-direct-leo',
  'jupiter-direct-geo',
  'jupiter-mars-flyby',
  // Lua
  'earth-moon',
  'earth-moon-geo',
];

// Metadados dos destinos pra galeria (filtros, ordem, cor)
const Destinations = [
  { id: 'marte',    label: 'Marte',    color: '#ef4444' },
  { id: 'venus',    label: 'Vênus',    color: '#f7c948' },
  { id: 'mercurio', label: 'Mercúrio', color: '#a78b6a' },
  { id: 'jupiter',  label: 'Júpiter',  color: '#d97706' },
  { id: 'lua',      label: 'Lua',      color: '#cbd5e1' },
];
