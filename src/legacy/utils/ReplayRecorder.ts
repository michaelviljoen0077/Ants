import { Colony } from '../entities/Colony';

export interface SimulationFrame {
  tick: number;
  generation: number;
  weather: string;
  colonies: Array<{
    id: number;
    nestX: number;
    nestY: number;
    food: number;
    antCount: number;
    antPositions: Array<{ x: number; y: number; caste: string }>;
    fitness: number;
  }>;
  foodNodes: Array<{ x: number; y: number; amount: number }>;
}

export class ReplayRecorder {
  private frames: SimulationFrame[] = [];
  private recording: boolean = false;
  readonly maxFrames: number = 10000; // Store up to ~3 minutes at 60fps

  startRecording(): void {
    this.frames = [];
    this.recording = true;
  }

  stopRecording(): void {
    this.recording = false;
  }

  recordFrame(
    tick: number,
    generation: number,
    weather: string,
    colonies: Colony[],
    foodNodes: Array<{ x: number; y: number; amount: number }>
  ): void {
    if (!this.recording) return;

    // Limit frame storage to prevent memory issues
    if (this.frames.length >= this.maxFrames) {
      this.frames.shift(); // Remove oldest frame
    }

    const frame: SimulationFrame = {
      tick,
      generation,
      weather,
      colonies: colonies.map((c) => ({
        id: c.id,
        nestX: c.nestX,
        nestY: c.nestY,
        food: c.food,
        antCount: c.ants.length,
        antPositions: c.ants.map((a) => ({
          x: a.x,
          y: a.y,
          caste: a.caste,
        })),
        fitness: c.fitness,
      })),
      foodNodes: foodNodes.map((f) => ({
        x: f.x,
        y: f.y,
        amount: f.amount,
      })),
    };

    this.frames.push(frame);
  }

  getFrames(): SimulationFrame[] {
    return this.frames;
  }

  getFrame(index: number): SimulationFrame | null {
    if (index < 0 || index >= this.frames.length) return null;
    return this.frames[index];
  }

  getFrameCount(): number {
    return this.frames.length;
  }

  exportJSON(): string {
    return JSON.stringify(this.frames);
  }

  importJSON(json: string): boolean {
    try {
      this.frames = JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }

  clearRecording(): void {
    this.frames = [];
  }

  downloadRecording(filename: string = 'antwar-replay.json'): void {
    const json = this.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
