// content/rules.json: every cap and tuning number. Validated at load; a bad number stops the game start with a plain message.
export interface Rules {
  world: { dayMs: number; startHour: number };
  player: { speed: number; runMult: number; radius: number; mass: number; damping: number; gain: number };
  people: { speed: number; radius: number; mass: number; damping: number; gain: number };
  meter: { max: number; perPx: number; runMult: number; randomMinMs: number; randomMaxMs: number; randomDiv: number };
  fart: { forceScale: number; falloff: number; maxForce: number; originBack: number; cooldownMs: number };
  caps: {
    bodies: number; bodiesReduced: number; pieces: number; piecesReduced: number; puffs: number; puffsReduced: number;
    joints: number; pieceLifeMs: number; piecesPerBreak: number;
  };
}

type Range = readonly [number, number];
/** path → [min, max]. Adding a rule means adding a line here. */
const LIMITS: Record<string, Range> = {
  'world.dayMs': [10000, 3600000], 'world.startHour': [0, 23],
  'player.speed': [10, 200], 'player.runMult': [1, 4], 'player.radius': [2, 12], 'player.mass': [0.1, 20], 'player.damping': [0, 40], 'player.gain': [0.01, 1],
  'people.speed': [5, 120], 'people.radius': [2, 12], 'people.mass': [0.1, 20], 'people.damping': [0, 40], 'people.gain': [0.01, 1],
  'meter.max': [10, 1000], 'meter.perPx': [0, 1], 'meter.runMult': [1, 10], 'meter.randomMinMs': [100, 60000], 'meter.randomMaxMs': [100, 60000], 'meter.randomDiv': [1, 10000],
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
