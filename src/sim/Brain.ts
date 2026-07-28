// Tiny, fast feed-forward network on flat Float32Arrays.
// Keeps per-layer activations around so the UI can render the live brain.

export class Brain {
  readonly sizes: number[];
  /** w[l] is row-major (inSize x outSize): w[l][j * out + i] connects in-node j to out-node i. */
  w: Float32Array[];
  b: Float32Array[];
  /** acts[0] = inputs, acts[last] = outputs. Updated by forward(). */
  acts: Float32Array[];

  constructor(sizes: number[], randomize = true) {
    this.sizes = sizes;
    this.w = [];
    this.b = [];
    this.acts = sizes.map((n) => new Float32Array(n));
    for (let l = 0; l < sizes.length - 1; l++) {
      const nIn = sizes[l];
      const nOut = sizes[l + 1];
      const w = new Float32Array(nIn * nOut);
      const b = new Float32Array(nOut);
      if (randomize) {
        const scale = Math.sqrt(2 / nIn); // He-ish init keeps tanh out of saturation
        for (let i = 0; i < w.length; i++) w[i] = (Math.random() * 2 - 1) * scale;
        for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * 0.1;
      }
      this.w.push(w);
      this.b.push(b);
    }
  }

  forward(input: ArrayLike<number>): Float32Array {
    this.acts[0].set(input as Float32Array);
    for (let l = 0; l < this.w.length; l++) {
      const src = this.acts[l];
      const dst = this.acts[l + 1];
      const w = this.w[l];
      const b = this.b[l];
      const nIn = src.length;
      const nOut = dst.length;
      for (let i = 0; i < nOut; i++) {
        let sum = b[i];
        for (let j = 0; j < nIn; j++) sum += src[j] * w[j * nOut + i];
        dst[i] = Math.tanh(sum);
      }
    }
    return this.acts[this.acts.length - 1];
  }

  clone(): Brain {
    const c = new Brain(this.sizes, false);
    for (let l = 0; l < this.w.length; l++) {
      c.w[l].set(this.w[l]);
      c.b[l].set(this.b[l]);
    }
    return c;
  }

  /** Returns a mutated copy; the original is untouched. */
  mutate(rate: number, strength: number): Brain {
    const c = this.clone();
    for (let l = 0; l < c.w.length; l++) {
      const w = c.w[l];
      const b = c.b[l];
      for (let i = 0; i < w.length; i++) {
        if (Math.random() < rate) w[i] += (Math.random() * 2 - 1) * strength;
      }
      for (let i = 0; i < b.length; i++) {
        if (Math.random() < rate) b[i] += (Math.random() * 2 - 1) * strength;
      }
    }
    return c;
  }

  /** Uniform crossover of two parents with identical topology. */
  static crossover(a: Brain, b: Brain): Brain {
    const c = a.clone();
    for (let l = 0; l < c.w.length; l++) {
      const wc = c.w[l];
      const wb = b.w[l];
      for (let i = 0; i < wc.length; i++) if (Math.random() < 0.5) wc[i] = wb[i];
      const bc = c.b[l];
      const bb = b.b[l];
      for (let i = 0; i < bc.length; i++) if (Math.random() < 0.5) bc[i] = bb[i];
    }
    return c;
  }
}
