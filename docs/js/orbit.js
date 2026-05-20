// Reconstrução de cônica a partir de r, v (orbita_from_rv.m + helpers)

function angularCoord(pos) {
  const x = pos[0], y = pos[1];
  if (x === 0) {
    if (y > 0) return Math.PI / 2;
    if (y < 0) return (3 * Math.PI) / 2;
    return 0;
  }
  if (y === 0) {
    if (x > 0) return 0;
    return Math.PI;
  }
  let theta = Math.atan(y / x);
  theta = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (theta > (3 * Math.PI) / 2) {
    if (y > 0) theta = theta - Math.PI;
  }
  return theta;
}

function ang2vectors(a, b) {
  let t = Math.acos(Vec.dot(a, b) / Vec.norm(a) / Vec.norm(b));
  if (t > Math.PI) t = 2 * Math.PI - t;
  return t;
}

// Devolve função (θ) -> r para a cônica que passa por (r, v) sob μ.
// Usa vetor excentricidade pra eliminar a ambiguidade do acos: o periapsis
// fica na direção do vetor e, sem ter que adivinhar o sinal.
// θ é a coordenada angular cartesiana (medida a partir do eixo +x).
function orbitaFromRV(r, v, mi) {
  const rMag = Vec.norm(r);
  const vMag = Vec.norm(v);
  const h = Vec.cross(r, v); // momento angular específico

  // Vetor excentricidade: e_vec = ((|v|² - μ/|r|)·r - (r·v)·v) / μ
  const rDotV = Vec.dot(r, v);
  const term1 = Vec.scale(r, vMag * vMag - mi / rMag);
  const term2 = Vec.scale(v, rDotV);
  const eVec = Vec.scale(Vec.sub(term1, term2), 1 / mi);
  const e = Vec.norm(eVec);
  const p = Vec.dot(h, h) / mi; // semi-latus rectum

  // Periapsis: ângulo do vetor excentricidade (no plano xy)
  // Se e ≈ 0 (órbita circular), φ é irrelevante; usa 0.
  const phi = e > 1e-9 ? Math.atan2(eVec[1], eVec[0]) : 0;

  // h_z indica sentido da órbita: positivo = CCW (prograda no plano xy)
  // Se for retrograda (h_z < 0), o ν cresce na direção oposta.
  const sgn = h[2] >= 0 ? 1 : -1;

  return (theta) => p / (1 + e * Math.cos(sgn * (theta - phi)));
}

// Amostra a cônica e devolve [{x,y}]
function sampleOrbit(r, v, mi, nSamples = 360) {
  const conica = orbitaFromRV(r, v, mi);
  const pts = [];
  for (let i = 0; i <= nSamples; i++) {
    const nu = (i / nSamples) * 2 * Math.PI;
    const rad = conica(nu);
    if (!isFinite(rad) || rad <= 0 || rad > 1e10) continue;
    pts.push({ x: rad * Math.cos(nu), y: rad * Math.sin(nu) });
  }
  return pts;
}
