import React, { useEffect, useRef } from 'react';
import { Ant, INPUT_LABELS, OUTPUT_LABELS } from '../sim/Ant';

/**
 * Live neural-network view of the selected ant: nodes glow with activation
 * (green positive / red negative), edges show strong weights.
 */
export default function BrainViz({ getAnt }: { getAnt: () => Ant | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    function render() {
      if (!alive) return;
      const canvas = canvasRef.current;
      const ant = getAnt();
      if (canvas && ant) {
        const ctx = canvas.getContext('2d')!;
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const brain = ant.brain;
        const layers = brain.acts;
        const colX = (l: number) => 78 + (l * (W - 148)) / (layers.length - 1);
        const nodeY = (l: number, i: number) => {
          const n = layers[l].length;
          return (H / 2) + (i - (n - 1) / 2) * Math.min(22, (H - 24) / n);
        };

        // Edges first.
        for (let l = 0; l < brain.w.length; l++) {
          const w = brain.w[l];
          const nIn = layers[l].length;
          const nOut = layers[l + 1].length;
          for (let j = 0; j < nIn; j++) {
            for (let i = 0; i < nOut; i++) {
              const wt = w[j * nOut + i];
              if (Math.abs(wt) < 0.45) continue;
              ctx.strokeStyle = wt > 0 ? 'rgba(110,220,140,0.25)' : 'rgba(255,110,110,0.22)';
              ctx.lineWidth = Math.min(2, Math.abs(wt) * 0.8);
              ctx.beginPath();
              ctx.moveTo(colX(l), nodeY(l, j));
              ctx.lineTo(colX(l + 1), nodeY(l + 1, i));
              ctx.stroke();
            }
          }
        }

        // Nodes.
        ctx.font = '9px monospace';
        for (let l = 0; l < layers.length; l++) {
          for (let i = 0; i < layers[l].length; i++) {
            const a = layers[l][i];
            const x = colX(l);
            const y = nodeY(l, i);
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            const mag = Math.min(1, Math.abs(a));
            ctx.fillStyle = a >= 0
              ? `rgba(110, 230, 150, ${0.15 + mag * 0.85})`
              : `rgba(255, 110, 110, ${0.15 + mag * 0.85})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            if (l === 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.55)';
              ctx.textAlign = 'right';
              ctx.fillText(INPUT_LABELS[i] ?? '', x - 9, y + 3);
            } else if (l === layers.length - 1) {
              ctx.fillStyle = 'rgba(255,255,255,0.75)';
              ctx.textAlign = 'left';
              ctx.fillText(`${OUTPUT_LABELS[i] ?? ''} ${a.toFixed(2)}`, x + 9, y + 3);
            }
          }
        }
      }
      requestAnimationFrame(render);
    }
    render();
    return () => { alive = false; };
  }, [getAnt]);

  return <canvas ref={canvasRef} width={310} height={260} style={{ width: '100%' }} />;
}
