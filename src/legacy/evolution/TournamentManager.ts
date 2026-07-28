export interface TournamentStats {
  colonyId: number;
  generationWins: number;
  totalFitness: number;
  bestFitness: number;
  averagePopulation: number;
}

export class TournamentManager {
  tournaments: Map<number, Map<number, TournamentStats>> = new Map();
  currentSeason: number = 0;

  recordGeneration(
    colonyId: number,
    fitness: number,
    population: number
  ): void {
    if (!this.tournaments.has(this.currentSeason)) {
      this.tournaments.set(this.currentSeason, new Map());
    }

    const season = this.tournaments.get(this.currentSeason)!;
    if (!season.has(colonyId)) {
      season.set(colonyId, {
        colonyId,
        generationWins: 0,
        totalFitness: 0,
        bestFitness: 0,
        averagePopulation: 0,
      });
    }

    const stats = season.get(colonyId)!;
    stats.totalFitness += fitness;
    stats.bestFitness = Math.max(stats.bestFitness, fitness);
    stats.averagePopulation = (stats.averagePopulation + population) / 2;
  }

  determineWinner(colonyCount: number): number {
    const season = this.tournaments.get(this.currentSeason);
    if (!season || season.size === 0) return 0;

    let bestColony = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < colonyCount; i++) {
      const stats = season.get(i);
      if (!stats) continue;
      if (stats.bestFitness > bestScore) {
        bestScore = stats.bestFitness;
        bestColony = i;
      }
    }

    return bestColony;
  }

  startNewSeason(): void {
    this.currentSeason++;
  }

  getSeasonStats(season: number): Map<number, TournamentStats> | undefined {
    return this.tournaments.get(season);
  }

  getAllStats(): Map<number, Map<number, TournamentStats>> {
    return this.tournaments;
  }
}
