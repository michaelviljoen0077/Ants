// Central tuning knobs for the simulation.

export const CONFIG = {
  worldW: 1800,
  worldH: 1200,

  colonyCount: 3,
  start: { worker: 42, soldier: 7, scout: 6 },
  maxPop: 220,
  spawnCost: 14,
  spawnInterval: 22, // ticks between birth attempts per colony

  cell: 6, // pheromone field resolution (px per cell)

  whiskerDist: 18, // how far ahead ants sample trails
  whiskerAngle: 0.55, // radians left/right of heading

  antSense: 110, // direct vision range (food / enemies)
  scoutSense: 210,

  attackRange: 11,
  attackDamage: 7,
  attackCooldown: 18,

  dayLength: 2800, // ticks per full day/night cycle
  generationTicks: 3000, // bookkeeping marker for stats

  mutationRate: 0.12,
  mutationStrength: 0.25,
  crossoverChance: 0.3,

  foodClusters: 13,
  foodPerCluster: 260,
};

export interface ColonyTheme {
  name: string;
  core: string; // CSS color for ants / UI
  soft: string; // lighter accent
  trail: [number, number, number]; // to-food trail glow (RGB)
  home: [number, number, number]; // to-home trail glow (RGB)
}

export const COLONY_THEMES: ColonyTheme[] = [
  { name: 'Crimson', core: '#ff5546', soft: '#ffa094', trail: [255, 80, 60], home: [255, 165, 60] },
  { name: 'Azure', core: '#3f8cff', soft: '#9cc4ff', trail: [60, 130, 255], home: [70, 220, 255] },
  { name: 'Viridian', core: '#3ddc84', soft: '#a4f0c5', trail: [50, 220, 120], home: [190, 255, 110] },
  { name: 'Amethyst', core: '#b06cff', soft: '#d6b3ff', trail: [175, 100, 255], home: [255, 120, 230] },
  { name: 'Amber', core: '#ffb02e', soft: '#ffd894', trail: [255, 175, 40], home: [255, 240, 120] },
  { name: 'Frost', core: '#6ee7e7', soft: '#c2f7f7', trail: [100, 230, 230], home: [200, 240, 255] },
];

export type Caste = 'worker' | 'soldier' | 'scout';

export const CASTE_SPEED: Record<Caste, number> = { worker: 1.55, soldier: 1.35, scout: 2.2 };
export const CASTE_HEALTH: Record<Caste, number> = { worker: 60, soldier: 130, scout: 50 };
export const CASTE_LIFESPAN: Record<Caste, number> = { worker: 2600, soldier: 3200, scout: 2200 };
