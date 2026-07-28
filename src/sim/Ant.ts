import { Brain } from './Brain';
import { Caste, CASTE_HEALTH, CASTE_LIFESPAN } from './config';

/**
 * Brain I/O contract (used by Colony.updateAnt and the BrainViz UI):
 * inputs:  [carrying, energy, health, nestDist,
 *           foodTrailGrad, foodTrailHere, homeTrailGrad, homeTrailHere,
 *           alarmHere, enemyNear, allyDensity, daylight]
 * outputs: [turnBias, speedUrge, trailTrust, explorationUrge]
 */
export const BRAIN_SHAPE = [12, 10, 4];

export const INPUT_LABELS = [
  'carrying', 'energy', 'health', 'nest dist',
  'food grad', 'food trail', 'home grad', 'home trail',
  'alarm', 'enemy near', 'allies', 'daylight',
];
export const OUTPUT_LABELS = ['turn', 'speed', 'trail trust', 'explore'];

let nextId = 1;

export class Ant {
  readonly id = nextId++;
  x: number;
  y: number;
  angle: number;
  caste: Caste;
  colonyId: number;

  health: number;
  maxHealth: number;
  energy = 100;
  age = 0;
  maxAge: number;

  carry = 0;
  cooldown = 0;

  /** Trail-laying budgets: refreshed at nest / food, fade with distance travelled. */
  homePot = 1;
  foodPot = 0;

  fitness = 0;
  deliveries = 0;
  kills = 0;
  generation: number;

  brain: Brain;
  inputs = new Float32Array(BRAIN_SHAPE[0]);

  constructor(x: number, y: number, caste: Caste, colonyId: number, generation: number, brain?: Brain) {
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.caste = caste;
    this.colonyId = colonyId;
    this.generation = generation;
    this.maxHealth = CASTE_HEALTH[caste];
    this.health = this.maxHealth;
    this.maxAge = CASTE_LIFESPAN[caste] * (0.85 + Math.random() * 0.3);
    this.brain = brain ?? new Brain(BRAIN_SHAPE);
  }
}
