import { NeuralNetwork } from '../ai/NeuralNetwork';

export type AntCaste = 'worker' | 'soldier' | 'scout';

export class Ant {
  x: number;
  y: number;
  angle: number;
  caste: AntCaste;
  health: number;
  energy: number;
  colonyId: number;
  carryingFood: number;
  brain: NeuralNetwork;
  attackCooldown: number;
  age: number; // Age in ticks
  maxAge: number; // Maximum lifespan before natural death

  constructor(x: number, y: number, angle: number, caste: AntCaste, colonyId: number) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.caste = caste;
    this.health = 100;
    this.energy = 100;
    this.colonyId = colonyId;
    this.carryingFood = 0;
    // Ant NN: 12 inputs -> [16, 8] hidden layers -> 4 outputs
    this.brain = new NeuralNetwork(12, [16, 8], 4);
    
    // Pre-train neural network based on caste
    this.applyCASTETraining();
    
    this.attackCooldown = 0;
    this.age = 0;
    this.maxAge = 1500 + Math.random() * 1000; // 1500-2500 ticks lifespan
  }

  private applyCASTETraining() {
    // Bias initial weights to favor caste-specific behaviors
    // Layer 0: input to hidden (12 inputs -> 8 hidden)
    // Layer 1: hidden to output (8 hidden -> 4 outputs)
    const h1 = 16; // first hidden layer size
    
    switch (this.caste) {
      case 'worker':
        for (let h = 0; h < h1; h++) {
          this.brain.weights[0][0][h] += 0.3;
          this.brain.weights[0][4][h] += 0.3;
        }
        for (let i = 0; i < 8; i++) {
          this.brain.weights[2][i][0] += 0.2;
          this.brain.weights[2][i][1] += 0.2;
        }
        break;
        
      case 'soldier':
        for (let h = 0; h < h1; h++) {
          this.brain.weights[0][2][h] += 0.3;
          this.brain.weights[0][5][h] += 0.2;
        }
        for (let i = 0; i < 8; i++) {
          this.brain.weights[2][i][3] += 0.4;
        }
        break;
        
      case 'scout':
        for (let h = 0; h < h1; h++) {
          this.brain.weights[0][8][h] += 0.2;
          this.brain.weights[0][9][h] += 0.2;
        }
        for (let i = 0; i < 8; i++) {
          this.brain.weights[2][i][0] += 0.3;
          this.brain.weights[2][i][1] += 0.3;
          this.brain.weights[2][i][2] += 0.2;
        }
        break;
    }
  }

  update() {
    // Simple random walk for MVP
    this.angle += (Math.random() - 0.5) * 0.3;
    this.x += Math.cos(this.angle) * 2;
    this.y += Math.sin(this.angle) * 2;
    this.energy = Math.max(0, this.energy - 0.5);
    this.age++;
    if (this.attackCooldown > 0) this.attackCooldown--;
  }

  // Get sensory inputs for neural network
  getSensorInputs(
    nearbyAnts: { x: number; y: number; caste: string; colonyId: number }[],
    nearbyFood: { x: number; y: number }[],
    nestX: number, nestY: number,
    pheromones: { home: number; food: number; danger: number; attack: number },
    queenAggression: number = 0.5,
    queenDefense: number = 0.5,
    queenExploration: number = 0.5
  ): number[] {
    const nearbyEnemies = nearbyAnts.filter(a => a.colonyId !== this.colonyId).length;
    const foodIntensity = nearbyFood.length > 0 ? Math.min(1, nearbyFood.length / 5) : 0;
    const nestDist = Math.hypot(nestX - this.x, nestY - this.y);

    // 12 inputs per spec:
    // 1. nearby food, 2. nearby enemy count, 3. home pheromone,
    // 4. food pheromone, 5. danger pheromone, 6. attack pheromone,
    // 7. health, 8. energy, 9. distance to nest,
    // 10. queen aggression, 11. queen defense, 12. queen exploration
    return [
      foodIntensity,                             // 1. nearby food count/intensity
      nearbyEnemies / 10,                        // 2. nearby enemy ant count
      pheromones.home / 255,                     // 3. home pheromone level
      pheromones.food / 255,                     // 4. food pheromone level
      pheromones.danger / 255,                   // 5. danger pheromone level
      pheromones.attack / 255,                   // 6. attack pheromone level
      this.health / 100,                         // 7. ant health
      this.energy / 100,                         // 8. ant energy
      Math.min(1, nestDist / 500),               // 9. distance to nest
      queenAggression,                           // 10. queen aggression signal
      queenDefense,                              // 11. queen defense signal
      queenExploration                           // 12. queen exploration signal
    ];
  }

  decideAction(output: number[], colonyAggression: number, colonyDefense: number, weatherMultiplier: number = 1.0): { moveX: number; moveY: number; shouldAttack: boolean } {
    const moveForce = output[0];
    const turnForce = output[1];
    const aggressiveBoost = output[2] * colonyAggression;
    const defensiveMode = output[3] * colonyDefense;

    // Apply NN output to movement
    this.angle += turnForce * 0.5;
    
    // Caste-specific speed modifiers
    let speed = 2 + moveForce * 0.5;
    if (this.caste === 'scout') {
      speed *= 1.5;
    } else if (this.caste === 'soldier') {
      speed *= 0.9;
    }
    
    // Small random walk component to help exploration
    this.angle += (Math.random() - 0.5) * 0.2;
    
    // Energy affects speed: ants slow down as energy depletes
    speed *= 0.5 + 0.5 * (this.energy / 100);
    
    // Apply weather efficiency
    speed *= weatherMultiplier;
    
    const moveX = Math.cos(this.angle) * speed;
    const moveY = Math.sin(this.angle) * speed;

    // Only soldiers should attack
    const shouldAttack = this.caste === 'soldier' && aggressiveBoost > 0.5 && this.canAttack();

    return { moveX, moveY, shouldAttack };
  }

  takeDamage(damage: number) {
    this.health -= damage;
  }

  canAttack(): boolean {
    return this.attackCooldown <= 0 && this.caste === 'soldier';
  }

  attack() {
    if (this.canAttack()) {
      this.attackCooldown = 10;
    }
  }

  mutate(rate: number, strength: number) {
    this.brain.mutate(rate, strength);
  }

  clone(): Ant {
    const cloned = new Ant(this.x, this.y, this.angle, this.caste, this.colonyId);
    cloned.brain = this.brain.clone();
    return cloned;
  }
}
