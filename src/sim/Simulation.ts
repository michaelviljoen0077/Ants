import { Ant } from './Ant';
import { Colony } from './Colony';
import { SpatialHash } from './SpatialHash';
import { World } from './World';
import { COLONY_THEMES, CONFIG } from './config';

export class Simulation {
  world: World;
  colonies: Colony[] = [];
  hash = new SpatialHash<Ant>(48);

  tick = 0;
  generation = 1;
  daylight = 1; // 1 = noon, 0 = midnight
  rain = 0; // 0..1
  private rainTarget = 0;

  selected: Ant | null = null;

  constructor() {
    this.world = new World();
    const spots = this.pickNestSites(CONFIG.colonyCount);
    for (let i = 0; i < CONFIG.colonyCount; i++) {
      this.colonies.push(new Colony(i, COLONY_THEMES[i % COLONY_THEMES.length], spots[i].x, spots[i].y, this.world));
    }
  }

  /** Greedy max-min-distance placement so nests start far apart and off the rocks. */
  private pickNestSites(n: number): { x: number; y: number }[] {
    const candidates: { x: number; y: number }[] = [];
    for (let i = 0; i < 200; i++) {
      const x = 150 + Math.random() * (this.world.w - 300);
      const y = 150 + Math.random() * (this.world.h - 300);
      if (!this.world.blocked(x, y, 50)) candidates.push({ x, y });
    }
    const chosen = [candidates[0] ?? { x: this.world.w / 2, y: this.world.h / 2 }];
    while (chosen.length < n && candidates.length) {
      let best = candidates[0];
      let bestScore = -1;
      for (const c of candidates) {
        const score = Math.min(...chosen.map((s) => Math.hypot(c.x - s.x, c.y - s.y)));
        if (score > bestScore) { bestScore = score; best = c; }
      }
      chosen.push(best);
    }
    return chosen;
  }

  update(): void {
    this.tick++;
    this.generation = Math.floor(this.tick / CONFIG.generationTicks) + 1;

    // Day/night: soft sine with a smooth dawn/dusk ramp; the sim starts at noon.
    const phase = Math.sin((this.tick / CONFIG.dayLength + 0.25) * Math.PI * 2);
    this.daylight = Math.min(1, Math.max(0, (phase + 0.35) / 0.7));

    // Weather drifts between dry spells and showers.
    if (Math.random() < 0.0006) this.rainTarget = this.rainTarget > 0 ? 0 : 0.4 + Math.random() * 0.6;
    this.rain += (this.rainTarget - this.rain) * 0.002;

    this.world.update(this.rain);

    this.hash.clear();
    for (const colony of this.colonies) {
      for (const ant of colony.ants) this.hash.insert(ant);
    }

    for (const colony of this.colonies) {
      // Point raids at the nearest rival that still has ants.
      let nearest: Colony | null = null;
      let nearestD = Infinity;
      for (const other of this.colonies) {
        if (other === colony || other.ants.length === 0) continue;
        const d = Math.hypot(other.nestX - colony.nestX, other.nestY - colony.nestY);
        if (d < nearestD) { nearestD = d; nearest = other; }
      }
      colony.raidTarget = nearest ? { x: nearest.nestX, y: nearest.nestY } : null;
      colony.update(this.world, this.hash, this.tick, this.daylight, this.generation);
    }

    if (this.selected && (this.selected.health <= 0 || this.selected.age >= this.selected.maxAge)) {
      this.selected = null;
    }
  }

  /** Nearest ant to a world-space point, for click-to-inspect. */
  findAntAt(x: number, y: number, radius = 14): Ant | null {
    let best: Ant | null = null;
    let bestD = radius;
    for (const colony of this.colonies) {
      for (const ant of colony.ants) {
        const d = Math.hypot(ant.x - x, ant.y - y);
        if (d < bestD) { bestD = d; best = ant; }
      }
    }
    return best;
  }

  dropFood(x: number, y: number): void {
    if (!this.world.blocked(x, y, 10)) this.world.spawnFoodCluster(x, y);
  }
}
