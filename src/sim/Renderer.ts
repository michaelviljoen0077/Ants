import { Simulation } from './Simulation';
import { CONFIG } from './config';

export interface Camera {
  x: number; // world point at screen centre
  y: number;
  zoom: number;
}

export interface RenderOptions {
  showTrails: boolean;
  showAlarm: boolean;
}

/**
 * Layered canvas renderer:
 *   baked soil + rocks → night tint → additive pheromone glow →
 *   food / nests / ants → selection overlay → screen-space rain + vignette.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private soil: HTMLCanvasElement;
  private pherCanvas: HTMLCanvasElement;
  private pherCtx: CanvasRenderingContext2D;
  private pherImg: ImageData;

  constructor(private canvas: HTMLCanvasElement, private sim: Simulation) {
    this.ctx = canvas.getContext('2d')!;
    this.soil = this.bakeSoil();
    const cols = Math.ceil(sim.world.w / CONFIG.cell);
    const rows = Math.ceil(sim.world.h / CONFIG.cell);
    this.pherCanvas = document.createElement('canvas');
    this.pherCanvas.width = cols;
    this.pherCanvas.height = rows;
    this.pherCtx = this.pherCanvas.getContext('2d')!;
    this.pherImg = this.pherCtx.createImageData(cols, rows);
  }

  /** Soil texture + rocks never change, so they render once to an offscreen canvas. */
  private bakeSoil(): HTMLCanvasElement {
    const { w, h } = this.sim.world;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#171310';
    g.fillRect(0, 0, w, h);

    // Mottled dirt patches.
    for (let i = 0; i < 240; i++) {
      const r = 30 + Math.random() * 120;
      g.fillStyle = `rgba(${30 + Math.random() * 30 | 0}, ${24 + Math.random() * 20 | 0}, ${16 + Math.random() * 14 | 0}, 0.12)`;
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
      g.fill();
    }
    // Fine grain speckles.
    for (let i = 0; i < 5200; i++) {
      const v = 24 + Math.random() * 36 | 0;
      g.fillStyle = `rgba(${v + 8}, ${v}, ${v - 8}, ${0.1 + Math.random() * 0.25})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }

    // Rocks with a simple lit-from-top-left look.
    for (const rock of this.sim.world.rocks) {
      const grad = g.createRadialGradient(
        rock.x - rock.r * 0.35, rock.y - rock.r * 0.35, rock.r * 0.15,
        rock.x, rock.y, rock.r,
      );
      grad.addColorStop(0, '#5a564f');
      grad.addColorStop(0.7, '#3a3733');
      grad.addColorStop(1, '#23211e');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(rock.x, rock.y, rock.r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 2;
      g.stroke();
    }
    return c;
  }

  private updatePheromoneImage(opts: RenderOptions): void {
    const d = this.pherImg.data;
    for (let p = 0; p < d.length; p += 4) {
      d[p] = 0; d[p + 1] = 0; d[p + 2] = 0; d[p + 3] = 255;
    }
    if (!opts.showTrails && !opts.showAlarm) return;

    for (const colony of this.sim.colonies) {
      const trail = colony.theme.trail;
      const home = colony.theme.home;
      const food = colony.food.data;
      const homeF = colony.home.data;
      const alarm = colony.alarm.data;
      for (let c = 0, p = 0; c < food.length; c++, p += 4) {
        if (opts.showTrails) {
          const f = food[c];
          if (f > 0.02) {
            const v = Math.min(1, f * 0.7);
            d[p] += trail[0] * v * 0.85;
            d[p + 1] += trail[1] * v * 0.85;
            d[p + 2] += trail[2] * v * 0.85;
          }
          const hm = homeF[c];
          if (hm > 0.05) {
            const v = Math.min(1, hm * 0.4) * 0.3;
            d[p] += home[0] * v;
            d[p + 1] += home[1] * v;
            d[p + 2] += home[2] * v;
          }
        }
        if (opts.showAlarm) {
          const a = alarm[c];
          if (a > 0.03) {
            const v = Math.min(1, a * 1.4);
            d[p] += 255 * v * 0.8;
            d[p + 1] += 30 * v;
            d[p + 2] += 30 * v;
          }
        }
      }
    }
    this.pherCtx.putImageData(this.pherImg, 0, 0);
  }

  draw(cam: Camera, opts: RenderOptions, screenW: number, screenH: number, dpr: number): void {
    const ctx = this.ctx;
    const sim = this.sim;
    const { w, h } = sim.world;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#080705';
    ctx.fillRect(0, 0, screenW, screenH);

    // World transform: camera centre → screen centre.
    const z = cam.zoom;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (screenW / 2 - cam.x * z), dpr * (screenH / 2 - cam.y * z));

    ctx.drawImage(this.soil, 0, 0);

    // Night falls: darken the world, trails will glow on top of it.
    const dark = (1 - sim.daylight) * 0.52;
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(8, 12, 38, ${dark})`;
      ctx.fillRect(0, 0, w, h);
    }

    this.updatePheromoneImage(opts);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.pherCanvas, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    this.drawFood(ctx);
    this.drawNests(ctx);
    this.drawAnts(ctx, z);
    this.drawSelection(ctx, z);

    // Back to screen space for atmosphere.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawRain(ctx, screenW, screenH);
    const vin = ctx.createRadialGradient(
      screenW / 2, screenH / 2, Math.min(screenW, screenH) * 0.45,
      screenW / 2, screenH / 2, Math.max(screenW, screenH) * 0.75,
    );
    vin.addColorStop(0, 'rgba(0,0,0,0)');
    vin.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vin;
    ctx.fillRect(0, 0, screenW, screenH);
  }

  private drawFood(ctx: CanvasRenderingContext2D): void {
    for (const f of this.sim.world.food) {
      const radius = 4 + Math.sqrt(f.max) * 0.8;
      const n = Math.max(1, Math.min(14, Math.ceil(f.amount / 14)));
      for (let k = 0; k < n; k++) {
        // Stable pseudo-random berry placement from the source's seed.
        const u = Math.abs(Math.sin(f.seed + k * 12.9898) * 43758.5453) % 1;
        const v = Math.abs(Math.sin(f.seed * 1.7 + k * 78.233) * 12543.21) % 1;
        const ang = u * Math.PI * 2;
        const rr = v * radius;
        const bx = f.x + Math.cos(ang) * rr;
        const by = f.y + Math.sin(ang) * rr;
        ctx.beginPath();
        ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = '#8fd14f';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx - 0.7, by - 0.7, 1, 0, Math.PI * 2);
        ctx.fillStyle = '#c9f29b';
        ctx.fill();
      }
    }
  }

  private drawNests(ctx: CanvasRenderingContext2D): void {
    const t = this.sim.tick;
    for (const colony of this.sim.colonies) {
      const { nestX: x, nestY: y } = colony;
      const mound = ctx.createRadialGradient(x, y, 4, x, y, 42);
      mound.addColorStop(0, '#3d3226');
      mound.addColorStop(0.6, '#2c2419');
      mound.addColorStop(1, 'rgba(30,24,16,0)');
      ctx.fillStyle = mound;
      ctx.beginPath();
      ctx.arc(x, y, 42, 0, Math.PI * 2);
      ctx.fill();

      // Entrance hole.
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0805';
      ctx.fill();

      // Breathing colony ring.
      const pulse = 16 + Math.sin(t * 0.04 + colony.id * 2) * 1.6;
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = colony.theme.core;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85;
      ctx.stroke();

      // Food-store arc around the ring.
      const frac = Math.min(1, colony.foodStore / 600);
      if (frac > 0.01) {
        ctx.beginPath();
        ctx.arc(x, y, pulse + 5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.strokeStyle = colony.theme.soft;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawAnts(ctx: CanvasRenderingContext2D, zoom: number): void {
    const detailed = zoom >= 0.9;
    for (const colony of this.sim.colonies) {
      // Batch one path per colony: way fewer style switches than per-ant drawing.
      if (!detailed) {
        ctx.beginPath();
        for (const ant of colony.ants) {
          const len = ant.caste === 'soldier' ? 6.5 : 5;
          ctx.moveTo(ant.x - Math.cos(ant.angle) * len * 0.5, ant.y - Math.sin(ant.angle) * len * 0.5);
          ctx.lineTo(ant.x + Math.cos(ant.angle) * len * 0.5, ant.y + Math.sin(ant.angle) * len * 0.5);
        }
        ctx.strokeStyle = colony.theme.core;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (const ant of colony.ants) {
          const s = ant.caste === 'soldier' ? 1.35 : ant.caste === 'scout' ? 0.85 : 1;
          const ca = Math.cos(ant.angle);
          const sa = Math.sin(ant.angle);
          // Abdomen – thorax – head, strung along the heading.
          ctx.moveTo(ant.x - ca * 2.4 * s + 1.9 * s, ant.y - sa * 2.4 * s);
          ctx.arc(ant.x - ca * 2.4 * s, ant.y - sa * 2.4 * s, 1.9 * s, 0, Math.PI * 2);
          ctx.moveTo(ant.x + 1.3 * s, ant.y);
          ctx.arc(ant.x, ant.y, 1.3 * s, 0, Math.PI * 2);
          ctx.moveTo(ant.x + ca * 2.1 * s + 1.1 * s, ant.y + sa * 2.1 * s);
          ctx.arc(ant.x + ca * 2.1 * s, ant.y + sa * 2.1 * s, 1.1 * s, 0, Math.PI * 2);
        }
        ctx.fillStyle = colony.theme.core;
        ctx.fill();

        // Scouts get a soft accent dot so they read differently at a glance.
        ctx.beginPath();
        for (const ant of colony.ants) {
          if (ant.caste !== 'scout') continue;
          ctx.moveTo(ant.x + 0.9, ant.y);
          ctx.arc(ant.x, ant.y, 0.9, 0, Math.PI * 2);
        }
        ctx.fillStyle = colony.theme.soft;
        ctx.fill();
      }

      // Carried food: bright dot riding at the head.
      ctx.beginPath();
      for (const ant of colony.ants) {
        if (ant.carry <= 0) continue;
        const hx = ant.x + Math.cos(ant.angle) * 3.4;
        const hy = ant.y + Math.sin(ant.angle) * 3.4;
        ctx.moveTo(hx + 1.7, hy);
        ctx.arc(hx, hy, 1.7, 0, Math.PI * 2);
      }
      ctx.fillStyle = '#b6e86a';
      ctx.fill();
    }
  }

  private drawSelection(ctx: CanvasRenderingContext2D, zoom: number): void {
    const ant = this.sim.selected;
    if (!ant) return;
    ctx.beginPath();
    ctx.arc(ant.x, ant.y, 10, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4 / zoom;
    ctx.stroke();

    // Whisker sample points: shows what the ant is actually smelling.
    const d = CONFIG.whiskerDist;
    const wa = CONFIG.whiskerAngle;
    for (const off of [-wa, 0, wa]) {
      const px = ant.x + Math.cos(ant.angle + off) * d;
      const py = ant.y + Math.sin(ant.angle + off) * d;
      ctx.beginPath();
      ctx.moveTo(ant.x, ant.y);
      ctx.lineTo(px, py);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.8 / zoom;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  private drawRain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const rain = this.sim.rain;
    if (rain < 0.05) return;
    ctx.strokeStyle = `rgba(140, 170, 255, ${0.12 + rain * 0.2})`;
    ctx.lineWidth = 1;
    const drops = (rain * 130) | 0;
    ctx.beginPath();
    for (let i = 0; i < drops; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 11);
    }
    ctx.stroke();
  }
}
