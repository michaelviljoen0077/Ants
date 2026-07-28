import { NeuralNetwork } from '../ai/NeuralNetwork';

export class Genome {
  workerBrain: NeuralNetwork;
  soldierBrain: NeuralNetwork;
  queenBrain: NeuralNetwork;

  constructor(
    workerBrain: NeuralNetwork,
    soldierBrain: NeuralNetwork,
    queenBrain: NeuralNetwork
  ) {
    this.workerBrain = workerBrain;
    this.soldierBrain = soldierBrain;
    this.queenBrain = queenBrain;
  }

  static random(): Genome {
    return new Genome(
      new NeuralNetwork(12, 8, 4),
      new NeuralNetwork(12, 8, 4),
      new NeuralNetwork(10, 8, 5)
    );
  }

  mutate(rate: number, strength: number) {
    this.workerBrain.mutate(rate, strength);
    this.soldierBrain.mutate(rate, strength);
    this.queenBrain.mutate(rate, strength);
  }

  clone(): Genome {
    return new Genome(
      this.workerBrain.clone(),
      this.soldierBrain.clone(),
      this.queenBrain.clone()
    );
  }
}
