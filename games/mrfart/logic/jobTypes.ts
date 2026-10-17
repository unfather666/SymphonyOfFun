// Shapes for job content and running jobs.
export interface StepDef {
  readonly verb: string;
  readonly zone: 'subject' | 'place' | 'origin' | 'tree';
  readonly leash?: boolean;
  /** Soft timer in seconds: shown on the job card, never fails the job. */
  readonly timerSoft?: number;
  /** Seconds (hold, wait) or presses (strike). */
  readonly n?: number;
  /** hold: stand still, or hold A. */
  readonly mode?: 'still' | 'press';
}
export interface JobTypeDef {
  readonly id: string;
  readonly textKey: string;
  readonly spawn: 'origin' | 'place' | 'tree';
  readonly maxCount: number;
  readonly subjectTags: readonly string[];
  readonly places: readonly string[];
  readonly steps: readonly StepDef[];
  readonly minTier?: number;
  /** The subject runs from the player until caught. */
  readonly runaway?: boolean;
}
export interface ModifierDef {
  readonly id: string;
  readonly minTier: number;
  readonly cond: 'quiet' | 'time' | 'nodrop' | 'fire';
  readonly bonus: number;
  readonly limitMs: number;
}
export interface SubjectDef {
  readonly id: string;
  readonly tier: number;
  readonly r: number;
  readonly mass: number;
  readonly damping: number;
  readonly speed: number;
  /** Speed multiplier while carried; 0 = cannot be carried. */
  readonly carryMult: number;
  readonly leash: number;
  readonly followDist: number;
  readonly tug: number;
  readonly colour: number;
  readonly tags: readonly string[];
}
export interface PlaceDef {
  readonly id: string;
  readonly kind: 'cell' | 'across' | 'tree' | 'bus_stop' | 'origin';
  readonly cell: string;
}
export interface Zone {
  x: number;
  y: number;
  r: number;
}
/** What the board shows before a job is taken (indices into the content lists). */
export interface JobOffer {
  type: number;
  subject: number;
  place: number;
  count: number;
  /** Modifier index or -1. */
  mod: number;
  tier: number;
  /** Cell index the job starts from. */
  origin: number;
}

export const SS_NONE = 0, SS_IDLE = 1, SS_FOLLOW = 2, SS_CARRIED = 3, SS_TREE = 4, SS_DONE = 5, SS_FLEE = 6;

export interface Subject {
  idx: number;
  active: boolean;
  def: SubjectDef | null;
  x: number; y: number; px: number; py: number;
  h: number;
  state: number;
  leash: number;
  /** Game-clock ms of the next random tug. */
  tugAt: number;
  tugX: number;
  tugY: number;
  tugUntil: number;
  /** Game-clock ms the subject is removed after the job (0 = not leaving). */
  leaveAt: number;
  /** Where a follower is heading and when to choose again (game-clock ms). */
  aimX: number;
  aimY: number;
  aimUntil: number;
}

export interface Job {
  id: number;
  offer: JobOffer;
  step: number;
  startedAt: number;
  stepStartedAt: number;
  origin: Zone;
  place: Zone;
  tree: Zone;
  /** Subject slots used by this job. */
  subjects: number[];
  /** Game-clock ms since every subject has been out of reach, -1 when fine. */
  lostSince: number;
  /** Loud or squeaky farts during the job, and accidental drops (for modifier bonuses). */
  noisy: number;
  drops: number;
  /** Strike presses so far in the current step. */
  hits: number;
}
