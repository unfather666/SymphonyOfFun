// Feedback cue codes the sim queues for the wiring layer (sound, shake). Plain numbers, never objects.
export const CUE = {
  shotBolt: 1,
  shotBeam: 2,
  shotArc: 3,
  shotShell: 4,
  shotWave: 5,
  hit: 6,
  kill: 7,
  pickup: 8,
  hurt: 9,
  dash: 10,
  flare: 11,
  dead: 12,
  cleared: 13,
  whisper: 14,
  heartbeat: 15,
  bossRoar: 16,
  invertWarn: 17,
  blackout: 18,
} as const;
export const OUT_CAP = 64;
