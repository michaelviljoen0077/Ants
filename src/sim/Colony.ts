import { Ant } from './Ant';
import { Brain } from './Brain';
import { Field } from './Field';
import { SpatialHash } from './SpatialHash';
import { World, FoodSource } from './World';
import { CASTE_SPEED, Caste, ColonyTheme, CONFIG } from './config';

export interface HistoryPoint {
  pop: number;
  food: number;
  fitness: number;
}

const TAU = Math.PI * 2;

function angleDiff(target: number, current: number): number {
  let d = (target - current) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export class Colony {
  readonly id: number;
  readonly theme: ColonyTheme;
  nestX: number;
  nestY: number;

  foodStore = 120;
  ants: Ant[] = [];

  // Stigmergy channels. "home" points back to the nest, "food" toward finds,
  // "alarm" recruits soldiers and scatters workers.
  home: Field;
  food: Field;
  alarm: Field;

  // Lifetime counters for the UI.
  totalDeliveries = 0;
  totalKills = 0;
  totalDeaths = 0;
  totalBirths = 0;

  // Queen policy (recomputed from colony state; shown in the UI).
  soldierTarget = 0.14;
  scoutTarget = 0.1;
  /** Set by the Simulation: nearest rival nest. Prosperous colonies raid it. */
  raidTarget: { x: number; y: number } | null = null;

  history: HistoryPoint[] = [];
  private spawnTimer = 0;
  private incomeWindow: number[] = [];
  recentIncome = 0;

  /** Best brain seen per caste — used to re-seed the colony after a wipe-out. */
  private champions: Partial<Record<Caste, { brain: Brain; fitness: number }>> = {};

  constructor(id: number, theme: ColonyTheme, nestX: number, nestY: number, world: World) {
    this.id = id;
    this.theme = theme;
    this.nestX = nestX;
    this.nestY = nestY;
    this.home = new Field(world.w, world.h, CONFIG.cell);
    this.food = new Field(world.w, world.h, CONFIG.cell);
    this.alarm = new Field(world.w, world.h, CONFIG.cell);

    const spawn = (caste: Caste, n: number) => {
      for (let i = 0; i < n; i++) this.ants.push(this.newAnt(caste, 1));
    };
    spawn('worker', CONFIG.start.worker);
    spawn('soldier', CONFIG.start.soldier);
    spawn('scout', CONFIG.start.scout);
  }

  private newAnt(caste: Caste, generation: number, brain?: Brain): Ant {
    return new Ant(
      this.nestX + (Math.random() - 0.5) * 30,
      this.nestY + (Math.random() - 0.5) * 30,
      caste, this.id, generation, brain,
    );
  }

  castCount(caste: Caste): number {
    let n = 0;
    for (const a of this.ants) if (a.caste === caste) n++;
    return n;
  }

  update(world: World, hash: SpatialHash<Ant>, tick: number, daylight: number, generation: number): void {
    // --- field upkeep -------------------------------------------------
    this.home.decay(0.9988);
    this.food.decay(0.9982);
    this.alarm.decay(0.988);
    if (tick % 6 === this.id % 6) {
      this.home.diffuse(0.14);
      this.food.diffuse(0.14);
      this.alarm.diffuse(0.2);
    }
    // The nest itself is a permanent home beacon.
    this.home.deposit(this.nestX, this.nestY, 1.5);

    // --- queen policy --------------------------------------------------
    const alarmAtNest = this.alarm.sample(this.nestX, this.nestY);
    this.soldierTarget = Math.min(0.45, 0.12 + alarmAtNest * 0.35 + Math.min(0.1, this.totalKills * 0.002));
    this.scoutTarget = this.recentIncome < 4 ? 0.16 : 0.07;

    // --- ants ----------------------------------------------------------
    let incomeThisTick = 0;
    for (const ant of this.ants) {
      incomeThisTick += this.updateAnt(ant, world, hash, daylight);
    }

    // Sliding income window (≈ last 400 ticks) regulates births and scouting.
    this.incomeWindow.push(incomeThisTick);
    if (this.incomeWindow.length > 400) this.incomeWindow.shift();
    this.recentIncome = this.incomeWindow.reduce((s, v) => s + v, 0);

    // --- deaths ----------------------------------------------------------
    const survivors: Ant[] = [];
    for (const ant of this.ants) {
      if (ant.health > 0 && ant.age < ant.maxAge) {
        survivors.push(ant);
        continue;
      }
      this.totalDeaths++;
      this.alarm.deposit(ant.x, ant.y, 0.5);
      if (ant.carry > 2) {
        // Dropped cargo becomes scavengeable food — keeps matter in the loop.
        world.food.push({ x: ant.x, y: ant.y, amount: ant.carry, max: ant.carry, seed: Math.random() * 1000 });
      }
      const champ = this.champions[ant.caste];
      if (!champ || ant.fitness > champ.fitness) {
        this.champions[ant.caste] = { brain: ant.brain.clone(), fitness: ant.fitness };
      }
    }
    this.ants = survivors;

    // --- births ----------------------------------------------------------
    this.spawnTimer++;
    if (this.spawnTimer >= CONFIG.spawnInterval) {
      this.spawnTimer = 0;
      this.handleBirths(generation);
    }

    // Wipe-out: the nest survives and re-seeds a small brood from champion genes.
    if (this.ants.length === 0) {
      this.foodStore = Math.max(this.foodStore, 80);
      for (let i = 0; i < 8; i++) {
        const caste: Caste = i < 5 ? 'worker' : i < 7 ? 'soldier' : 'scout';
        const champ = this.champions[caste];
        const brain = champ ? champ.brain.mutate(0.2, 0.3) : undefined;
        this.ants.push(this.newAnt(caste, generation, brain));
        this.totalBirths++;
      }
    }

    // --- history ----------------------------------------------------------
    if (tick % 40 === 0) {
      const meanFit = this.ants.length
        ? this.ants.reduce((s, a) => s + a.fitness, 0) / this.ants.length
        : 0;
      this.history.push({ pop: this.ants.length, food: this.foodStore, fitness: meanFit });
      if (this.history.length > 300) this.history.shift();
    }
  }

  /** Trail steering: contrast between the left/right whisker samples of a field. */
  private whisker(field: Field, ant: Ant): { steer: number; here: number } {
    const d = CONFIG.whiskerDist;
    const wa = CONFIG.whiskerAngle;
    const l = field.sample(ant.x + Math.cos(ant.angle - wa) * d, ant.y + Math.sin(ant.angle - wa) * d);
    const r = field.sample(ant.x + Math.cos(ant.angle + wa) * d, ant.y + Math.sin(ant.angle + wa) * d);
    const here = field.sample(ant.x, ant.y);
    return { steer: (r - l) / (l + r + 0.05), here };
  }

  /** Returns food delivered to the nest this tick (for the income window). */
  private updateAnt(ant: Ant, world: World, hash: SpatialHash<Ant>, daylight: number): number {
    // Killed earlier this tick by another colony: it's removed in the death pass.
    if (ant.health <= 0) return 0;
    ant.age++;
    if (ant.cooldown > 0) ant.cooldown--;

    const sense = ant.caste === 'scout' ? CONFIG.scoutSense : CONFIG.antSense;
    const nestDx = this.nestX - ant.x;
    const nestDy = this.nestY - ant.y;
    const nestDist = Math.hypot(nestDx, nestDy);

    // --- perception ---------------------------------------------------
    let nearestEnemy: Ant | null = null;
    let enemyDist = Infinity;
    let allies = 0;
    hash.forEachInRange(ant.x, ant.y, sense, (other) => {
      if (other === ant || other.health <= 0) return;
      const d = Math.hypot(other.x - ant.x, other.y - ant.y);
      if (d > sense) return;
      if (other.colonyId === this.id) allies++;
      else if (d < enemyDist) { enemyDist = d; nearestEnemy = other; }
    });

    let nearestFood: FoodSource | null = null;
    let foodDist = Infinity;
    if (ant.carry === 0) {
      for (const f of world.food) {
        if (f.amount <= 0.5) continue;
        const d = Math.hypot(f.x - ant.x, f.y - ant.y);
        if (d < foodDist && d < sense) { foodDist = d; nearestFood = f; }
      }
    }

    const fw = this.whisker(this.food, ant);
    const hw = this.whisker(this.home, ant);
    const aw = this.whisker(this.alarm, ant);

    // --- brain ----------------------------------------------------------
    const inp = ant.inputs;
    inp[0] = ant.carry > 0 ? 1 : 0;
    inp[1] = ant.energy / 100;
    inp[2] = ant.health / ant.maxHealth;
    inp[3] = Math.min(1, nestDist / 600);
    inp[4] = fw.steer;
    inp[5] = Math.min(1, fw.here / Field.MAX);
    inp[6] = hw.steer;
    inp[7] = Math.min(1, hw.here / Field.MAX);
    inp[8] = Math.min(1, aw.here);
    inp[9] = nearestEnemy ? 1 - enemyDist / sense : 0;
    inp[10] = Math.min(1, allies / 12);
    inp[11] = daylight;
    const out = ant.brain.forward(inp);

    const trailTrust = 0.5 + 0.5 * out[2]; // 0..1
    const explore = 0.5 + 0.5 * out[3]; // 0..1

    // --- steering ---------------------------------------------------------
    let steer = 0;
    const headHome = (rate: number) => {
      steer += angleDiff(Math.atan2(nestDy, nestDx), ant.angle) * rate;
    };

    if (ant.carry > 0) {
      // Loaded: climb the home gradient, lock onto the nest once it's close.
      steer += hw.steer * 0.85 * trailTrust;
      if (nestDist < 160) headHome(0.4);
      this.food.deposit(ant.x, ant.y, ant.foodPot * 0.45);
      ant.foodPot *= 0.9955;
    } else {
      if (nearestFood) {
        steer += angleDiff(Math.atan2(nearestFood.y - ant.y, nearestFood.x - ant.x), ant.angle) * 0.45;
      } else {
        steer += fw.steer * 0.85 * trailTrust;
      }
      this.home.deposit(ant.x, ant.y, ant.homePot * 0.35);
      ant.homePot *= 0.9955;
    }

    // --- caste instincts ----------------------------------------------------
    let speedMul = 1;
    if (ant.caste === 'soldier') {
      if (ant.health < ant.maxHealth * 0.22) {
        headHome(0.45); // retreat when badly hurt
      } else if (nearestEnemy) {
        const e: Ant = nearestEnemy;
        steer += angleDiff(Math.atan2(e.y - ant.y, e.x - ant.x), ant.angle) * 0.6;
        speedMul = 1.2;
        if (enemyDist < CONFIG.attackRange && ant.cooldown <= 0) {
          ant.cooldown = CONFIG.attackCooldown;
          e.health -= CONFIG.attackDamage;
          this.alarm.deposit(ant.x, ant.y, 0.8); // rally own soldiers
          if (e.health <= 0) {
            ant.kills++;
            ant.fitness += 5;
            this.totalKills++;
          }
        }
      } else if (aw.here > 0.05) {
        steer += aw.steer * 0.7; // march toward the fighting
        speedMul = 1.15;
      } else if (this.raidTarget && this.foodStore > 260) {
        // Wealth breeds ambition: spare soldiers march on the rival nest.
        const rt = this.raidTarget;
        steer += angleDiff(Math.atan2(rt.y - ant.y, rt.x - ant.x), ant.angle) * 0.22;
      } else if (nestDist > 320) {
        headHome(0.15); // patrol perimeter
      }
    } else {
      // Workers and scouts are prey: alarm + enemies mean run home.
      if (nearestEnemy && enemyDist < 60) {
        const e: Ant = nearestEnemy;
        steer += angleDiff(Math.atan2(ant.y - e.y, ant.x - e.x), ant.angle) * 0.5;
        speedMul = 1.25;
      } else if (aw.here > 0.4 && ant.caste === 'worker') {
        headHome(0.3);
        speedMul = 1.15;
      }
      if (ant.caste === 'scout') {
        // Frontier-seeking: drift away from saturated home trails, wander hard.
        steer -= hw.steer * 0.25;
        if (nearestFood && this.food.sample(ant.x, ant.y) < 0.4) {
          this.food.deposit(ant.x, ant.y, 0.9); // recruit workers to the find
          ant.fitness += 0.05;
        }
      }
    }

    // Brain contribution + exploration noise.
    steer += out[0] * 0.3;
    steer += (Math.random() - 0.5) * (0.12 + 0.55 * explore);
    if (steer > 0.5) steer = 0.5;
    else if (steer < -0.5) steer = -0.5;
    ant.angle += steer;

    // --- movement -------------------------------------------------------------
    const energyFactor = 0.55 + 0.45 * (ant.energy / 100);
    const nightFactor = 0.82 + 0.18 * daylight;
    const speed = CASTE_SPEED[ant.caste] * (0.7 + 0.3 * (0.5 + 0.5 * out[1])) * speedMul * energyFactor * nightFactor;
    const nx = ant.x + Math.cos(ant.angle) * speed;
    const ny = ant.y + Math.sin(ant.angle) * speed;
    if (!world.blocked(nx, ny)) {
      ant.x = nx;
      ant.y = ny;
    } else if (!world.blocked(nx, ant.y)) {
      ant.x = nx;
      ant.angle += 0.3;
    } else if (!world.blocked(ant.x, ny)) {
      ant.y = ny;
      ant.angle -= 0.3;
    } else {
      ant.angle += Math.PI * (0.5 + Math.random() * 0.5);
    }

    // --- food & nest interactions ----------------------------------------------
    let delivered = 0;
    if (ant.carry === 0 && nearestFood && nearestFood.amount > 0.5 && ant.caste !== 'soldier') {
      const pickupRange = 6 + Math.sqrt(nearestFood.amount) * 0.7;
      if (foodDist < pickupRange) {
        const take = Math.min(8, nearestFood.amount);
        nearestFood.amount -= take;
        ant.carry = take;
        ant.foodPot = 1;
        this.food.deposit(ant.x, ant.y, 1);
        ant.angle += Math.PI; // about-face toward home
      }
    }
    if (nestDist < 28) {
      ant.homePot = 1;
      if (ant.carry > 0) {
        delivered = ant.carry;
        this.foodStore += ant.carry;
        this.totalDeliveries += ant.carry;
        ant.fitness += ant.carry * 2;
        ant.deliveries += ant.carry;
        ant.carry = 0;
        ant.angle += Math.PI; // head back out
      }
      if (ant.energy < 85 && this.foodStore > 1) {
        ant.energy = Math.min(100, ant.energy + 2.5);
        this.foodStore -= 0.02;
      }
    }

    // --- metabolism ---------------------------------------------------------------
    ant.energy -= 0.016 + speed * 0.004;
    if (ant.energy <= 0) {
      ant.energy = 0;
      ant.health -= 0.06;
    }

    return delivered;
  }

  private handleBirths(generation: number): void {
    if (this.ants.length === 0 || this.ants.length >= CONFIG.maxPop) return;
    if (this.foodStore < CONFIG.spawnCost + 25) return;
    // Need real income to grow, not just a stockpile.
    if (this.recentIncome < 2 && this.ants.length > 30) return;

    const pop = this.ants.length;
    const soldierDeficit = this.soldierTarget - this.castCount('soldier') / pop;
    const scoutDeficit = this.scoutTarget - this.castCount('scout') / pop;
    let caste: Caste = 'worker';
    if (soldierDeficit > 0 && soldierDeficit >= scoutDeficit) caste = 'soldier';
    else if (scoutDeficit > 0) caste = 'scout';

    const brain = this.breedBrain(caste);
    this.ants.push(this.newAnt(caste, generation, brain));
    this.foodStore -= CONFIG.spawnCost;
    this.totalBirths++;
  }

  /** Fitness-weighted parent lottery within the caste, with occasional crossover. */
  private breedBrain(caste: Caste): Brain | undefined {
    const pool = this.ants.filter((a) => a.caste === caste);
    const pickParent = (): Ant | null => {
      if (pool.length === 0) return null;
      const total = pool.reduce((s, a) => s + a.fitness + 1, 0);
      let roll = Math.random() * total;
      for (const a of pool) {
        roll -= a.fitness + 1;
        if (roll <= 0) return a;
      }
      return pool[pool.length - 1];
    };

    const p1 = pickParent();
    if (!p1) {
      const champ = this.champions[caste];
      return champ ? champ.brain.mutate(CONFIG.mutationRate, CONFIG.mutationStrength) : undefined;
    }
    let genome = p1.brain;
    if (pool.length > 1 && Math.random() < CONFIG.crossoverChance) {
      const p2 = pickParent();
      if (p2 && p2 !== p1) genome = Brain.crossover(p1.brain, p2.brain);
    }
    return genome.mutate(CONFIG.mutationRate, CONFIG.mutationStrength);
  }
}
