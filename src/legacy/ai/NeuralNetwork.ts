export class NeuralNetwork {
  inputSize: number;
  outputSize: number;
  hiddenLayers: number[]; // Array of hidden layer sizes
  weights: number[][][]; // weights[i] = weights between layer i and i+1
  biases: number[][]; // biases[i] = biases for layer i+1

  constructor(inputSize: number, hiddenSize: number | number[], outputSize: number) {
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    
    // Support both single hidden layer (number) and multiple layers (array)
    if (typeof hiddenSize === 'number') {
      this.hiddenLayers = [hiddenSize];
    } else {
      this.hiddenLayers = hiddenSize;
    }

    this.weights = [];
    this.biases = [];

    // Build weight and bias matrices for all layer transitions
    const layerSizes = [inputSize, ...this.hiddenLayers, outputSize];
    for (let i = 0; i < layerSizes.length - 1; ++i) {
      this.weights.push(this.randomMatrix(layerSizes[i], layerSizes[i + 1]));
      this.biases.push(Array(layerSizes[i + 1]).fill(0).map(() => Math.random() - 0.5));
    }
  }

  private randomMatrix(rows: number, cols: number): number[][] {
    return Array(rows).fill(0).map(() =>
      Array(cols).fill(0).map(() => Math.random() - 0.5)
    );
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }

  private tanh(x: number): number {
    return Math.tanh(x);
  }

  forward(input: number[]): number[] {
    let current = input;

    // Forward pass through all layers
    for (let layerIdx = 0; layerIdx < this.weights.length; ++layerIdx) {
      const next = Array(this.weights[layerIdx][0].length).fill(0);
      
      // Is this the output layer?
      const isOutputLayer = layerIdx === this.weights.length - 1;

      for (let i = 0; i < next.length; ++i) {
        let sum = this.biases[layerIdx][i];
        for (let j = 0; j < current.length; ++j) {
          sum += current[j] * this.weights[layerIdx][j][i];
        }
        // Use tanh for output layer, relu for hidden layers
        next[i] = isOutputLayer ? this.tanh(sum) : this.relu(sum);
      }
      current = next;
    }

    return current;
  }

  mutate(rate: number, strength: number): NeuralNetwork {
    const cloned = this.clone();
    for (let layerIdx = 0; layerIdx < cloned.weights.length; ++layerIdx) {
      // Mutate weights
      for (let i = 0; i < cloned.weights[layerIdx].length; ++i) {
        for (let j = 0; j < cloned.weights[layerIdx][i].length; ++j) {
          if (Math.random() < rate) {
            cloned.weights[layerIdx][i][j] += (Math.random() - 0.5) * 2 * strength;
          }
        }
      }
      // Mutate biases
      for (let i = 0; i < cloned.biases[layerIdx].length; ++i) {
        if (Math.random() < rate) {
          cloned.biases[layerIdx][i] += (Math.random() - 0.5) * 2 * strength;
        }
      }
    }
    return cloned;
  }

  clone(): NeuralNetwork {
    const cloned = new NeuralNetwork(this.inputSize, [...this.hiddenLayers], this.outputSize);
    cloned.weights = this.weights.map(layer => layer.map(row => [...row]));
    cloned.biases = this.biases.map(layer => [...layer]);
    return cloned;
  }
}
