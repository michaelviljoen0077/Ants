# Neural Ant Wars

Evolving ant colonies waging war over a shared world — real stigmergy, real
neuroevolution, rendered as glowing pheromone networks on a full-screen canvas.

```bash
npm install
npm start        # http://localhost:3000
```

Tip: `http://localhost:3000/?ff=8000` fast-forwards 8000 ticks before the
first frame, so you load straight into a mature world with trail networks
and wars already underway.

## What you're looking at

Each colony's glow is its **pheromone field**, not a decoration:

- **Bright trail color** — "food this way" pheromone, laid by ants carrying
  cargo home. Trails reinforce where hauling succeeds and evaporate where it
  doesn't, so the braided networks you see are the colony's collective memory
  of the map.
- **Dim warm haze** — "home this way" pheromone, laid by outbound ants.
  Loaded foragers climb this gradient to get back to the nest.
- **Red flashes** — alarm pheromone. Combat and deaths splash it; soldiers
  march *up* the alarm gradient (recruitment), workers run *down* it (panic).

Every ant carries a 12→10→4 neural network (tanh, flat `Float32Array`s).
Instinct handles the stigmergy basics; the brain modulates it — how much to
trust trails, how hard to explore, turning bias, pace. When a colony spawns
an ant, the parent genome is chosen by **fitness-weighted lottery** within
the caste (occasional two-parent crossover), then mutated. Good foragers and
killers reproduce; the colony's behavior drifts measurably over generations.

### Castes

| Caste | Role |
|---|---|
| **Worker** | Hauls food, builds the trail network, panics at alarm |
| **Soldier** | Patrols, rallies to alarm, and — when the colony is rich — marches on the nearest rival nest |
| **Scout** | Fast, far-sighted, avoids saturated trails (frontier-seeking), marks finds to recruit workers |

The queen policy re-balances caste ratios from colony state: alarm at the
nest breeds soldiers, starving income breeds scouts.

### The world

Day/night cycle (ants slow at night, trails glow in the dark), drifting rain
that accelerates food regrowth, rock formations, food that grows in clusters
and decays — and dead ants drop their cargo as scavengeable food, so battle
sites become feeding grounds. A wiped-out colony re-seeds a small brood from
its champion genomes (hall-of-fame brains per caste).

## Controls

| Input | Action |
|---|---|
| **Click an ant** | Inspect it — live neural-net view with real-time activations |
| **Right-click** | Drop a food cluster (start a gold rush, or bait a war) |
| Drag / scroll | Pan / zoom |
| `Space`, `1–4` | Pause, speed 1×/2×/4×/8× |
| `F` | Follow the selected ant |
| `T` | Toggle trail rendering |
| `R` | Reset camera |

## Architecture

```
src/
├── sim/
│   ├── config.ts      # every tuning knob + colony color themes
│   ├── Brain.ts       # flat typed-array NN: forward / mutate / crossover
│   ├── Field.ts       # pheromone channel: deposit, sample, decay, diffusion
│   ├── SpatialHash.ts # uniform-grid neighbour queries
│   ├── World.ts       # terrain, food clusters, regrowth
│   ├── Ant.ts         # agent state + brain I/O contract
│   ├── Colony.ts      # behavior, combat, breeding, queen policy
│   ├── Simulation.ts  # tick loop, day/night, weather, raid targeting
│   └── Renderer.ts    # layered canvas: baked soil → night → additive
│                      #   pheromone glow → entities → rain + vignette
├── ui/
│   ├── BrainViz.tsx   # live network inspector
│   ├── Sparkline.tsx  # colony history charts
│   └── ui.css
├── App.tsx            # canvas loop, camera, input, HUD
└── legacy/            # the previous implementation, kept for reference
```

Performance notes: pheromones live in `Float32Array` fields (deposit/sample
are array indexing), neighbour lookups go through a spatial hash instead of
O(n²) scans, ants render as batched canvas paths (one fill per colony), and
the trail glow is a single low-res `ImageData` upscaled with bilinear
smoothing and `lighter` compositing.
