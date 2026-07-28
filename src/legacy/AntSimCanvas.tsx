import React, { useRef, useEffect, useState } from 'react';
import { Simulation } from './engine/Simulation';
import { World } from './world/World';
import { Colony } from './entities/Colony';
import { defaultConfig } from './utils/SimulationConfig';

const COLONY_COLORS = [
  '#ff4444', // red
  '#4488ff', // blue
  '#44ff44', // green
  '#ffff44', // yellow
  '#ff44ff', // magenta
  '#44ffff'  // cyan
];
const ANT_RADIUS = 4;

export default function AntSimCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation | null>(null);
  const statsRef = useRef({ tick: 0 });
  const zoomRef = useRef(0.65); // Start zoomed out to see full map
  const panRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const speedRef = useRef(1); // 1 = normal, 2 = 2x, 5 = 5x
  const [, setForceUpdate] = useState(0);

  if (!simRef.current) {
    const config = defaultConfig;
    const world = new World(config.mapWidth, config.mapHeight);
    
    // Spawn obstacles if enabled
    if (config.enableTerrainObstacles) {
      world.spawnObstacles(8, 20, 60);
    }
    
    world.spawnFood(config.foodNodeCount, 30);
    
    const colonies: Colony[] = [];
    for (let i = 0; i < config.colonyCount; i++) {
      colonies.push(
        new Colony(
          i, 
          COLONY_COLORS[i % COLONY_COLORS.length], 
          world, 
          config.startingWorkers, 
          config.startingSoldiers,
          config.startingScouts
        )
      );
    }
    
    // Register colonies with world for nest validation
    world.colonies = colonies;
    
    simRef.current = new Simulation(world, colonies, config.generationDurationTicks);
  }

  useEffect(() => {
    let running = true;
    const ctx = canvasRef.current?.getContext('2d');
    let frameCount = 0;

    function tick() {
      if (!ctx || !simRef.current) return;
      const width = simRef.current.world.width;
      const height = simRef.current.world.height;
      
      // Run simulation at configured speed
      for (let s = 0; s < speedRef.current; s++) {
        simRef.current.update();
      }
      frameCount++;
      
      // Update stats ref directly to avoid React batching issues
      statsRef.current = {
        tick: simRef.current.tick
      };
      
      // Force React re-render every 60 frames for smooth ticks
      if (frameCount % 60 === 0) {
        setForceUpdate(frameCount);
      }

      ctx.clearRect(0, 0, width, height);

      // Apply zoom and pan transformation
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      // Draw background with subtle grid
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);

      // Weather visual effect on background
      const weatherType = simRef.current.weather.currentWeather;
      if (weatherType === 'rain') {
        ctx.fillStyle = 'rgba(30, 60, 120, 0.08)';
        ctx.fillRect(0, 0, width, height);
      } else if (weatherType === 'fog') {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.1)';
        ctx.fillRect(0, 0, width, height);
      } else if (weatherType === 'storm') {
        ctx.fillStyle = 'rgba(20, 20, 40, 0.15)';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw territory ownership (BEFORE food/ants so it's a background layer)
      const cellSize = simRef.current.world.cellSize;
      const ownership = simRef.current.world.territoryOwnership;
      if (ownership && ownership.length) {
        for (let y = 0; y < ownership.length; y++) {
          for (let x = 0; x < ownership[y].length; x++) {
            const owner = ownership[y][x];
            if (owner >= 0 && owner < COLONY_COLORS.length) {
              ctx.fillStyle = COLONY_COLORS[owner];
              ctx.globalAlpha = 0.08;
              ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // Draw pheromone trails (food pheromones as subtle yellow glow)
      simRef.current.colonies.forEach((colony, idx) => {
        const grid = colony.pheromoneGrid;
        const gs = grid.gridSize;
        const foodLayer = grid.pheromoneLayers.get('food');
        const dangerLayer = grid.pheromoneLayers.get('danger');
        if (foodLayer) {
          for (let gy = 0; gy < grid.height; gy++) {
            for (let gx = 0; gx < grid.width; gx++) {
              const val = foodLayer[gy * grid.width + gx];
              if (val > 5) {
                ctx.fillStyle = COLONY_COLORS[idx];
                ctx.globalAlpha = Math.min(0.25, val / 255);
                ctx.fillRect(gx * gs, gy * gs, gs, gs);
              }
            }
          }
        }
        if (dangerLayer) {
          for (let gy = 0; gy < grid.height; gy++) {
            for (let gx = 0; gx < grid.width; gx++) {
              const val = dangerLayer[gy * grid.width + gx];
              if (val > 5) {
                ctx.fillStyle = '#ff0000';
                ctx.globalAlpha = Math.min(0.15, val / 255);
                ctx.fillRect(gx * gs, gy * gs, gs, gs);
              }
            }
          }
        }
        ctx.globalAlpha = 1.0;
      });

      // Draw obstacles
      simRef.current.world.obstacles.forEach(obstacle => {
        ctx.fillStyle = 
          obstacle.type === 'water' ? '#2266ff' :
          obstacle.type === 'rock' ? '#888888' : 
          '#444444';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        ctx.globalAlpha = 1.0;
        
        ctx.strokeStyle = 
          obstacle.type === 'water' ? '#4488ff' :
          obstacle.type === 'rock' ? '#aaaaaa' :
          '#666666';
        ctx.lineWidth = 2;
        ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      });

      // Draw food nodes
      simRef.current.world.foodNodes.forEach(food => {
        if (food.amount <= 0) return;
        const size = Math.max(3, Math.min(10, food.amount / 5));
        ctx.beginPath();
        ctx.arc(food.x, food.y, size, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe066';
        ctx.fill();
        ctx.strokeStyle = '#ffa000';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Draw nests
      simRef.current.colonies.forEach((colony, idx) => {
        ctx.beginPath();
        ctx.arc(colony.nestX, colony.nestY, 20, 0, Math.PI * 2);
        ctx.fillStyle = COLONY_COLORS[idx];
        ctx.globalAlpha = 0.15;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = COLONY_COLORS[idx];
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw food indicator on nest
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(colony.food).toString(), colony.nestX, colony.nestY - 2);
      });

      // Draw fog of war using offscreen canvas
      if (defaultConfig.enableFogOfWar) {
        // Create fog layer
        const fogCanvas = document.createElement('canvas');
        fogCanvas.width = width;
        fogCanvas.height = height;
        const fogCtx = fogCanvas.getContext('2d')!;

        // Fill with dark fog
        fogCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        fogCtx.fillRect(0, 0, width, height);

        // Punch holes around ants using destination-out
        fogCtx.globalCompositeOperation = 'destination-out';
        simRef.current.colonies.forEach((colony) => {
          // Reveal around nest
          const nestGrad = fogCtx.createRadialGradient(colony.nestX, colony.nestY, 0, colony.nestX, colony.nestY, 80);
          nestGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
          nestGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          fogCtx.fillStyle = nestGrad;
          fogCtx.beginPath();
          fogCtx.arc(colony.nestX, colony.nestY, 80, 0, Math.PI * 2);
          fogCtx.fill();

          colony.ants.forEach(ant => {
            let revealRadius = 40;
            if (ant.caste === 'scout') revealRadius = 120;
            else if (ant.caste === 'soldier') revealRadius = 30;

            const gradient = fogCtx.createRadialGradient(ant.x, ant.y, 0, ant.x, ant.y, revealRadius);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.5)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            fogCtx.fillStyle = gradient;
            fogCtx.beginPath();
            fogCtx.arc(ant.x, ant.y, revealRadius, 0, Math.PI * 2);
            fogCtx.fill();
          });
        });

        // Draw fog over the main canvas
        ctx.drawImage(fogCanvas, 0, 0);
      }

      // Draw ants (on top of fog)
      simRef.current.colonies.forEach((colony, idx) => {
        colony.ants.forEach(ant => {
          // Wrap around
          if (ant.x < 0) ant.x += width;
          if (ant.x > width) ant.x -= width;
          if (ant.y < 0) ant.y += height;
          if (ant.y > height) ant.y -= height;

          ctx.beginPath();
          ctx.arc(ant.x, ant.y, ANT_RADIUS, 0, Math.PI * 2);
          
          // Coloring: scouts are lighter, soldiers are darker, workers carrying food are white
          if (ant.carryingFood) {
            ctx.fillStyle = '#fff';
          } else if (ant.caste === 'scout') {
            ctx.fillStyle = idx === 0 ? '#ffaaaa' : '#aaaaff';
          } else {
            ctx.fillStyle = COLONY_COLORS[idx];
          }
          ctx.fill();
          
          // Draw direction indicator
          ctx.strokeStyle = COLONY_COLORS[idx];
          ctx.lineWidth = 0.5;
          const dirX = Math.cos(ant.angle) * 4;
          const dirY = Math.sin(ant.angle) * 4;
          ctx.beginPath();
          ctx.moveTo(ant.x, ant.y);
          ctx.lineTo(ant.x + dirX, ant.y + dirY);
          ctx.stroke();
        });
      });

      // Restore canvas state before drawing UI
      ctx.restore();

      // Draw all UI in screen space (not affected by zoom/pan)
      const sim = simRef.current!;
      const canvasW = canvasRef.current?.width || width;
      const canvasH = canvasRef.current?.height || height;

      // Semi-transparent background for HUD
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, 420, 35 + sim.colonies.length * 55);

      ctx.fillStyle = '#00ff00';
      ctx.font = '13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Gen: ${sim.generation} | Tick: ${sim.tick} | Weather: ${sim.weather.currentWeather} (${sim.weather.effectMultiplier.toFixed(1)}x)`, 10, 20);
      
      sim.colonies.forEach((colony, idx) => {
        const yOffset = 40 + idx * 55;
        ctx.fillStyle = COLONY_COLORS[idx % COLONY_COLORS.length];
        ctx.font = '13px monospace';
        const workers = colony.ants.filter(a => a.caste === 'worker').length;
        const soldiers = colony.ants.filter(a => a.caste === 'soldier').length;
        const scouts = colony.ants.filter(a => a.caste === 'scout').length;
        ctx.fillText(
          `Colony ${idx + 1}: W=${workers} S=${soldiers} Sc=${scouts} | Food=${colony.food.toFixed(0)}`,
          10, yOffset
        );
        ctx.fillStyle = '#aaa';
        ctx.font = '11px monospace';
        ctx.fillText(
          `Fitness: ${colony.fitness.toFixed(0)} (food:${colony.workerFoodGathered} kills:${colony.soldierKills} scout:${colony.scoutDiscoveries})`,
          10, yOffset + 14
        );
        ctx.fillStyle = '#888';
        ctx.fillText(
          `Queen: agg=${colony.queen.aggression.toFixed(2)} def=${colony.queen.defense.toFixed(2)} exp=${colony.queen.exploration.toFixed(2)}`,
          10, yOffset + 26
        );
      });

      // Draw zoom level and controls help
      ctx.fillStyle = '#00ff00';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Zoom: ${(zoomRef.current * 100).toFixed(0)}% | Speed: ${speedRef.current}x`, canvasW - 10, canvasH - 30);
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText('Scroll=Zoom  Drag=Pan  WASD/Arrows=Pan  R=Reset  1-4=Speed', canvasW - 10, canvasH - 14);

      // Rain particle effect
      if (weatherType === 'rain' || weatherType === 'storm') {
        ctx.strokeStyle = weatherType === 'storm' ? 'rgba(150,180,255,0.4)' : 'rgba(100,150,255,0.2)';
        ctx.lineWidth = 1;
        const drops = weatherType === 'storm' ? 80 : 30;
        for (let i = 0; i < drops; i++) {
          const rx = Math.random() * canvasW;
          const ry = Math.random() * canvasH;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 2, ry + 8);
          ctx.stroke();
        }
      }

      if (running) requestAnimationFrame(tick);
    }

    // Zoom and pan handlers
    const PAN_SPEED = 20;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') {
        zoomRef.current = Math.min(3, zoomRef.current * 1.1);
      } else if (e.key === '-' || e.key === '_') {
        zoomRef.current = Math.max(0.2, zoomRef.current / 1.1);
      } else if (e.key === 'w' || e.key === 'ArrowUp') {
        panRef.current.y += PAN_SPEED;
      } else if (e.key === 's' || e.key === 'ArrowDown') {
        panRef.current.y -= PAN_SPEED;
      } else if (e.key === 'a' || e.key === 'ArrowLeft') {
        panRef.current.x += PAN_SPEED;
      } else if (e.key === 'd' || e.key === 'ArrowRight') {
        panRef.current.x -= PAN_SPEED;
      } else if (e.key === 'r' || e.key === 'Home') {
        // Reset view
        zoomRef.current = 0.65;
        panRef.current = { x: 0, y: 0 };
      } else if (e.key === '1') {
        speedRef.current = 1;
      } else if (e.key === '2') {
        speedRef.current = 3;
      } else if (e.key === '3') {
        speedRef.current = 5;
      } else if (e.key === '4') {
        speedRef.current = 10;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Zoom toward mouse position
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const oldZoom = zoomRef.current;
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.2, Math.min(3, oldZoom * zoomDelta));
      
      // Adjust pan so zoom centers on mouse
      panRef.current.x = mouseX - (mouseX - panRef.current.x) * (newZoom / oldZoom);
      panRef.current.y = mouseY - (mouseY - panRef.current.y) * (newZoom / oldZoom);
      
      zoomRef.current = newZoom;
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...panRef.current };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      panRef.current.x = panStart.current.x + (e.clientX - dragStart.current.x);
      panRef.current.y = panStart.current.y + (e.clientY - dragStart.current.y);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    canvasRef.current?.addEventListener('wheel', handleWheel, { passive: false });
    canvasRef.current?.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    tick();
    return () => {
      running = false;
      window.removeEventListener('keydown', handleKeyDown);
      canvasRef.current?.removeEventListener('wheel', handleWheel);
      canvasRef.current?.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={defaultConfig.mapWidth}
      height={defaultConfig.mapHeight}
      style={{ display: 'block', margin: '0 auto', background: '#111', cursor: 'grab' }}
    />
  );
}
