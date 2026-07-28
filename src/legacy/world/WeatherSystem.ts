export type WeatherType = 'clear' | 'rain' | 'fog' | 'storm';

export class WeatherSystem {
  currentWeather: WeatherType = 'clear';
  ticks: number = 0;
  duration: number = 1000; // ticks per weather change
  effectMultiplier: number = 1.0; // how much it affects ant efficiency

  update(): void {
    this.ticks++;

    if (this.ticks >= this.duration) {
      this.changeWeather();
      this.ticks = 0;
    }

    // Update effect multiplier based on weather
    switch (this.currentWeather) {
      case 'clear':
        this.effectMultiplier = 1.0;
        break;
      case 'rain':
        this.effectMultiplier = 0.7; // ants move slower
        break;
      case 'fog':
        this.effectMultiplier = 0.8; // reduced visibility
        break;
      case 'storm':
        this.effectMultiplier = 0.5; // severe impact
        break;
    }
  }

  private changeWeather(): void {
    const weatherTypes: WeatherType[] = ['clear', 'rain', 'fog', 'storm'];
    const currentIndex = weatherTypes.indexOf(this.currentWeather);

    // 60% chance to stay similar weather, 40% random
    if (Math.random() < 0.6) {
      // Stay similar - weighted transition
      const options = [
        weatherTypes[currentIndex],
        weatherTypes[(currentIndex + 1) % weatherTypes.length],
      ];
      this.currentWeather = options[Math.floor(Math.random() * options.length)];
    } else {
      // Random weather
      this.currentWeather =
        weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
    }
  }

  getProgressPercentage(): number {
    return (this.ticks / this.duration) * 100;
  }

  getWeatherColor(): string {
    switch (this.currentWeather) {
      case 'clear':
        return '#ffffff';
      case 'rain':
        return '#4488ff';
      case 'fog':
        return '#999999';
      case 'storm':
        return '#333333';
      default:
        return '#ffffff';
    }
  }
}
