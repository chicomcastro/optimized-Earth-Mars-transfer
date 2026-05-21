// Porte do Lambert-targeter (Izzo + Lancaster-Blanchard) - lambert.m
// Original: Rody P.S. Oldenhuis (2-clause BSD)

const Lambert = (() => {
  const DAYS = 86400;
  const TOL = 1e-14;

  // ===== Izzo (rápido) =====
  function lambertIzzo(r1vec, r2vec, tf, m, muC) {
    let bad = false;

    let r1 = Math.hypot(r1vec[0], r1vec[1], r1vec[2]);
    r1vec = Vec.scale(r1vec, 1 / r1);
    const V = Math.sqrt(muC / r1);
    r2vec = Vec.scale(r2vec, 1 / r1);
    const T_norm = r1 / V;
    tf = (tf * DAYS) / T_norm;

    let mr2vec = Math.hypot(r2vec[0], r2vec[1], r2vec[2]);
    let dth = Math.acos(clamp(Vec.dot(r1vec, r2vec) / mr2vec, -1, 1));

    const leftbranch = Math.sign(m);
    const longway = Math.sign(tf);
    m = Math.abs(m);
    tf = Math.abs(tf);
    if (longway < 0) dth = 2 * Math.PI - dth;

    const c = Math.sqrt(1 + mr2vec * mr2vec - 2 * mr2vec * Math.cos(dth));
    const s = (1 + mr2vec + c) / 2;
    const a_min = s / 2;
    const Lambda = (Math.sqrt(mr2vec) * Math.cos(dth / 2)) / s;
    const crossprd = Vec.cross(r1vec, r2vec);
    const mcr = Math.hypot(crossprd[0], crossprd[1], crossprd[2]);
    // Tolerância: para r1, r2 quase colineares (transferência ~0° ou ~180°)
    // o sinal de mcr depende de float epsilon — força sempre +z (CCW)
    // para evitar saltos de plano de órbita entre fase=0 e fase=360.
    const COLINEAR_TOL = 1e-10;
    const nrmunit = mcr < COLINEAR_TOL ? [0, 0, 1] : Vec.scale(crossprd, 1 / mcr);

    const logt = Math.log(tf);

    let inn1, inn2, x1, x2;
    if (m === 0) {
      inn1 = -0.5233;
      inn2 = 0.5233;
      x1 = Math.log(1 + inn1);
      x2 = Math.log(1 + inn2);
    } else {
      if (leftbranch < 0) {
        inn1 = -0.5234;
        inn2 = -0.2234;
      } else {
        inn1 = 0.7234;
        inn2 = 0.5234;
      }
      x1 = Math.tan((inn1 * Math.PI) / 2);
      x2 = Math.tan((inn2 * Math.PI) / 2);
    }

    const xx = [inn1, inn2];
    const aa = xx.map((v) => a_min / (1 - v * v));
    const bbeta = aa.map(
      (av) => longway * 2 * Math.asin(Math.sqrt((s - c) / 2 / av))
    );
    const aalfa = xx.map((v) => 2 * Math.acos(clamp(v, -1, 1)));
    const y12 = aa.map((av, i) =>
      av * Math.sqrt(av) *
      (aalfa[i] - Math.sin(aalfa[i]) - (bbeta[i] - Math.sin(bbeta[i])) +
        2 * Math.PI * m)
    );

    let y1, y2;
    if (m === 0) {
      y1 = Math.log(y12[0]) - logt;
      y2 = Math.log(y12[1]) - logt;
    } else {
      y1 = y12[0] - tf;
      y2 = y12[1] - tf;
    }

    let err = Infinity, iterations = 0, xnew = 0, x = 0;
    while (err > TOL) {
      iterations++;
      xnew = (x1 * y2 - y1 * x2) / (y2 - y1);
      if (m === 0) x = Math.exp(xnew) - 1;
      else x = (Math.atan(xnew) * 2) / Math.PI;

      const a = a_min / (1 - x * x);
      let alfa, beta;
      if (x < 1) {
        beta = longway * 2 * Math.asin(Math.sqrt((s - c) / 2 / a));
        alfa = 2 * Math.acos(clamp(x, -1, 1));
      } else {
        alfa = 2 * Math.acosh(x);
        beta = longway * 2 * Math.asinh(Math.sqrt((s - c) / (-2 * a)));
      }
      let tof;
      if (a > 0) {
        tof = a * Math.sqrt(a) *
          (alfa - Math.sin(alfa) - (beta - Math.sin(beta)) + 2 * Math.PI * m);
      } else {
        tof = -a * Math.sqrt(-a) *
          (Math.sinh(alfa) - alfa - (Math.sinh(beta) - beta));
      }
      const ynew = m === 0 ? Math.log(tof) - logt : tof - tf;
      x1 = x2; x2 = xnew;
      y1 = y2; y2 = ynew;
      err = Math.abs(x1 - xnew);
      if (iterations > 15) { bad = true; break; }
    }

    if (bad) {
      return lambertLB(
        Vec.scale(r1vec, r1),
        Vec.scale(r2vec, r1),
        longway * tf * T_norm,
        leftbranch * m,
        muC
      );
    }

    if (m === 0) x = Math.exp(xnew) - 1;
    else x = (Math.atan(xnew) * 2) / Math.PI;

    const a = a_min / (1 - x * x);
    let alfa, beta, psi, eta2, eta;
    if (x < 1) {
      beta = longway * 2 * Math.asin(Math.sqrt((s - c) / 2 / a));
      alfa = 2 * Math.acos(clamp(x, -1, 1));
      psi = (alfa - beta) / 2;
      eta2 = (2 * a * Math.sin(psi) ** 2) / s;
      eta = Math.sqrt(eta2);
    } else {
      beta = longway * 2 * Math.asinh(Math.sqrt((c - s) / 2 / a));
      alfa = 2 * Math.acosh(x);
      psi = (alfa - beta) / 2;
      eta2 = (-2 * a * Math.sinh(psi) ** 2) / s;
      eta = Math.sqrt(eta2);
    }

    const ih = Vec.scale(nrmunit, longway);
    const r2n = Vec.scale(r2vec, 1 / mr2vec);
    const crsprd1 = Vec.cross(ih, r1vec);
    const crsprd2 = Vec.cross(ih, r2n);

    const Vr1 = (1 / eta / Math.sqrt(a_min)) *
      (2 * Lambda * a_min - Lambda - x * eta);
    const Vt1 = Math.sqrt(((mr2vec / a_min / eta2) * Math.sin(dth / 2) ** 2));
    const Vt2 = Vt1 / mr2vec;
    const Vr2 = (Vt1 - Vt2) / Math.tan(dth / 2) - Vr1;

    const V1 = Vec.scale(
      Vec.add(Vec.scale(r1vec, Vr1), Vec.scale(crsprd1, Vt1)), V);
    const V2 = Vec.scale(
      Vec.add(Vec.scale(r2n, Vr2), Vec.scale(crsprd2, Vt2)), V);

    return {
      V1, V2,
      extremal: [Math.min(r1, mr2vec * r1), Math.max(r1, mr2vec * r1)],
      exitflag: 1,
    };
  }

  // ===== Lancaster-Blanchard (robusto, fallback) =====
  function LancasterBlanchardT(x, q, m) {
    if (x < -1) x = Math.abs(x) - 2;
    else if (x === -1) x = x + Number.EPSILON;
    const E = x * x - 1;
    let T, Tp, Tpp, Tppp;

    if (x === 1) {
      T = (4 / 3) * (1 - q ** 3);
      Tp = (4 / 5) * (q ** 5 - 1);
      Tpp = Tp + (120 / 70) * (1 - q ** 7);
      Tppp = 3 * (Tpp - Tp) + (2400 / 1080) * (q ** 9 - 1);
    } else if (Math.abs(x - 1) < 1e-2) {
      const s1 = sigmax(-E);
      const s2 = sigmax(-E * q * q);
      T = s1.sig - q ** 3 * s2.sig;
      Tp = 2 * x * (q ** 5 * s2.dsigdx - s1.dsigdx);
      Tpp = Tp / x + 4 * x * x * (s1.d2sigdx2 - q ** 7 * s2.d2sigdx2);
      Tppp = (3 * (Tpp - Tp / x)) / x +
        8 * x * x * (q ** 9 * s2.d3sigdx3 - s1.d3sigdx3);
    } else {
      const y = Math.sqrt(Math.abs(E));
      const z = Math.sqrt(1 + q * q * E);
      const f = y * (z - q * x);
      const g = x * z - q * E;
      let d;
      if (E < 0) d = Math.atan2(f, g) + Math.PI * m;
      else if (E === 0) d = 0;
      else d = Math.log(Math.max(0, f + g));

      T = (2 * (x - q * z - d / y)) / E;
      Tp = (4 - (4 * q ** 3 * x) / z - 3 * x * T) / E;
      Tpp = ((-4 * q ** 3) / z * (1 - (q * q * x * x) / (z * z)) -
        3 * T - 3 * x * Tp) / E;
      Tppp = ((4 * q ** 3) / (z * z) *
        ((1 - (q * q * x * x) / (z * z)) +
          (2 * q * q * x) / (z * z) * (z - x)) -
        8 * Tp - 7 * x * Tpp) / E;
    }
    return { T, Tp, Tpp, Tppp };
  }

  const SIGMA_AN = [
    4.0e-1, 2.142857142857143e-1, 4.62962962962963e-2, 6.628787878787879e-3,
    7.211538461538461e-4, 6.36574074074074e-5, 4.741479925303455e-6,
    3.059406328320802e-7, 1.74283640925506e-8, 8.892477331109578e-10,
    4.110111531986532e-11, 1.736709384841458e-12, 6.759767240041426e-14,
    2.439123386614026e-15, 8.203411614538007e-17, 2.583771576869575e-18,
    7.652331327976716e-20, 2.138860629743989e-21, 5.659959451165552e-23,
    1.422104833817366e-24, 3.401398483272306e-26, 7.762544304774155e-28,
    1.693916882090479e-29, 3.54129500676686e-31, 7.105336187804402e-33,
  ];
  function sigmax(y) {
    const powers = new Array(25);
    powers[0] = y;
    for (let i = 1; i < 25; i++) powers[i] = powers[i - 1] * y;
    let sig = 4 / 3;
    for (let i = 0; i < 25; i++) sig += powers[i] * SIGMA_AN[i];
    let dsigdx = 0;
    const arr1 = [1, ...powers.slice(0, 24)];
    for (let i = 0; i < 25; i++) dsigdx += (i + 1) * arr1[i] * SIGMA_AN[i];
    let d2sigdx2 = 0;
    const arr2 = [1 / y, 1, ...powers.slice(0, 23)];
    for (let i = 0; i < 25; i++)
      d2sigdx2 += (i + 1) * i * arr2[i] * SIGMA_AN[i];
    let d3sigdx3 = 0;
    const arr3 = [1 / (y * y), 1 / y, 1, ...powers.slice(0, 22)];
    for (let i = 0; i < 25; i++)
      d3sigdx3 += (i + 1) * i * (i - 1) * arr3[i] * SIGMA_AN[i];
    return { sig, dsigdx, d2sigdx2, d3sigdx3 };
  }

  function lambertLB(r1vec, r2vec, tf, m, muC) {
    const tol = 1e-12;
    const r1 = Math.hypot(r1vec[0], r1vec[1], r1vec[2]);
    const r2 = Math.hypot(r2vec[0], r2vec[1], r2vec[2]);
    const r1unit = Vec.scale(r1vec, 1 / r1);
    const r2unit = Vec.scale(r2vec, 1 / r2);
    const crsprod = Vec.cross(r1vec, r2vec);
    const mcrsprd = Math.hypot(crsprod[0], crsprod[1], crsprod[2]);
    const crsUnit = mcrsprd === 0 ? [0, 0, 1] : Vec.scale(crsprod, 1 / mcrsprd);
    const th1unit = Vec.cross(crsUnit, r1unit);
    const th2unit = Vec.cross(crsUnit, r2unit);
    let dth = Math.acos(clamp(Vec.dot(r1vec, r2vec) / r1 / r2, -1, 1));

    let longway = Math.sign(tf);
    tf = Math.abs(tf);
    if (longway < 0) dth = dth - 2 * Math.PI;

    let leftbranch = Math.sign(m);
    m = Math.abs(m);

    const c = Math.sqrt(r1 * r1 + r2 * r2 - 2 * r1 * r2 * Math.cos(dth));
    const s = (r1 + r2 + c) / 2;
    const T = Math.sqrt((8 * muC) / s ** 3) * tf * DAYS;
    const q = (Math.sqrt(r1 * r2) / s) * Math.cos(dth / 2);

    const T0obj = LancasterBlanchardT(0, q, m);
    const T0 = T0obj.T;
    const Td = T0 - T;
    const phr = ((2 * Math.atan2(1 - q * q, 2 * q)) % (2 * Math.PI) +
      2 * Math.PI) % (2 * Math.PI);

    let x0;
    let exitflag;

    if (m === 0) {
      const x01 = (T0 * Td) / 4 / T;
      if (Td > 0) {
        x0 = x01;
      } else {
        const x01b = Td / (4 - Td);
        const x02 = -Math.sqrt(-Td / (T + T0 / 2));
        const W = x01b + 1.7 * Math.sqrt(2 - phr / Math.PI);
        let x03;
        if (W >= 0) x03 = x01b;
        else x03 = x01b + Math.pow(-W, 1 / 16) * (x02 - x01b);
        const lambda =
          1 + (x03 * (1 + x01b)) / 2 - 0.03 * x03 * x03 * Math.sqrt(1 + x01b);
        x0 = lambda * x03;
      }
      if (x0 < -1) {
        return { V1: [NaN, NaN, NaN], V2: [NaN, NaN, NaN], extremal: [NaN, NaN], exitflag: -1 };
      }
    } else {
      const xMpi = 4 / (3 * Math.PI * (2 * m + 1));
      let xM0;
      if (phr < Math.PI) xM0 = xMpi * Math.pow(phr / Math.PI, 1 / 8);
      else if (phr > Math.PI)
        xM0 = xMpi * (2 - Math.pow(2 - phr / Math.PI, 1 / 8));
      else xM0 = 0;

      let xM = xM0, Tp_ = Infinity, iter = 0;
      let Tppx, Tpx, Tpppx;
      while (Math.abs(Tp_) > tol) {
        iter++;
        const lbres = LancasterBlanchardT(xM, q, m);
        Tp_ = lbres.Tp; Tppx = lbres.Tpp; Tpppx = lbres.Tppp; Tpx = lbres.Tp;
        const xMp = xM;
        xM = xM - (2 * Tpx * Tppx) / (2 * Tppx * Tppx - Tpx * Tpppx);
        if (iter % 7 !== 0) xM = (xMp + xM) / 2;
        if (iter > 25) {
          return { V1: [NaN, NaN, NaN], V2: [NaN, NaN, NaN], extremal: [NaN, NaN], exitflag: -2 };
        }
      }
      if (xM < -1 || xM > 1) {
        return { V1: [NaN, NaN, NaN], V2: [NaN, NaN, NaN], extremal: [NaN, NaN], exitflag: -1 };
      }
      const TM = LancasterBlanchardT(xM, q, m).T;
      if (TM > T) {
        return { V1: [NaN, NaN, NaN], V2: [NaN, NaN, NaN], extremal: [NaN, NaN], exitflag: -1 };
      }
      const TmTM = T - TM;
      const T0mTM = T0 - TM;
      const lb2 = LancasterBlanchardT(xM, q, m);
      const Tpp = lb2.Tpp;
      if (leftbranch > 0) {
        const xguess = Math.sqrt(TmTM / (Tpp / 2 + TmTM / (1 - xM) ** 2));
        let W = xM + xguess;
        W = (4 * W) / (4 + TmTM) + (1 - W) ** 2;
        x0 = xguess * (
          1 -
          ((1 + m + (dth - 0.5)) / (1 + 0.15 * m)) *
            xguess *
            (W / 2 + 0.03 * xguess * Math.sqrt(W))
        ) + xM;
        if (x0 > 1) {
          return { V1: [NaN, NaN, NaN], V2: [NaN, NaN, NaN], extremal: [NaN, NaN], exitflag: -1 };
        }
      } else {
        if (Td > 0) {
          x0 = xM - Math.sqrt(
            TM / (Tpp / 2 - TmTM * (Tpp / 2 / T0mTM - 1 / xM ** 2))
          );
        } else {
          const x00 = Td / (4 - Td);
          let W = x00 + 1.7 * Math.sqrt(2 * (1 - phr));
          let x03;
          if (W >= 0) x03 = x00;
          else
            x03 = x00 - Math.sqrt(Math.pow(-W, 1 / 8)) *
              (x00 + Math.sqrt(-Td / (1.5 * T0 - Td)));
          W = 4 / (4 - Td);
          const lambda =
            1 +
            ((1 + m + 0.24 * (dth - 0.5)) / (1 + 0.15 * m)) *
              x03 * (W / 2 - 0.03 * x03 * Math.sqrt(W));
          x0 = x03 * lambda;
        }
        if (x0 < -1) {
          return { V1: [NaN, NaN, NaN], V2: [NaN, NaN, NaN], extremal: [NaN, NaN], exitflag: -1 };
        }
      }
    }

    let x = x0, Tx = Infinity, iterations = 0;
    let Tp, Tpp;
    while (Math.abs(Tx) > tol) {
      iterations++;
      const lr = LancasterBlanchardT(x, q, m);
      Tx = lr.T - T;
      Tp = lr.Tp;
      Tpp = lr.Tpp;
      const xp = x;
      x = x - (2 * Tx * Tp) / (2 * Tp * Tp - Tx * Tpp);
      if (iterations % 7 !== 0) x = (xp + x) / 2;
      if (iterations > 25) {
        return { V1: [NaN, NaN, NaN], V2: [NaN, NaN, NaN], extremal: [NaN, NaN], exitflag: -2 };
      }
    }

    const gamma = Math.sqrt((muC * s) / 2);
    let sigma, rho, z;
    if (c === 0) { sigma = 1; rho = 0; z = Math.abs(x); }
    else {
      sigma = (2 * Math.sqrt((r1 * r2) / (c * c))) * Math.sin(dth / 2);
      rho = (r1 - r2) / c;
      z = Math.sqrt(1 + q * q * (x * x - 1));
    }

    const Vr1 = +gamma * ((q * z - x) - rho * (q * z + x)) / r1;
    const Vr1vec = Vec.scale(r1unit, Vr1);
    const Vr2 = -gamma * ((q * z - x) + rho * (q * z + x)) / r2;
    const Vr2vec = Vec.scale(r2unit, Vr2);
    const Vtan1 = (sigma * gamma * (z + q * x)) / r1;
    const Vtan1vec = Vec.scale(th1unit, Vtan1);
    const Vtan2 = (sigma * gamma * (z + q * x)) / r2;
    const Vtan2vec = Vec.scale(th2unit, Vtan2);

    const V1 = Vec.add(Vtan1vec, Vr1vec);
    const V2 = Vec.add(Vtan2vec, Vr2vec);
    return {
      V1, V2,
      extremal: [Math.min(r1, r2), Math.max(r1, r2)],
      exitflag: 1,
    };
  }

  function solve(r1vec, r2vec, tf, m, muC, options = {}) {
    // Por default, escolhe automaticamente o ramo prógrado (orbita CCW no plano xy).
    // Se short-way for retrógrado (r1 × r2 com z < 0), troca pra long-way passando tof < 0.
    // Pode ser desligado com options.prograde === false.
    let signedTf = tf;
    let r2 = r2vec.slice();
    if (options.prograde !== false) {
      const crossZ = r1vec[0] * r2vec[1] - r1vec[1] * r2vec[0];
      const r1mag = Math.hypot(r1vec[0], r1vec[1]);
      const r2mag = Math.hypot(r2vec[0], r2vec[1]);
      const sinDth = crossZ / (r1mag * r2mag);
      // |sin(dth)| muito pequeno → caso colinear (dth ≈ 0 ou π).
      // Newton-Raphson do Izzo é instável aqui. Perturbamos r2 perpendicular a r1
      // numa direção que GARANTE prógrado (CCW), pequena o bastante pra não
      // afetar a precisão do custo (~1 km em 1.5e8 km = 1e-8).
      if (Math.abs(sinDth) < 1e-8) {
        const eps = r2mag * 1e-8;
        // direção +90° a partir de r1 (CCW), normalizada
        r2 = [r2vec[0] - (r1vec[1] / r1mag) * eps,
              r2vec[1] + (r1vec[0] / r1mag) * eps,
              r2vec[2]];
        signedTf = Math.abs(tf); // short-way prógrado
      } else if (crossZ < 0) {
        signedTf = -Math.abs(tf); // long-way prógrado
      } else {
        signedTf = Math.abs(tf);
      }
    }
    return lambertIzzo(r1vec.slice(), r2, signedTf, m, muC);
  }

  return { solve };
})();
