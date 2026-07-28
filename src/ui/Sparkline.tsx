import React, { useEffect, useRef } from 'react';

/** Tiny filled line chart for colony history. Redraws when `data` changes. */
export default function Sparkline({ data, color, height = 30 }: { data: number[]; color: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (data.length < 2) return;

    const max = Math.max(...data, 1);
    const px = (i: number) => (i / (data.length - 1)) * W;
    const py = (v: number) => H - 2 - (v / max) * (H - 5);

    ctx.beginPath();
    ctx.moveTo(0, H);
    data.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(W, H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '08');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    data.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }, [data, color]);

  return <canvas ref={ref} width={188} height={height} style={{ width: '100%', height, display: 'block' }} />;
}
