export class HeatmapTracker {
  private grid: number[][];
  cellSize: number;
  width: number;
  height: number;

  constructor(width: number, height: number, cellSize: number = 20) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    this.grid = Array(rows)
      .fill(0)
      .map(() => Array(cols).fill(0));
  }

  recordPosition(x: number, y: number): void {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);

    if (
      row >= 0 && 
      row < this.grid.length && 
      col >= 0 && 
      col < this.grid[0].length
    ) {
      this.grid[row][col]++;
    }
  }

  getHeatValue(x: number, y: number): number {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);

    if (
      row < 0 || 
      row >= this.grid.length || 
      col < 0 || 
      col >= this.grid[0].length
    ) {
      return 0;
    }

    return this.grid[row][col];
  }

  getMaxHeat(): number {
    let max = 0;
    for (const row of this.grid) {
      for (const cell of row) {
        max = Math.max(max, cell);
      }
    }
    return max;
  }

  decay(factor: number = 0.99): void {
    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        this.grid[i][j] *= factor;
      }
    }
  }

  clear(): void {
    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        this.grid[i][j] = 0;
      }
    }
  }
}
