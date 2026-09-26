import { Brain } from './Brain';
import { Field } from './Field';
import { Simulation } from './Simulation';
import { SpatialHash } from './SpatialHash';

describe('Brain', () => {
  it('produces bounded outputs of the right size', () => {
    const b = new Brain([3, 4, 2]);
    const out = b.forward([0.5, -1, 1]);
    expect(out).toHaveLength(2);
    for (const v of Array.from(out)) expect(Math.abs(v)).toBeLessThanOrEqual(1);
  });

  it('mutate returns a copy and leaves the parent untouched', () => {
    const b = new Brain([3, 4, 2]);
    const before = Array.from(b.w[0]);
    const child = b.mutate(1, 0.5);
    expect(Array.from(b.w[0])).toEqual(before);
    expect(Array.from(child.w[0])).not.toEqual(before);
  });
});

describe('Field', () => {
  it('clamps deposits and clamps out-of-bounds samples to the edge', () => {
    const f = new Field(60, 60, 6);
    f.deposit(1, 1, 100);
    expect(f.sample(1, 1)).toBe(Field.MAX);
    expect(f.sample(-50, -50)).toBe(Field.MAX);
  });

  it('diffusion conserves mass away from the borders', () => {
    const f = new Field(60, 60, 6);
    f.deposit(30, 30, 2);
    const total = () => f.data.reduce((s, v) => s + v, 0);
    const t0 = total();
    f.diffuse(0.2);
    expect(total()).toBeCloseTo(t0, 5);
  });
});

describe('SpatialHash', () => {
  it('finds nearby items', () => {
    const h = new SpatialHash<{ x: number; y: number }>(10);
    const a = { x: 5, y: 5 };
    const b = { x: 500, y: 500 };
    h.insert(a);
    h.insert(b);
    const found: unknown[] = [];
    h.forEachInRange(8, 8, 10, (it) => found.push(it));
    expect(found).toEqual([a]);
  });
});

describe('Simulation', () => {
  it('runs for a while without producing invalid state', () => {
    const sim = new Simulation();
    for (let i = 0; i < 1500; i++) sim.update();
    for (const col of sim.colonies) {
      expect(Number.isFinite(col.foodStore)).toBe(true);
      expect(col.ants.length).toBeGreaterThan(0);
      for (const ant of col.ants) {
        expect(Number.isFinite(ant.x) && Number.isFinite(ant.y)).toBe(true);
        expect(ant.health).toBeGreaterThan(0);
        expect(sim.world.blocked(ant.x, ant.y, 0)).toBe(false);
      }
    }
  });
});
