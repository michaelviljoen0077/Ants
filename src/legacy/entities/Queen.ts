import { NeuralNetwork } from '../ai/NeuralNetwork';

export class Queen {
  colonyId: number;
  x: number;
  y: number;
  health: number;
  brain: NeuralNetwork;
  aggression: number;
  defense: number;
  exploration: number;

  constructor(colonyId: number, x: number, y: number) {
    this.colonyId = colonyId;
    this.x = x;
    this.y = y;
    this.health = 100;
    // Queen NN: 10 inputs -> [16, 8] hidden layers -> 5 outputs
    this.brain = new NeuralNetwork(10, [16, 8], 5);
    this.aggression = 0.5;
    this.defense = 0.5;
    this.exploration = 0.5;
  }

  update(
    colonyFood: number,
    antCount: number,
    enemyPresence: number,
    workerCount: number = 0,
    soldierCount: number = 0,
    workerDeathRate: number = 0,
    soldierDeathRate: number = 0,
    foodIncomeRate: number = 0,
    generationProgress: number = 0
  ) {
    // Queen 10 inputs per spec:
    // 1. food reserves, 2. worker count, 3. soldier count,
    // 4. worker death rate, 5. soldier death rate, 6. food income rate,
    // 7. nearby enemy presence, 8. queen health, 9. generation progress, 10. enemy activity
    const inputs = [
      colonyFood / 500,
      workerCount / 50,
      soldierCount / 20,
      workerDeathRate,
      soldierDeathRate,
      foodIncomeRate,
      enemyPresence,
      this.health / 100,
      generationProgress,
      enemyPresence * 0.5
    ];
    const output = this.brain.forward(inputs);
    this.aggression = Math.max(0, Math.min(1, (output[0] + 1) / 2));
    this.defense = Math.max(0, Math.min(1, (output[1] + 1) / 2));
    this.exploration = Math.max(0, Math.min(1, (output[2] + 1) / 2));
  }

  mutate(rate: number, strength: number) {
    this.brain.mutate(rate, strength);
  }

  clone(): Queen {
    const cloned = new Queen(this.colonyId, this.x, this.y);
    cloned.brain = this.brain.clone();
    return cloned;
  }
}
