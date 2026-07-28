export class Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'wall' | 'water' | 'rock';

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    type: 'wall' | 'water' | 'rock' = 'wall'
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
  }

  contains(x: number, y: number): boolean {
    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height
    );
  }

  intersectsCircle(x: number, y: number, radius: number): boolean {
    const closestX = Math.max(this.x, Math.min(x, this.x + this.width));
    const closestY = Math.max(this.y, Math.min(y, this.y + this.height));
    const dx = x - closestX;
    const dy = y - closestY;
    return dx * dx + dy * dy < radius * radius;
  }
}
