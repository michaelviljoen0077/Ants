import { Simulation } from '../engine/Simulation';

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(sim: Simulation) {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    // Draw food
    sim.world.foodNodes.forEach(food => {
      this.ctx.beginPath();
      this.ctx.arc(food.x, food.y, 6, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffe066';
      this.ctx.fill();
    });

    // Draw colonies and ants
    const COLONY_COLORS = ['#ff4444', '#4488ff'];
    sim.colonies.forEach((colony, idx) => {
      // Draw nest
      this.ctx.beginPath();
      this.ctx.arc(colony.nestX, colony.nestY, 18, 0, Math.PI * 2);
      this.ctx.fillStyle = COLONY_COLORS[idx];
      this.ctx.globalAlpha = 0.2;
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;

      // Draw ants
      colony.ants.forEach(ant => {
        this.ctx.beginPath();
        this.ctx.arc(ant.x, ant.y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = ant.carryingFood ? '#fff' : COLONY_COLORS[idx];
        this.ctx.fill();
      });
    });

    // Draw UI text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '14px monospace';
    this.ctx.fillText(`Gen: ${sim.statsTracker.generationNumber} | Tick: ${sim.tick}`, 10, 20);
    sim.colonies.forEach((colony, idx) => {
      this.ctx.fillText(
        `Colony ${idx + 1}: Ants=${colony.ants.length} Food=${colony.food.toFixed(0)} Fitness=${colony.fitness.toFixed(0)}`,
        10,
        40 + idx * 20
      );
    });
  }
}
