import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Simulation } from './sim/Simulation';
import { Renderer, Camera } from './sim/Renderer';
import { CONFIG } from './sim/config';
import BrainViz from './ui/BrainViz';
import Sparkline from './ui/Sparkline';
import './ui/ui.css';

interface ColonySnap {
  name: string;
  core: string;
  soft: string;
  workers: number;
  soldiers: number;
  scouts: number;
  food: number;
  kills: number;
  deliveries: number;
  income: number;
  popHist: number[];
  foodHist: number[];
}

interface SelectedSnap {
  caste: string;
  colonyName: string;
  colonyColor: string;
  agePct: number;
  energy: number;
  healthPct: number;
  carry: number;
  fitness: number;
  deliveries: number;
  kills: number;
  generation: number;
}

interface HudSnap {
  tick: number;
  generation: number;
  daylight: number;
  rain: number;
  fps: number;
  pop: number;
  colonies: ColonySnap[];
  selected: SelectedSnap | null;
}

function phaseLabel(daylight: number, rain: number): string {
  const sky = daylight > 0.75 ? 'day' : daylight > 0.25 ? 'dusk' : 'night';
  const icon = rain > 0.25 ? 'rain' : sky === 'day' ? 'clear' : sky === 'night' ? 'moon' : 'haze';
  return `${sky} / ${icon}`;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation | null>(null);
  if (!simRef.current) simRef.current = new Simulation();

  const camRef = useRef<Camera>({ x: CONFIG.worldW / 2, y: CONFIG.worldH / 2, zoom: 0.6 });
  const fpsRef = useRef({ frames: 0, fps: 60 });

  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTrails, setShowTrails] = useState(true);
  const [showAlarm, setShowAlarm] = useState(true);
  const [follow, setFollow] = useState(false);
  const [hud, setHud] = useState<HudSnap | null>(null);
  // Stable identity so BrainViz doesn't restart its render loop on every HUD tick.
  const getSelectedAnt = useCallback(() => simRef.current?.selected ?? null, []);

  // Refs mirror the control state so the rAF loop reads fresh values without re-binding.
  const ctl = useRef({ paused, speed, showTrails, showAlarm, follow });
  ctl.current = { paused, speed, showTrails, showAlarm, follow };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const sim = simRef.current!;
    const renderer = new Renderer(canvas, sim);

    // Dev nicety: ?ff=3000 warps the sim forward. It runs in chunks across
    // frames so the page stays responsive and the HUD shows progress.
    const ffParam = parseInt(new URLSearchParams(window.location.search).get('ff') || '0', 10);
    let ffRemaining = Number.isFinite(ffParam) ? Math.min(Math.max(ffParam, 0), 50000) : 0;
    let raf = 0;
    let alive = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const fitZoom = () =>
      Math.min(canvas.clientWidth / CONFIG.worldW, canvas.clientHeight / CONFIG.worldH) * 0.96;

    // Initial camera: fit the whole world on screen.
    camRef.current.zoom = fitZoom();

    const loop = () => {
      if (!alive) return;
      const c = ctl.current;
      if (ffRemaining > 0) {
        const chunk = Math.min(ffRemaining, 150);
        for (let i = 0; i < chunk; i++) sim.update();
        ffRemaining -= chunk;
      } else if (!c.paused) {
        for (let i = 0; i < c.speed; i++) sim.update();
      }
      if (c.follow && sim.selected) {
        camRef.current.x = sim.selected.x;
        camRef.current.y = sim.selected.y;
      }
      const dpr = window.devicePixelRatio || 1;
      renderer.draw(
        camRef.current,
        { showTrails: c.showTrails, showAlarm: c.showAlarm },
        canvas.clientWidth, canvas.clientHeight, dpr,
      );
      fpsRef.current.frames++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const hudTimer = window.setInterval(() => {
      const s = sim.selected;
      const sel: SelectedSnap | null = s
        ? {
            caste: s.caste,
            colonyName: sim.colonies[s.colonyId].theme.name,
            colonyColor: sim.colonies[s.colonyId].theme.core,
            agePct: s.age / s.maxAge,
            energy: s.energy,
            healthPct: s.health / s.maxHealth,
            carry: s.carry,
            fitness: s.fitness,
            deliveries: s.deliveries,
            kills: s.kills,
            generation: s.generation,
          }
        : null;
      setHud({
        tick: sim.tick,
        generation: sim.generation,
        daylight: sim.daylight,
        rain: sim.rain,
        fps: fpsRef.current.fps,
        pop: sim.colonies.reduce((n, col) => n + col.ants.length, 0),
        colonies: sim.colonies.map((col) => ({
          name: col.theme.name,
          core: col.theme.core,
          soft: col.theme.soft,
          workers: col.castCount('worker'),
          soldiers: col.castCount('soldier'),
          scouts: col.castCount('scout'),
          food: col.foodStore,
          kills: col.totalKills,
          deliveries: col.totalDeliveries,
          income: col.recentIncome,
          popHist: col.history.map((h) => h.pop),
          foodHist: col.history.map((h) => h.food),
        })),
        selected: sel,
      });
    }, 250);

    const fpsTimer = window.setInterval(() => {
      fpsRef.current.fps = fpsRef.current.frames;
      fpsRef.current.frames = 0;
    }, 1000);

    // --- input ----------------------------------------------------------
    const screenToWorld = (sx: number, sy: number) => {
      const cam = camRef.current;
      return {
        x: (sx - canvas.clientWidth / 2) / cam.zoom + cam.x,
        y: (sy - canvas.clientHeight / 2) / cam.zoom + cam.y,
      };
    };

    let dragging = false;
    let moved = 0;
    let last = { x: 0, y: 0 };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = 0;
      last = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved >= 6 && ctl.current.follow) setFollow(false);
      camRef.current.x -= dx / camRef.current.zoom;
      camRef.current.y -= dy / camRef.current.zoom;
      last = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      if (moved < 6) {
        const rect = canvas.getBoundingClientRect();
        const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        sim.selected = sim.findAntAt(w.x, w.y, 16 / camRef.current.zoom + 8);
      }
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      sim.dropFood(w.x, w.y);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const before = screenToWorld(sx, sy);
      const cam = camRef.current;
      const minZoom = Math.min(0.25, fitZoom());
      cam.zoom = Math.max(minZoom, Math.min(6, cam.zoom * (e.deltaY > 0 ? 0.88 : 1.14)));
      const after = screenToWorld(sx, sy);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
      else if (e.key === '1') setSpeed(1);
      else if (e.key === '2') setSpeed(2);
      else if (e.key === '3') setSpeed(4);
      else if (e.key === '4') setSpeed(8);
      else if (e.key === 'f' || e.key === 'F') setFollow((f) => !f);
      else if (e.key === 't' || e.key === 'T') setShowTrails((t) => !t);
      else if (e.key === 'r' || e.key === 'R') {
        setFollow(false);
        camRef.current = { x: CONFIG.worldW / 2, y: CONFIG.worldH / 2, zoom: fitZoom() };
      }
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('contextmenu', onContext);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearInterval(hudTimer);
      clearInterval(fpsTimer);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('contextmenu', onContext);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const sel = hud?.selected ?? null;

  return (
    <div className="sim-root">
      <canvas ref={canvasRef} className="sim-canvas" />

      <div className="panel hud-header">
        <h1>Neural Ant Wars</h1>
        <div className="sub">
          gen {hud?.generation ?? 1} · tick {hud?.tick ?? 0}
          <br />
          {phaseLabel(hud?.daylight ?? 1, hud?.rain ?? 0)} · {hud?.pop ?? 0} ants · {hud?.fps ?? 0} fps
        </div>
      </div>

      <div className="panel colony-list">
        {(hud?.colonies ?? []).map((col) => (
          <div key={col.name} className="colony-card" style={{ borderLeftColor: col.core }}>
            <div className="row">
              <span className="name" style={{ color: col.core }}>{col.name}</span>
              <span className="mono">{col.workers + col.soldiers + col.scouts} ants</span>
            </div>
            <div className="mono">
              W {col.workers} · S {col.soldiers} · Sc {col.scouts} · food {col.food.toFixed(0)}
            </div>
            <div className="mono">
              hauled {col.deliveries.toFixed(0)} · kills {col.kills} · income {col.income.toFixed(0)}
            </div>
            <Sparkline data={col.popHist} color={col.core} />
          </div>
        ))}
      </div>

      {sel && (
        <div className="panel inspector">
          <h2 style={{ color: sel.colonyColor }}>
            {sel.colonyName} {sel.caste} · gen {sel.generation}
          </h2>
          <div className="bar"><div style={{ width: `${sel.healthPct * 100}%`, background: '#ff6b5e' }} /></div>
          <div className="bar"><div style={{ width: `${sel.energy}%`, background: '#ffd35e' }} /></div>
          <div className="stat-grid">
            <span>age {(sel.agePct * 100).toFixed(0)}%</span>
            <span>carrying {sel.carry.toFixed(0)}</span>
            <span>fitness {sel.fitness.toFixed(1)}</span>
            <span>hauled {sel.deliveries.toFixed(0)}</span>
            <span>kills {sel.kills}</span>
            <span>
              <button
                style={{ background: 'none', border: 'none', color: follow ? '#ffd98a' : '#8d877c', cursor: 'pointer', padding: 0, fontFamily: 'monospace', fontSize: 11 }}
                onClick={() => setFollow((f) => !f)}
              >
                [{follow ? 'following · F' : 'follow · F'}]
              </button>
            </span>
          </div>
          <BrainViz getAnt={getSelectedAnt} />
        </div>
      )}

      <div className="panel controls">
        <button className={paused ? 'active' : ''} onClick={() => setPaused((p) => !p)}>
          {paused ? '▶ play' : '❚❚ pause'}
        </button>
        <div className="sep" />
        {[1, 2, 4, 8].map((s) => (
          <button key={s} className={speed === s ? 'active' : ''} onClick={() => setSpeed(s)}>
            {s}x
          </button>
        ))}
        <div className="sep" />
        <button className={showTrails ? 'active' : ''} onClick={() => setShowTrails((t) => !t)}>trails</button>
        <button className={showAlarm ? 'active' : ''} onClick={() => setShowAlarm((a) => !a)}>alarm</button>
      </div>

      <div className="panel hint">
        click ant = inspect brain · right-click = drop food
        <br />
        drag = pan · scroll = zoom · space = pause · 1-4 = speed · F = follow · T = trails · R = reset view
      </div>
    </div>
  );
}
