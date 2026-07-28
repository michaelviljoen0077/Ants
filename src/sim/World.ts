import { CONFIG } from './config';

export interface FoodSource {
  x: number;
  y: number;
  amount: number;
  max: number;
  seed: number; // stable random seed so the berry cluster doesn't flicker
}

export interface Rock {
  x: number;
  y: number;
  r: number;
}

export class World {
  readonly w = CONFIG.worldW;
  readonly h = CONFIG.worldH;
  food: FoodSource[] = [];
  rocks: Rock[] = [];

  constructor() {
    // Boulders: a few clusters of overlapping circles read as organic rock formations.
    const formations = 7;
    for (let f = 0; f < formations; f++) {
      const cx = 120 + Math.random() * (this.w - 240);
      const cy = 120 + Math.random() * (this.h - 240);
      const n = 2 + (Math.random() * 3) | 0;
      for (let i = 0; i < n; i++) {
        this.rocks.push({
          x: cx + (Math.random() - 0.5) * 90,
          y: cy + (Math.random() - 0.5) * 90,
          r: 22 + Math.random() * 40,
        });
      }
    }

    for (let i = 0; i < CONFIG.foodClusters; i++) this.spawnFoodCluster();
  }

  blocked(x: number, y: number, pad = 2): boolean {
    if (x < pad || y < pad || x > this.w - pad || y > this.h - pad) return true;
    for (let i = 0; i < this.rocks.length; i++) {
      const r = this.rocks[i];
      const dx = x - r.x;
      const dy = y - r.y;
      const rr = r.r + pad;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }

  /** Finds an open point, retrying if it lands inside a rock. */
  openSpot(margin: number): { x: number; y: number } {
    for (let i = 0; i < 60; i++) {
      const x = margin + Math.random() * (this.w - margin * 2);
      const y = margin + Math.random() * (this.h - margin * 2);
      if (!this.blocked(x, y, 24)) return { x, y };
    }
    return { x: this.w / 2, y: this.h / 2 };
  }

  spawnFoodCluster(cx?: number, cy?: number): void {
    const spot = cx === undefined ? this.openSpot(80) : { x: cx, y: cy! };
    const nodes = 3 + (Math.random() * 4) | 0;
    let remaining = CONFIG.foodPerCluster;
    for (let i = 0; i < nodes; i++) {
      const amt = remaining / (nodes - i) * (0.7 + Math.random() * 0.6);
      remaining -= amt;
      const x = spot.x + (Math.random() - 0.5) * 110;
      const y = spot.y + (Math.random() - 0.5) * 110;
      if (this.blocked(x, y, 8)) continue;
      this.food.push({ x, y, amount: amt, max: amt, seed: Math.random() * 1000 });
    }
  }

  update(rainIntensity: number): void {
    this.food = this.food.filter((f) => f.amount > 0.5);
    const total = this.food.reduce((s, f) => s + f.amount, 0);
    const target = CONFIG.foodClusters * CONFIG.foodPerCluster * 0.5;
    // Scarcity drives regrowth; rain accelerates it. Keeps the economy alive
    // without flooding the map.
    const chance = (total < target ? 0.012 : 0.002) * (1 + rainIntensity * 3);
    if (Math.random() < chance) this.spawnFoodCluster();
  }
}
