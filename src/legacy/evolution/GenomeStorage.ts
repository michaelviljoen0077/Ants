import { NeuralNetwork } from '../ai/NeuralNetwork';

export interface SerializedGenome {
  workerId: string;
  solderId: string;
  scoutId: string;
  queenId: string;
  fitness: number;
  generation: number;
  timestamp: number;
}

export class GenomeStorage {
  private static readonly storageKey = 'antWarsGenomes';
  private static readonly maxStoredGenomes = 10;

  static saveGenome(
    workerBrain: NeuralNetwork,
    soldierBrain: NeuralNetwork,
    scoutBrain: NeuralNetwork,
    queenBrain: NeuralNetwork,
    fitness: number,
    generation: number
  ): void {
    const genome: SerializedGenome = {
      workerId: this.serializeNeuralNetwork(workerBrain),
      solderId: this.serializeNeuralNetwork(soldierBrain),
      scoutId: this.serializeNeuralNetwork(scoutBrain),
      queenId: this.serializeNeuralNetwork(queenBrain),
      fitness,
      generation,
      timestamp: Date.now(),
    };

    const stored = this.loadAll();
    stored.push(genome);
    // Keep only top performers
    stored.sort((a, b) => b.fitness - a.fitness);
    stored.splice(this.maxStoredGenomes);

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.storageKey, JSON.stringify(stored));
    }
  }

  static loadBestGenome(): SerializedGenome | null {
    const stored = this.loadAll();
    return stored.length > 0 ? stored[0] : null;
  }

  static loadAll(): SerializedGenome[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static clearAll(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.storageKey);
    }
  }

  private static serializeNeuralNetwork(nn: NeuralNetwork): string {
    // For now, use a simple serialization
    // In production, you'd want to serialize weights properly
    return JSON.stringify({
      weights: (nn as any).weights,
      biases: (nn as any).biases,
    });
  }

  static deserializeNeuralNetwork(serialized: string): NeuralNetwork {
    const data = JSON.parse(serialized);
    const nn = new NeuralNetwork(12, 8, 4);
    (nn as any).weights = data.weights;
    (nn as any).biases = data.biases;
    return nn;
  }
}
