import { World } from '../world/World';
import { Colony } from '../entities/Colony';
import { Ant } from '../entities/Ant';
import { EvolutionManager } from '../evolution/EvolutionManager';
import { StatsTracker } from '../utils/StatsTracker';
import { WeatherSystem } from '../world/WeatherSystem';

export class Simulation {
  world: World;
  colonies: Colony[];
  tick: number;
  generation: number;
  generationDuration: number;
  evolutionManager: EvolutionManager;
  statsTracker: StatsTracker;
  weather: WeatherSystem;

  constructor(world: World, colonies: Colony[], generationDuration: number = 6000) {
    this.world = world;
    this.colonies = colonies;
    this.tick = 0;
    this.generation = 1;
    this.generationDuration = generationDuration;
    this.weather = new WeatherSystem();
    this.evolutionManager = new EvolutionManager(0.1, 0.2, true);
    this.statsTracker = new StatsTracker();
  }

  update() {
    this.tick++;

    // Rolling generations: track generation number but no hard reset
    // Generation number advances every generationDuration ticks for stat tracking
    const newGen = Math.floor(this.tick / this.generationDuration) + 1;
    if (newGen > this.generation) {
      // Record stats at generation boundary
      this.colonies.forEach(colony => colony.calculateFitness(this.generationDuration));
      this.statsTracker.recordGenerationStats(this.colonies);
      this.generation = newGen;
    }

    // Update weather
    this.weather.update();

    // Update world and colonies
    this.world.update();
    this.colonies.forEach(colony => {
      const weatherMultiplier = this.weather.effectMultiplier;
      colony.weatherMultiplier = weatherMultiplier;
      colony.update(this.world);
    });

    // Track ant passages for territory claiming
    this.trackAntPassages();

    // Handle continuous ant death (age-based)
    this.handleAntDeath();

    // Handle continuous births from fittest genomes
    this.handleContinuousBirth();

    // Handle combat between colonies
    this.handleCombat();

    // Log stats every 500 ticks
    if (this.tick % 500 === 0) {
      this.colonies.forEach((colony, i) => {
        const workers = colony.ants.filter(a => a.caste === 'worker').length;
        const soldiers = colony.ants.filter(a => a.caste === 'soldier').length;
        const scouts = colony.ants.filter(a => a.caste === 'scout').length;
        console.log(
          `[T${this.tick}] Colony ${i}: pop=${colony.ants.length} (W${workers}/S${soldiers}/Sc${scouts}) ` +
          `food=${colony.food.toFixed(0)} income=${colony.recentFoodIncome.toFixed(1)} ` +
          `gathered=${colony.totalFoodGathered.toFixed(0)}`
        );
      });
    }
  }

  private trackAntPassages() {
    const world = this.world;
    const cellSize = world.cellSize;
    const ownership = world.territoryOwnership;
    const passageCount = world.passageCount;

    // Per-colony passage counts for this tick
    const colCounts: number[][][] = this.colonies.map(() =>
      Array(passageCount.length).fill(0).map(() => Array(passageCount[0].length).fill(0))
    );

    this.colonies.forEach((colony, colIdx) => {
      colony.ants.forEach(ant => {
        const cx = Math.floor(ant.x / cellSize);
        const cy = Math.floor(ant.y / cellSize);
        if (cy >= 0 && cy < passageCount.length && cx >= 0 && cx < passageCount[0].length) {
          colCounts[colIdx][cy][cx]++;
        }
      });
    });

    // Update territory ownership
    for (let y = 0; y < ownership.length; y++) {
      for (let x = 0; x < ownership[y].length; x++) {
        // Decay passage counts multiplicatively
        passageCount[y][x] *= 0.995;

        // Find dominant colony in this cell
        let maxPresence = 0;
        let dominant = -1;
        for (let c = 0; c < this.colonies.length; c++) {
          const p = colCounts[c][y][x];
          if (p > maxPresence) { maxPresence = p; dominant = c; }
        }

        if (maxPresence > 0) {
          passageCount[y][x] += maxPresence;
        }

        if (passageCount[y][x] >= world.PASSAGE_THRESHOLD && dominant >= 0) {
          ownership[y][x] = dominant;
        } else if (passageCount[y][x] < world.PASSAGE_THRESHOLD * 0.3) {
          ownership[y][x] = -1;
        }
      }
    }
  }

  private handleAntDeath() {
    // Remove ants that have reached their maximum age or have died from combat
    this.colonies.forEach(colony => {
      colony.ants = colony.ants.filter(ant => ant.age < ant.maxAge && ant.health > 0);
    });
  }

  private handleContinuousBirth() {
    // No births during initial learning period - let ants learn to forage first
    if (this.tick < 500) return;

    // Only attempt births every 100 ticks
    if (this.tick % 100 !== 0) return;

    this.colonies.forEach(colony => {
      const antSpawnCost = 10;
      const isExtinct = colony.ants.length === 0;

      // Emergency respawn if extinct - always respawn with food injection if needed
      if (isExtinct) {
        if (colony.food < antSpawnCost * 5) {
          colony.food = antSpawnCost * 5; // Emergency food injection
        }
        for (let i = 0; i < 5; i++) {
          const caste: 'worker' | 'soldier' | 'scout' = 
            i < 4 ? 'worker' : 'scout';
          const newAnt = new Ant(
            colony.nestX + Math.random() * 40 - 20,
            colony.nestY + Math.random() * 40 - 20,
            Math.random() * Math.PI * 2,
            caste,
            colony.id
          );
          newAnt.brain = newAnt.brain.mutate(0.3, 0.3);
          colony.ants.push(newAnt);
          colony.food -= antSpawnCost;
        }
        return;
      }

      // Normal births: only if positive food income AND food reserves scale with pop
      // Income must exceed colony metabolism to grow sustainably
      const metabolismCost = colony.ants.length * 0.005 * 200; // metabolism over income window
      const hasNetIncome = colony.recentFoodIncome > metabolismCost + antSpawnCost;
      const minReserve = Math.max(100, Math.min(300, colony.ants.length * 25));
      const hasReserves = colony.food > minReserve;
      
      if (!hasNetIncome || !hasReserves) return;

      // Spawn exactly 1 ant per cycle
      if (colony.food < antSpawnCost + minReserve) return;

      let newCaste: 'worker' | 'soldier' | 'scout';
      // Workers are the food producers — ensure at least 60% of births are workers
      const currentWorkers = colony.ants.filter(a => a.caste === 'worker').length;
      const workerRatio = colony.ants.length > 0 ? currentWorkers / colony.ants.length : 0;
      
      if (workerRatio < 0.6 || Math.random() < 0.6) {
        newCaste = 'worker';
      } else {
        const workerBias = colony.specialization.getWorkerBias();
        const soldierBias = colony.specialization.getSoldierBias();
        const scoutBias = colony.specialization.getScoutBias();
        const total = workerBias + soldierBias + scoutBias;
        const rand = Math.random() * total;
        if (rand < workerBias) newCaste = 'worker';
        else if (rand < workerBias + soldierBias) newCaste = 'soldier';
        else newCaste = 'scout';
      }

      const newAnt = new Ant(
        colony.nestX + Math.random() * 40 - 20,
        colony.nestY + Math.random() * 40 - 20,
        Math.random() * Math.PI * 2,
        newCaste,
        colony.id
      );
      
      // Copy brain from fittest ant of same caste
      const sameCaste = colony.ants.filter(a => a.caste === newCaste);
      if (sameCaste.length > 0) {
        const fittest = sameCaste.reduce((best, ant) =>
          ant.health + ant.energy > best.health + best.energy ? ant : best
        );
        newAnt.brain = fittest.brain.mutate(0.05, 0.1);
      } else if (colony.ants.length > 0) {
        const fittest = colony.ants.reduce((best, ant) =>
          ant.health + ant.energy > best.health + best.energy ? ant : best
        );
        newAnt.brain = fittest.brain.mutate(0.05, 0.1);
      }
      
      colony.ants.push(newAnt);
      colony.food -= antSpawnCost;
    });
  }

  private handleCombat() {
    for (let i = 0; i < this.colonies.length; ++i) {
      for (let j = i + 1; j < this.colonies.length; ++j) {
        const col1 = this.colonies[i];
        const col2 = this.colonies[j];

        // Colony 1 soldiers attack colony 2
        col1.ants.forEach(ant1 => {
          if (ant1.caste !== 'soldier' || ant1.attackCooldown > 0) return;
          col2.ants.forEach(ant2 => {
            const dist = Math.hypot(ant1.x - ant2.x, ant1.y - ant2.y);
            if (dist < 12) {
              ant1.attack();
              ant2.takeDamage(5);
              if (ant2.health <= 0) {
                col1.totalEnemyKills++;
                col1.soldierKills++;
              }
            }
          });
        });

        // Colony 2 soldiers attack colony 1 (symmetric)
        col2.ants.forEach(ant2 => {
          if (ant2.caste !== 'soldier' || ant2.attackCooldown > 0) return;
          col1.ants.forEach(ant1 => {
            const dist = Math.hypot(ant2.x - ant1.x, ant2.y - ant1.y);
            if (dist < 12) {
              ant2.attack();
              ant1.takeDamage(5);
              if (ant1.health <= 0) {
                col2.totalEnemyKills++;
                col2.soldierKills++;
              }
            }
          });
        });
      }
    }
  }
}
