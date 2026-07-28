import { FoodNode } from '../entities/FoodNode';
import { PheromoneGrid } from './PheromoneGrid';
import { Obstacle } from './Obstacle';
import type { Colony } from '../entities/Colony';

export class World {
  width: number;
  height: number;
  foodNodes: FoodNode[];
  obstacles: Obstacle[];
  pheromonGrids: Map<number, PheromoneGrid>;
  colonies: Colony[];
  territoryOwnership: number[][]; // -1 = neutral, 0+ = colony ID
  cellSize: number;
  passageCount: number[][]; // Track how many times ants have passed through each cell
  PASSAGE_THRESHOLD: number = 25; // Required passages to establish strong claim (stricter)

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.foodNodes = [];
    this.obstacles = [];
    this.pheromonGrids = new Map();
    this.colonies = [];
    this.cellSize = 40; // Territory grid cell size
    
    // Initialize territory grid (-1 = unclaimed)
    const cols = Math.ceil(width / this.cellSize);
    const rows = Math.ceil(height / this.cellSize);
    this.territoryOwnership = Array(rows).fill(0).map(() => Array(cols).fill(-1));
    this.passageCount = Array(rows).fill(0).map(() => Array(cols).fill(0));
  }

  addPheromoneGrid(colonyId: number, grid: PheromoneGrid) {
    this.pheromonGrids.set(colonyId, grid);
  }

  addObstacle(obstacle: Obstacle) {
    this.obstacles.push(obstacle);
  }

  spawnObstacles(count: number, minSize: number = 20, maxSize: number = 60) {
    for (let i = 0; i < count; i++) {
      const w = minSize + Math.random() * (maxSize - minSize);
      const h = minSize + Math.random() * (maxSize - minSize);
      const x = Math.random() * (this.width - w);
      const y = Math.random() * (this.height - h);
      const types: Array<'wall' | 'water' | 'rock'> = ['wall', 'water', 'rock'];
      const type = types[Math.floor(Math.random() * types.length)];
      this.addObstacle(new Obstacle(x, y, w, h, type));
    }
  }

  canMoveTo(x: number, y: number, radius: number = 4): boolean {
    // Check boundaries
    if (x - radius < 0 || x + radius > this.width || y - radius < 0 || y + radius > this.height) {
      return false;
    }
    // Check obstacles
    for (const obstacle of this.obstacles) {
      if (obstacle.intersectsCircle(x, y, radius)) {
        return false;
      }
    }
    return true;
  }

  spawnFood(count: number, amount: number) {
    for (let i = 0; i < count; ++i) {
      let x, y;
      // Avoid spawning on obstacles
      let attempts = 0;
      do {
        x = Math.random() * this.width;
        y = Math.random() * this.height;
        attempts++;
      } while (!this.canMoveTo(x, y) && attempts < 10);
      
      if (attempts < 10) {
        this.foodNodes.push(new FoodNode(x, y, amount));
      }
    }
  }

  update() {
    const decayRate = 0.01;
    this.pheromonGrids.forEach(grid => grid.update(decayRate));

    // Remove depleted food nodes and regularly spawn new ones
    this.foodNodes = this.foodNodes.filter(f => f.amount > 0);
    if (this.foodNodes.length < 25 && Math.random() < 0.1) {
      this.spawnFood(5, 40);
    }
  }
}
