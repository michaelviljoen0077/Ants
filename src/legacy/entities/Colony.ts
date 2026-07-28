import { Ant, AntCaste } from './Ant';
import { Queen } from './Queen';
import { World } from '../world/World';
import { PheromoneGrid } from '../world/PheromoneGrid';
import { ColonySpecialization } from './ColonySpecialization';

export class Colony {
  id: number;
  ants: Ant[];
  queen: Queen;
  color: string;
  specialization: ColonySpecialization;
  nestX: number;
  nestY: number;
  food: number;
  pheromoneGrid: PheromoneGrid;
  fitness: number;
  totalFoodGathered: number;
  totalEnemyKills: number;
  weatherMultiplier: number = 1.0;
  
  // Caste-specific performance tracking
  workerFoodGathered: number = 0;
  soldierKills: number = 0;
  scoutDiscoveries: number = 0;
  scoutTerritoryExpanded: number = 0;

  prevWorkerCount: number = 0;
  prevSoldierCount: number = 0;
  prevFood: number = 0;
  exploredCells: Set<number> = new Set();

  // Food income tracking for birth rate control
  recentFoodIncome: number = 0;
  private foodIncomeWindow: number[] = [];
  private readonly INCOME_WINDOW_SIZE = 200; // track last 200 ticks

  constructor(
    id: number,
    color: string,
    world: World,
    workerCount: number,
    soldierCount: number,
    scoutCount: number = 0
  ) {
    this.id = id;
    this.color = color;
    this.ants = [];
    
    // Find a valid nest location (open area, away from obstacles and other nests)
    let nestX = 0, nestY = 0;
    let valid = false;
    let attempts = 0;
    const MIN_NEST_DISTANCE = 1200; // Very large nest distance on big map
    
    while (!valid && attempts < 50) {
      nestX = 50 + Math.random() * (world.width - 100);
      nestY = 50 + Math.random() * (world.height - 100);
      
      // Check if position is clear of obstacles
      valid = world.canMoveTo(nestX, nestY, 30);
      
      // Check if too close to other nests (estimated by checking colonies array)
      // For now, this works since colonies are being created sequentially
      if (valid && world.colonies) {
        for (const otherColony of world.colonies) {
          const dist = Math.hypot(nestX - otherColony.nestX, nestY - otherColony.nestY);
          if (dist < MIN_NEST_DISTANCE) {
            valid = false;
            break;
          }
        }
      }
      attempts++;
    }
    
    this.nestX = nestX;
    this.nestY = nestY;
    this.food = 1000; // Large starting stockpile
    this.pheromoneGrid = new PheromoneGrid(world.width, world.height, 15, id);
    world.addPheromoneGrid(id, this.pheromoneGrid);
    this.queen = new Queen(id, this.nestX, this.nestY);
    // Random specialization for genetic diversity
    const specTypes: Array<'balanced' | 'aggressive' | 'defensive' | 'harvester' | 'scout-focused'> =
      ['balanced', 'aggressive', 'defensive', 'harvester', 'scout-focused'];
    this.specialization = new ColonySpecialization(specTypes[id % specTypes.length], 0.3 + Math.random() * 0.4);
    this.fitness = 0;
    this.totalFoodGathered = 0;
    this.totalEnemyKills = 0;
    this.workerFoodGathered = 0;
    this.soldierKills = 0;
    this.scoutDiscoveries = 0;
    this.scoutTerritoryExpanded = 0;

    for (let i = 0; i < workerCount; i++) {
      this.ants.push(
        new Ant(
          this.nestX + Math.random() * 40 - 20,
          this.nestY + Math.random() * 40 - 20,
          Math.random() * Math.PI * 2,
          'worker',
          id
        )
      );
    }

    for (let i = 0; i < soldierCount; i++) {
      this.ants.push(
        new Ant(
          this.nestX + Math.random() * 40 - 20,
          this.nestY + Math.random() * 40 - 20,
          Math.random() * Math.PI * 2,
          'soldier',
          id
        )
      );
    }

    for (let i = 0; i < scoutCount; i++) {
      this.ants.push(
        new Ant(
          this.nestX + Math.random() * 40 - 20,
          this.nestY + Math.random() * 40 - 20,
          Math.random() * Math.PI * 2,
          'scout',
          id
        )
      );
    }
  }

  update(world: World): void {
    const workerCount = this.ants.filter(a => a.caste === 'worker').length;
    const soldierCount = this.ants.filter(a => a.caste === 'soldier').length;

    // Compute death rates and food income for queen
    const workerDeathRate = this.prevWorkerCount > 0 ? Math.max(0, this.prevWorkerCount - workerCount) / this.prevWorkerCount : 0;
    const soldierDeathRate = this.prevSoldierCount > 0 ? Math.max(0, this.prevSoldierCount - soldierCount) / this.prevSoldierCount : 0;
    const foodIncomeRate = Math.max(0, this.food - this.prevFood) / Math.max(1, this.food + 1);

    // Count nearby enemies for queen awareness
    let enemyPresence = 0;
    if (world.colonies) {
      for (const col of world.colonies) {
        if (col.id === this.id) continue;
        for (const a of col.ants) {
          if (Math.hypot(a.x - this.nestX, a.y - this.nestY) < 200) enemyPresence++;
        }
      }
    }

    this.queen.update(this.food, this.ants.length, Math.min(1, enemyPresence / 10),
      workerCount, soldierCount, workerDeathRate, soldierDeathRate, foodIncomeRate);

    this.prevWorkerCount = workerCount;
    this.prevSoldierCount = soldierCount;
    this.prevFood = this.food;

    this.pheromoneGrid.deposit('home', this.nestX, this.nestY, 20);

    this.ants.forEach((ant) => {
      // Age the ant every tick
      ant.age++;
      if (ant.attackCooldown > 0) ant.attackCooldown--;

      // Include ants from all colonies for enemy detection
      const sensorRange = ant.caste === 'scout' ? 250 : 150;
      const allAnts: { x: number; y: number; caste: string; colonyId: number }[] = [];
      if (world.colonies) {
        for (const col of world.colonies) {
          for (const a of col.ants) {
            if (a !== ant && Math.hypot(a.x - ant.x, a.y - ant.y) < sensorRange) {
              allAnts.push(a);
            }
          }
        }
      }
      const nearbyAnts = allAnts;

      const nearbyFood = world.foodNodes.filter(
        (f) =>
          f.amount > 0 && Math.hypot(f.x - ant.x, f.y - ant.y) < 150
      );

      const pheromones = {
        home: this.pheromoneGrid.sense('home', ant.x, ant.y),
        food: this.pheromoneGrid.sense('food', ant.x, ant.y),
        danger: this.pheromoneGrid.sense('danger', ant.x, ant.y),
        attack: this.pheromoneGrid.sense('attack', ant.x, ant.y),
      };

      const sensorInputs = ant.getSensorInputs(
        nearbyAnts,
        nearbyFood,
        this.nestX,
        this.nestY,
        pheromones,
        this.queen.aggression,
        this.queen.defense,
        this.queen.exploration
      );
      const nnOutput = ant.brain.forward(sensorInputs);
      const decision = ant.decideAction(
        nnOutput,
        this.queen.aggression,
        this.queen.defense,
        this.weatherMultiplier
      );

      const newX = ant.x + decision.moveX;
      const newY = ant.y + decision.moveY;
      
      // Check if movement is valid (not blocked by obstacles)
      if (world.canMoveTo(newX, newY, 4)) {
        ant.x = newX;
        ant.y = newY;
      } else {
        // Try moving in alternative direction if blocked
        const alternateX = ant.x + decision.moveX * 0.5;
        if (world.canMoveTo(alternateX, ant.y, 4)) {
          ant.x = alternateX;
        } else {
          const alternateY = ant.y + decision.moveY * 0.5;
          if (world.canMoveTo(ant.x, alternateY, 4)) {
            ant.y = alternateY;
          }
        }
      }

      if (ant.caste === 'worker') {
        if (
          ant.carryingFood > 0 &&
          Math.hypot(ant.x - this.nestX, ant.y - this.nestY) < 20
        ) {
          this.food += ant.carryingFood;
          this.totalFoodGathered += ant.carryingFood;
          this.workerFoodGathered += ant.carryingFood;
          this.foodIncomeWindow.push(ant.carryingFood);
          ant.carryingFood = 0;
        } else if (ant.carryingFood === 0) {
          // Innate attraction toward visible food (strong enough to compete with NN noise)
          if (nearbyFood.length > 0) {
            const closest = nearbyFood.reduce((best, f) => 
              Math.hypot(f.x - ant.x, f.y - ant.y) < Math.hypot(best.x - ant.x, best.y - ant.y) ? f : best
            );
            const angleToFood = Math.atan2(closest.y - ant.y, closest.x - ant.x);
            ant.angle += (angleToFood - ant.angle) * 0.35; // strong nudge toward food
          } else {
            // No food visible — explore AWAY from nest to search
            const nestDist = Math.hypot(ant.x - this.nestX, ant.y - this.nestY);
            if (nestDist < 200) {
              // Too close to nest, push outward
              const awayAngle = Math.atan2(ant.y - this.nestY, ant.x - this.nestX);
              ant.angle += (awayAngle - ant.angle) * 0.15;
            }
            // Also follow food pheromone trails if present
            const foodPh = this.pheromoneGrid.sense('food', ant.x, ant.y);
            if (foodPh > 10) {
              // Sense pheromone gradient and move toward stronger signal
              const phLeft = this.pheromoneGrid.sense('food', 
                ant.x + Math.cos(ant.angle + 0.5) * 20, 
                ant.y + Math.sin(ant.angle + 0.5) * 20);
              const phRight = this.pheromoneGrid.sense('food',
                ant.x + Math.cos(ant.angle - 0.5) * 20,
                ant.y + Math.sin(ant.angle - 0.5) * 20);
              if (phLeft > phRight) ant.angle += 0.2;
              else if (phRight > phLeft) ant.angle -= 0.2;
            }
          }

          for (const food of nearbyFood) {
            if (
              food.amount > 0 &&
              Math.hypot(ant.x - food.x, ant.y - food.y) < 30
            ) {
              ant.carryingFood = Math.min(10, food.amount);
              food.amount -= ant.carryingFood;
              if (ant.carryingFood > 0) {
                this.pheromoneGrid.deposit('food', ant.x, ant.y, 15);
              }
              break;
            }
          }
        }

        if (ant.carryingFood > 0) {
          const dx = this.nestX - ant.x;
          const dy = this.nestY - ant.y;
          const angleToNest = Math.atan2(dy, dx);
          ant.angle += (angleToNest - ant.angle) * 0.3;
        }
      } else if (ant.caste === 'soldier') {
        // Deposit attack pheromone when engaging enemies
        if (
          decision.shouldAttack &&
          nearbyAnts.some((a) => a.colonyId !== this.id)
        ) {
          ant.attack();
          this.pheromoneGrid.deposit('attack', ant.x, ant.y, 10);
        }
        // Deposit danger pheromone when enemies are nearby
        if (nearbyAnts.some(a => a.colonyId !== this.id)) {
          this.pheromoneGrid.deposit('danger', ant.x, ant.y, 5);
        }
      } else if (ant.caste === 'scout') {
        // Track scout territory exploration (no double movement - speed already in decideAction)
        const cellKey = Math.floor(ant.x / 40) * 10000 + Math.floor(ant.y / 40);
        if (!this.exploredCells.has(cellKey)) {
          this.exploredCells.add(cellKey);
          this.scoutTerritoryExpanded++;
        }
        // Track food discoveries
        if (nearbyFood.length > 0) {
          this.scoutDiscoveries++;
          this.pheromoneGrid.deposit('food', ant.x, ant.y, 8);
        }
      }

      // Energy depletion: much slower drain
      const energyCost = ant.caste === 'scout' ? 0.05 : ant.caste === 'soldier' ? 0.06 : 0.04;
      ant.energy = Math.max(0, ant.energy - energyCost);

      // Recharge energy near nest
      if (Math.hypot(ant.x - this.nestX, ant.y - this.nestY) < 40) {
        ant.energy = Math.min(100, ant.energy + 0.5);
      }

      // Very slow health drain at 0 energy
      if (ant.energy <= 0) {
        ant.health -= 0.02;
      }
    });

    // Deposit danger pheromone where ants died
    this.ants.forEach(ant => {
      if (ant.health <= 0) {
        this.pheromoneGrid.deposit('danger', ant.x, ant.y, 20);
      }
    });

    // Consume colony food for metabolism (very low per-ant cost)
    const totalConsumption = this.ants.length * 0.005;
    this.food = Math.max(0, this.food - totalConsumption);

    // Starvation: slow health drain when food is completely gone
    if (this.food <= 0) {
      this.ants.forEach(ant => {
        ant.health -= 0.05;
      });
    }

    // Update food income tracking (sliding window)
    // Trim window to size
    while (this.foodIncomeWindow.length > this.INCOME_WINDOW_SIZE) {
      this.foodIncomeWindow.shift();
    }
    this.recentFoodIncome = this.foodIncomeWindow.reduce((s, v) => s + v, 0);

    this.ants = this.ants.filter((ant) => ant.health > 0);
  }

  calculateFitness(generationDuration: number): void {
    // Per-caste fitness contributions
    const workerScore = this.workerFoodGathered * 2;
    const soldierScore = this.soldierKills * 3;
    const scoutScore = this.scoutDiscoveries * 0.5 + this.scoutTerritoryExpanded * 1;
    const populationScore = this.ants.length;
    const survivalBonus = this.queen.health > 0 ? 50 : 0;
    this.fitness = workerScore + soldierScore + scoutScore + populationScore + survivalBonus;
  }

  reset(): void {
    this.totalFoodGathered = 0;
    this.totalEnemyKills = 0;
    this.workerFoodGathered = 0;
    this.soldierKills = 0;
    this.scoutDiscoveries = 0;
    this.scoutTerritoryExpanded = 0;
  }

  clone(world?: World): Colony {
    const w = world || ({
      width: 900,
      height: 600,
      addPheromoneGrid: () => {},
    } as any);

    const cloned = new Colony(this.id, this.color, w, 0, 0);
    // PRESERVE nest location - don't let constructor randomize it
    cloned.nestX = this.nestX;
    cloned.nestY = this.nestY;
    cloned.queen = this.queen.clone();
    cloned.queen.x = this.nestX;
    cloned.queen.y = this.nestY;
    cloned.ants = this.ants.map((ant) => ant.clone());
    cloned.food = this.food;
    return cloned;
  }

  mutate(rate: number, strength: number): void {
    this.queen.mutate(rate, strength);
    this.ants.forEach((ant) => ant.mutate(rate, strength));
  }
}
