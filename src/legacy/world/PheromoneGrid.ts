export type PheromoneType = 'home' | 'food' | 'danger' | 'attack';

export class PheromoneGrid {
  width: number;
  height: number;
  gridSize: number;
  colonyId: number;
  pheromoneLayers: Map<PheromoneType, Float32Array>;
  
  constructor(width: number, height: number, gridSize: number, colonyId: number) {
    this.width = Math.ceil(width / gridSize);
    this.height = Math.ceil(height / gridSize);
    this.gridSize = gridSize;
    this.colonyId = colonyId;
    this.pheromoneLayers = new Map([
      ['home', new Float32Array(this.width * this.height)],
      ['food', new Float32Array(this.width * this.height)],
      ['danger', new Float32Array(this.width * this.height)],
      ['attack', new Float32Array(this.width * this.height)]
    ]);
  }

  private getIndex(x: number, y: number): number {
    const gx = Math.floor(x / this.gridSize);
    const gy = Math.floor(y / this.gridSize);
    return Math.max(0, Math.min(this.width - 1, gx)) + Math.max(0, Math.min(this.height - 1, gy)) * this.width;
  }

  deposit(type: PheromoneType, x: number, y: number, amount: number) {
    const idx = this.getIndex(x, y);
    const layer = this.pheromoneLayers.get(type);
    if (layer) {
      layer[idx] = Math.min(255, layer[idx] + amount);
    }
  }

  sense(type: PheromoneType, x: number, y: number): number {
    const idx = this.getIndex(x, y);
    const layer = this.pheromoneLayers.get(type);
    return layer ? layer[idx] : 0;
  }

  update(decayRate: number) {
    this.pheromoneLayers.forEach((layer) => {
      for (let i = 0; i < layer.length; ++i) {
        layer[i] *= (1 - decayRate);
      }
    });
  }
}
