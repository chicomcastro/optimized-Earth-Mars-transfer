// Helpers para álgebra vetorial 3D (Array de 3 floats)
const Vec = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  norm: (a) => Math.hypot(a[0], a[1], a[2]),
  unit: (a) => {
    const n = Math.hypot(a[0], a[1], a[2]);
    return n === 0 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
  },
  // Matriz de rotação no plano xy (eixo z)
  rotZ: (vec, ang) => {
    const c = Math.cos(ang),
      s = Math.sin(ang);
    return [
      vec[0] * c + vec[1] * s,
      -vec[0] * s + vec[1] * c,
      vec[2],
    ];
  },
};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
