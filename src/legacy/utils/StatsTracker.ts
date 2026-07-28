export class StatsTracker {
  generationNumber: number;
  colonyFitnessHistory: Map<number, number[]>;
  colonyPopulationHistory: Map<number, number[]>;
  colonyFoodHistory: Map<number, number[]>;

  constructor() {
    this.generationNumber = 0;
    this.colonyFitnessHistory = new Map();
    this.colonyPopulationHistory = new Map();
    this.colonyFoodHistory = new Map();
  }

  recordGenerationStats(colonies: any[]) {
    colonies.forEach(colony => {
      if (!this.colonyFitnessHistory.has(colony.id)) {
        this.colonyFitnessHistory.set(colony.id, []);
        this.colonyPopulationHistory.set(colony.id, []);
        this.colonyFoodHistory.set(colony.id, []);
      }
      this.colonyFitnessHistory.get(colony.id)!.push(colony.fitness);
      this.colonyPopulationHistory.get(colony.id)!.push(colony.ants.length);
      this.colonyFoodHistory.get(colony.id)!.push(colony.food);
    });
    this.generationNumber++;
  }

  getAveragePopulation(colonyId: number): number {
    const history = this.colonyPopulationHistory.get(colonyId);
    if (!history || history.length === 0) return 0;
    return history.reduce((a, b) => a + b, 0) / history.length;
  }
}
