// Uniform-grid spatial hash so neighbour queries are O(1)-ish instead of
// scanning every ant against every ant.

export interface HasPosition {
  x: number;
  y: number;
}

export class SpatialHash<T extends HasPosition> {
  private cell: number;
  private map = new Map<number, T[]>();

  constructor(cell: number) {
    this.cell = cell;
  }

  private key(cx: number, cy: number): number {
    return cy * 100003 + cx;
  }

  clear(): void {
    this.map.clear();
  }

  insert(item: T): void {
    const k = this.key((item.x / this.cell) | 0, (item.y / this.cell) | 0);
    const bucket = this.map.get(k);
    if (bucket) bucket.push(item);
    else this.map.set(k, [item]);
  }

  /** Visits every item whose cell overlaps the circle; caller filters by exact distance. */
  forEachInRange(x: number, y: number, r: number, fn: (item: T) => void): void {
    const minX = ((x - r) / this.cell) | 0;
    const maxX = ((x + r) / this.cell) | 0;
    const minY = ((y - r) / this.cell) | 0;
    const maxY = ((y + r) / this.cell) | 0;
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const bucket = this.map.get(this.key(cx, cy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) fn(bucket[i]);
      }
    }
  }
}
