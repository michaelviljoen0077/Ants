// Simulation configuration type and defaults
export type SimulationConfig = {
  mapWidth: number;
  mapHeight: number;
  colonyCount: number;
  startingWorkers: number;
  startingSoldiers: number;
  startingScouts: number;
  startingFood: number;
  foodNodeCount: number;
  generationDurationTicks: number;
  antSensorRange: number;
  scoutSensorRange: number;
  antAttackRange: number;
  pheromoneDecayRate: number;
  antSpawnCost: number;
  workerCarryCapacity: number;
  mutationRate: number;
  mutationStrength: number;
  enableFogOfWar: boolean;
  enableTerrainObstacles: boolean;
  enableWeatherEffects: boolean;
  enableCrossoverEvolution: boolean;
  enableTournamentMode: boolean;
};

export const defaultConfig: SimulationConfig = {
  mapWidth: 1800,
  mapHeight: 1200,
  colonyCount: 2,
  startingWorkers: 10,
  startingSoldiers: 3,
  startingScouts: 2,
  startingFood: 100,
  foodNodeCount: 60,
  generationDurationTicks: 6000,
  antSensorRange: 100,
  scoutSensorRange: 180,
  antAttackRange: 12,
  pheromoneDecayRate: 0.01,
  antSpawnCost: 5,
  workerCarryCapacity: 10,
  mutationRate: 0.1,
  mutationStrength: 0.2,
  enableFogOfWar: true,
  enableTerrainObstacles: true,
  enableWeatherEffects: true,
  enableCrossoverEvolution: true,
  enableTournamentMode: true,
};
