export type SpecializationType = 'balanced' | 'aggressive' | 'defensive' | 'harvester' | 'scout-focused';

export class ColonySpecialization {
  type: SpecializationType;
  intensity: number; // 0-1, how specialized

  constructor(type: SpecializationType = 'balanced', intensity: number = 0.5) {
    this.type = type;
    this.intensity = Math.max(0, Math.min(1, intensity));
  }

  getMutationBoost(): number {
    // Specialized colonies mutate faster (more aggressive evolution)
    return 1.0 + this.intensity * 0.5;
  }

  getWorkerBias(): number {
    // How much to favor workers vs soldiers
    if (this.type === 'harvester') return 1.5;
    if (this.type === 'aggressive') return 0.5;
    if (this.type === 'scout-focused') return 0.8;
    return 1.0;
  }

  getSoldierBias(): number {
    // How much to favor soldiers vs workers
    if (this.type === 'aggressive') return 2.0;
    if (this.type === 'defensive') return 1.5;
    if (this.type === 'harvester') return 0.3;
    return 1.0;
  }

  getScoutBias(): number {
    // How much to favor scouts
    if (this.type === 'scout-focused') return 2.0;
    if (this.type === 'aggressive') return 1.2;
    return 0.5;
  }

  getMovementSpeed(): number {
    // Base movement speed multiplier
    if (this.type === 'scout-focused') return 1.3;
    if (this.type === 'aggressive') return 1.1;
    return 1.0;
  }

  mutate(): void {
    // Specialization can drift over time
    if (Math.random() < 0.05 * this.intensity) {
      const types: SpecializationType[] = [
        'balanced',
        'aggressive',
        'defensive',
        'harvester',
        'scout-focused',
      ];
      this.type = types[Math.floor(Math.random() * types.length)];
    }

    // Intensity drifts
    this.intensity += (Math.random() - 0.5) * 0.1;
    this.intensity = Math.max(0, Math.min(1, this.intensity));
  }

  clone(): ColonySpecialization {
    return new ColonySpecialization(this.type, this.intensity);
  }
}
