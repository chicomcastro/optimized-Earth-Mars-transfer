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

// Devolve função (nu) -> r para a cônica que passa por (r,v) sob μ
function orbitaFromRV(r, v, mi) {
  const energia = Vec.dot(v, v) / 2 - mi / Vec.norm(r);
  const h = Vec.cross(r, v);
  const theta = angularCoord(r);
  const a = -mi / (2 * energia);
  const p = Math.pow(Vec.norm(h), 2) / mi;
  let e = Math.sqrt(Math.max(0, 1 - p / a));
  let phi = theta - Math.acos((1 - (a * (1 - e * e)) / Vec.norm(r)) / e);

  const b1 = Vec.scale(
    Vec.cross(Vec.cross(r, v), r),
    1 / Math.pow(Vec.norm(r), 2) / Vec.norm(v)
  );
  const b2 = Vec.scale(v, 1 / Vec.norm(v));
  const alpha = ang2vectors(b1, b2);
  if (alpha > Math.PI / 2) phi = Math.PI + phi;

  return (nu) => p / (1 - e * Math.cos(nu - phi));
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
