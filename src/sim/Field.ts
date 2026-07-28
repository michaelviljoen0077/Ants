// A scalar field over the world (one pheromone channel).
// Cheap deposit/sample plus periodic decay + box diffusion so trails
// soften into gradients ants can climb.

export class Field {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  data: Float32Array;
  private tmp: Float32Array;

  static readonly MAX = 4;

  constructor(worldW: number, worldH: number, cell: number) {
    this.cell = cell;
    this.cols = Math.ceil(worldW / cell);
    this.rows = Math.ceil(worldH / cell);
    this.data = new Float32Array(this.cols * this.rows);
    this.tmp = new Float32Array(this.cols * this.rows);
  }

  private idx(x: number, y: number): number {
    let cx = (x / this.cell) | 0;
    let cy = (y / this.cell) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  deposit(x: number, y: number, amount: number): void {
    const i = this.idx(x, y);
    const v = this.data[i] + amount;
    this.data[i] = v > Field.MAX ? Field.MAX : v;
  }

  sample(x: number, y: number): number {
    return this.data[this.idx(x, y)];
  }

  decay(keep: number): void {
    const d = this.data;
    for (let i = 0; i < d.length; i++) d[i] *= keep;
  }

  /** 4-neighbour box diffusion; mix in [0..1] is how much leaks to neighbours. */
  diffuse(mix: number): void {
    const { cols, rows, data, tmp } = this;
    const inv = 1 - mix;
    const q = mix * 0.25;
    for (let y = 0; y < rows; y++) {
      const row = y * cols;
      const up = y > 0 ? row - cols : row;
      const dn = y < rows - 1 ? row + cols : row;
      for (let x = 0; x < cols; x++) {
        const i = row + x;
        const l = x > 0 ? i - 1 : i;
        const r = x < cols - 1 ? i + 1 : i;
        tmp[i] = data[i] * inv + (data[l] + data[r] + data[up + x] + data[dn + x]) * q;
      }
    }
    this.data = tmp;
    this.tmp = data;
  }
}
