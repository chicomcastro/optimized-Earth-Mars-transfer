// Particle Swarm Optimization - porte de pso.m
// Roda assíncrono em blocos para não travar a UI.

function defaultBounds(venusSwingBy) {
  if (venusSwingBy) {
    return {
      // [phase_marte, phase_venus, t_terra_venus, t_venus_marte, rp_factor]
      lb: [0, 0, 30, 30, 0.015],
      ub: [2 * Math.PI, 2 * Math.PI, 180, 240, 0.1],
      labels: ["fase de Marte", "fase de Vênus", "T-V (dias)", "V-M (dias)", "r_p / R_SOI Vênus"],
    };
  }
  return {
    // [phase_marte, t_terra_marte]
    lb: [0, 120],
    ub: [2 * Math.PI, 360],
    labels: ["fase de Marte", "T-M (dias)"],
  };
}

function randomUniform(lb, ub) {
  const out = new Array(lb.length);
  for (let i = 0; i < lb.length; i++) out[i] = Math.random() * (ub[i] - lb[i]) + lb[i];
  return out;
}

function clampVec(x, lb, ub) {
  const out = new Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.min(Math.max(x[i], lb[i]), ub[i]);
  return out;
}

class PSO {
  constructor({
    numParticles = 200,
    maxIteration = 50,
    venusSwingBy = true,
    w = 0.9,
    phip = 0.6,
    phig = 0.8,
    lb, ub,
    onProgress,
  } = {}) {
    const bnd = (lb && ub) ? { lb, ub } : defaultBounds(venusSwingBy);
    this.lb = bnd.lb;
    this.ub = bnd.ub;
    this.dim = this.lb.length;
    this.numParticles = numParticles;
    this.maxIteration = maxIteration;
    this.venusSwingBy = venusSwingBy;
    this.w = w; this.phip = phip; this.phig = phig;
    this.onProgress = onProgress;

    this.bestGlobal = this.lb.slice();
    this.bestGlobalCost = Infinity;
    this.particles = [];
    this.iteration = 0;
    this._stop = false;

    for (let i = 0; i < numParticles; i++) {
      const xi = randomUniform(this.lb, this.ub);
      const delta = this.ub.map((u, k) => u - this.lb[k]);
      const negDelta = delta.map((d) => -d);
      const vi = randomUniform(negDelta, delta);
      const ci = cost(xi, { venusSwingBy: this.venusSwingBy });
      this.particles.push({
        x: xi, v: vi, best: xi.slice(), bestCost: ci,
      });
      if (ci < this.bestGlobalCost) {
        this.bestGlobalCost = ci;
        this.bestGlobal = xi.slice();
      }
    }
  }

  stop() { this._stop = true; }

  // Roda uma iteração
  step() {
    let bestIterationCost = Infinity;
    let bestIteration = null;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const rp = Math.random();
      const rg = Math.random();
      for (let k = 0; k < this.dim; k++) {
        p.v[k] = this.w * p.v[k]
          + this.phip * rp * (p.best[k] - p.x[k])
          + this.phig * rg * (this.bestGlobal[k] - p.x[k]);
        p.x[k] = Math.min(Math.max(p.x[k] + p.v[k], this.lb[k]), this.ub[k]);
      }
      const ci = cost(p.x, { venusSwingBy: this.venusSwingBy });
      if (ci < p.bestCost) {
        p.bestCost = ci;
        p.best = p.x.slice();
        if (ci < bestIterationCost) {
          bestIterationCost = ci;
          bestIteration = p.x.slice();
        }
      }
    }
    if (bestIteration !== null && bestIterationCost < this.bestGlobalCost) {
      this.bestGlobalCost = bestIterationCost;
      this.bestGlobal = bestIteration;
    }
    this.iteration += 1;
  }

  // Roda assíncrono em chunks
  async run({ chunkMs = 30 } = {}) {
    while (this.iteration < this.maxIteration && !this._stop) {
      const start = performance.now();
      while (
        this.iteration < this.maxIteration &&
        !this._stop &&
        performance.now() - start < chunkMs
      ) {
        this.step();
      }
      if (this.onProgress) {
        this.onProgress({
          iteration: this.iteration,
          maxIteration: this.maxIteration,
          bestGlobal: this.bestGlobal,
          bestGlobalCost: this.bestGlobalCost,
        });
      }
      // ceder thread
      await new Promise((r) => setTimeout(r, 0));
    }
    return {
      bestGlobal: this.bestGlobal,
      bestGlobalCost: this.bestGlobalCost,
      iteration: this.iteration,
    };
  }
}
