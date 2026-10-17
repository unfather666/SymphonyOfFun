// content/rules.json: every cap and tuning number. Validated at load; a bad number stops the game start with a plain message.
export interface Rules {
  world: { dayMs: number; startHour: number };
  player: { speed: number; runMult: number; radius: number; mass: number; damping: number; gain: number };
  people: { speed: number; radius: number; mass: number; damping: number; gain: number; dwellMinMs: number; dwellMaxMs: number; homeDwellMinMs: number; homeDwellMaxMs: number };
  stream: { every: number; near: number; far: number };
  items: { max: number; findChance: number; cursedChance: number; stock: number };
  ending: { cursedHeld: number; forceNeeded: number; loudInShop: number; tasksMayor: number; tasksWin: number; shopRepeat: number };
  meter: {
    max: number; perPx: number; runMult: number; randomMinMs: number; randomMaxMs: number; randomDiv: number;
    stressFartAbove: number; stressRate: number; clenchRate: number; clenchMax: number; clenchBonus: number; clenchBonusMs: number;
    clenchMinMs: number; balloonMs: number;
  };
  stress: { max: number; perIntol: number; lowRepBelow: number; lowRepRate: number; aloneDecay: number; watchRadius: number; clenchRate: number };
  witness: {
    pushedMult: number; forget: number; settleDiv: number; startledMs: number; fleeMs: number; fleeMult: number; fleeSee: number;
    maxIntol: number; watchEvery: number;
  };
  reputation: { start: number; max: number; fleeBelow: number };
  jobs: {
    offers: number; tierEvery: number; maxTier: number; mixAfter: number; lostDist: number; lostMs: number; repBase: number; coinBase: number;
    reach: number; zoneR: number; boardR: number; countChance2: number; countChance3: number; originCells: number; spread: number;
    maxSubjects: number; despawnMs: number; dropDist: number; modChance: number; fireStress: number; fireRange: number; pushSlack: number; pushMult: number; aimMs: number; fleeRange: number; fleeMult: number;
  };
  fart: { forceScale: number; falloff: number; maxForce: number; originBack: number; cooldownMs: number };
  caps: {
    bodies: number; bodiesReduced: number; pieces: number; piecesReduced: number; puffs: number; puffsReduced: number;
    joints: number; pieceLifeMs: number; piecesPerBreak: number; subjects: number;
  };
}

type Range = readonly [number, number];
/** path → [min, max]. Adding a rule means adding a line here. */
const LIMITS: Record<string, Range> = {
  'world.dayMs': [10000, 3600000], 'world.startHour': [0, 23],
  'player.speed': [10, 200], 'player.runMult': [1, 4], 'player.radius': [2, 12], 'player.mass': [0.1, 20], 'player.damping': [0, 40], 'player.gain': [0.01, 1],
  'people.speed': [5, 120], 'people.radius': [2, 12], 'people.mass': [0.1, 20], 'people.damping': [0, 40], 'people.gain': [0.01, 1],
  'meter.max': [10, 1000], 'meter.perPx': [0, 1], 'meter.runMult': [1, 10], 'meter.randomMinMs': [100, 60000], 'meter.randomMaxMs': [100, 60000], 'meter.randomDiv': [1, 10000],
  'meter.stressFartAbove': [0, 100], 'meter.stressRate': [0, 10], 'meter.clenchRate': [0, 50], 'meter.clenchMax': [100, 500], 'meter.clenchBonus': [0, 5],
  'meter.clenchBonusMs': [100, 60000], 'meter.clenchMinMs': [0, 5000], 'meter.balloonMs': [1000, 600000],
  'stress.max': [10, 1000], 'stress.perIntol': [0, 50], 'stress.lowRepBelow': [0, 100], 'stress.lowRepRate': [0, 20], 'stress.aloneDecay': [0, 50],
  'stress.watchRadius': [10, 400], 'stress.clenchRate': [0, 50],
  'witness.pushedMult': [1, 10], 'witness.forget': [0, 1], 'witness.settleDiv': [1, 1000], 'witness.startledMs': [100, 10000], 'witness.fleeMs': [100, 30000],
  'witness.fleeMult': [1, 5], 'witness.fleeSee': [10, 400], 'witness.maxIntol': [1, 255], 'witness.watchEvery': [1, 60],
  'reputation.start': [1, 100], 'reputation.max': [1, 100], 'reputation.fleeBelow': [0, 100],
  'jobs.offers': [1, 6], 'jobs.tierEvery': [1, 1000], 'jobs.maxTier': [0, 4], 'jobs.mixAfter': [1, 5000], 'jobs.lostDist': [50, 2000], 'jobs.lostMs': [1000, 600000],
  'jobs.repBase': [0, 20], 'jobs.coinBase': [0, 1000], 'jobs.reach': [4, 80], 'jobs.zoneR': [8, 100], 'jobs.boardR': [8, 100], 'jobs.countChance2': [0, 1],
  'jobs.countChance3': [0, 1], 'jobs.originCells': [1, 24], 'jobs.spread': [0, 60], 'jobs.maxSubjects': [1, 16], 'jobs.despawnMs': [0, 30000], 'jobs.dropDist': [0, 40],
  'caps.subjects': [1, 16],
  'people.dwellMinMs': [0, 600000], 'people.dwellMaxMs': [0, 600000], 'people.homeDwellMinMs': [0, 600000], 'people.homeDwellMaxMs': [0, 600000],
  'stream.every': [1, 600], 'stream.near': [50, 5000], 'stream.far': [50, 5000], 'items.max': [1, 12], 'items.findChance': [0, 1], 'items.cursedChance': [0, 1], 'items.stock': [1, 6],
  'jobs.modChance': [0, 1], 'jobs.fireStress': [0, 50], 'jobs.fireRange': [1, 200], 'jobs.pushSlack': [0, 60], 'jobs.pushMult': [0.1, 2], 'jobs.aimMs': [16, 2000], 'jobs.fleeRange': [10, 400], 'jobs.fleeMult': [0.5, 3],
  'ending.cursedHeld': [1, 12], 'ending.forceNeeded': [1, 5000], 'ending.loudInShop': [1, 100], 'ending.tasksMayor': [1, 10000], 'ending.tasksWin': [1, 10000], 'ending.shopRepeat': [0, 1],
  'fart.forceScale': [0.1, 50], 'fart.falloff': [0, 4], 'fart.maxForce': [100, 5000], 'fart.originBack': [0, 20], 'fart.cooldownMs': [0, 10000],
  'caps.bodies': [8, 512], 'caps.bodiesReduced': [8, 512], 'caps.pieces': [0, 1024], 'caps.piecesReduced': [0, 1024], 'caps.puffs': [0, 1024],
  'caps.puffsReduced': [0, 1024], 'caps.joints': [0, 256], 'caps.pieceLifeMs': [100, 30000], 'caps.piecesPerBreak': [0, 16],
};

/** Plain-English problems with a rules object; empty means fine. */
export function rulesProblems(raw: unknown, limits: Record<string, Range> = LIMITS): string[] {
  const out: string[] = [];
  for (const path of Object.keys(limits)) {
    let v: unknown = raw;
    for (const part of path.split('.')) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[part] : undefined;
    const [min, max] = limits[path]!;
    if (typeof v !== 'number' || !Number.isFinite(v)) out.push(`rules.json: "${path}" must be a number.`);
    else if (v < min || v > max) out.push(`rules.json: "${path}" is ${v}, allowed ${min} to ${max}.`);
  }
  return out;
}

export function parseRules(raw: unknown): Rules {
  const problems = rulesProblems(raw);
  if (problems.length) throw new Error(problems.join(' '));
  return raw as Rules;
}
