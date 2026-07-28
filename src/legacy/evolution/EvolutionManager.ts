import { Colony } from '../entities/Colony';
import { World } from '../world/World';
import { Ant } from '../entities/Ant';
import { NeuralNetwork } from '../ai/NeuralNetwork';

export class EvolutionManager {
  mutationRate: number;
  mutationStrength: number;
  enableCrossover: boolean;

  constructor(
    mutationRate: number = 0.1,
    mutationStrength: number = 0.2,
    enableCrossover: boolean = false
  ) {
    this.mutationRate = mutationRate;
    this.mutationStrength = mutationStrength;
    this.enableCrossover = enableCrossover;
  }

  selectFittest(colonies: Colony[]): Colony[] {
    return colonies
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, Math.max(1, Math.floor(colonies.length * 0.5)));
  }

  reproduceNextGeneration(fittest: Colony[], world: World): Colony[] {
    const nextGen: Colony[] = [];
    const targetPopulation = fittest.length; // Maintain original colony count

    while (nextGen.length < targetPopulation) {
      let child: Colony;

      if (this.enableCrossover && fittest.length >= 2 && Math.random() < 0.5) {
        // Crossover breeding: mix two parents' neural networks
        const parent1Idx = Math.floor(Math.random() * fittest.length);
        const parent2Idx = Math.floor(Math.random() * fittest.length);
        const parent1 = fittest[parent1Idx];
        const parent2 = fittest[parent2Idx];
        
        // Create child from parent1
        child = parent1.clone(world);
        
        // Blend neural networks from both parents (50/50 crossover)
        child.ants.forEach((ant, idx) => {
          if (idx < parent2.ants.length) {
            const p2Ant = parent2.ants[idx];
            // Blend worker brain traits
            this.crossoverBrains(ant.brain, p2Ant.brain);
          }
        });
        
        // Also blend queen DNA
        this.crossoverBrains(child.queen.brain, parent2.queen.brain);
      } else {
        // Mutation-only breeding
        const parentIdx = Math.floor(Math.random() * fittest.length);
        const parent = fittest[parentIdx];
        child = parent.clone(world);
      }

      // Spawn additional ants based on food reserves (more food = more workers)
      const foodAvailable = child.food;
      const antSpawnCost = 5;
      const numNewAnts = Math.floor(Math.min(20, foodAvailable / antSpawnCost)); // Cap new spawns at 20
      
      if (numNewAnts > 0) {
        child.food -= numNewAnts * antSpawnCost;
        
        // Spawn mostly workers (70%), some scouts (30%)
        const numWorkers = Math.floor(numNewAnts * 0.7);
        const numScouts = numNewAnts - numWorkers;
        
        for (let i = 0; i < numWorkers; i++) {
          child.ants.push(
            new Ant(
              child.nestX + Math.random() * 40 - 20,
              child.nestY + Math.random() * 40 - 20,
              Math.random() * Math.PI * 2,
              'worker',
              child.id
            )
          );
        }
        
        for (let i = 0; i < numScouts; i++) {
          child.ants.push(
            new Ant(
              child.nestX + Math.random() * 40 - 20,
              child.nestY + Math.random() * 40 - 20,
              Math.random() * Math.PI * 2,
              'scout',
              child.id
            )
          );
        }
      }
      
      child.mutate(this.mutationRate, this.mutationStrength);
      child.reset();
      nextGen.push(child);
    }
    return nextGen;
  }

  private crossoverBrains(child: NeuralNetwork, parent2: NeuralNetwork): void {
    // Blend weights from parent2 into child (50/50 mix)
    for (let layerIdx = 0; layerIdx < child.weights.length; layerIdx++) {
      for (let i = 0; i < child.weights[layerIdx].length; i++) {
        for (let j = 0; j < child.weights[layerIdx][i].length; j++) {
          if (Math.random() < 0.5) {
            // Inherit weight from parent2
            child.weights[layerIdx][i][j] = parent2.weights[layerIdx][i][j];
          }
        }
      }
      
      // Blend biases
      for (let i = 0; i < child.biases[layerIdx].length; i++) {
        if (Math.random() < 0.5) {
          child.biases[layerIdx][i] = parent2.biases[layerIdx][i];
        }
      }
    }
  }
}
