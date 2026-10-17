// Codes shared by rig resolution and combat: projectile kinds, elements, on-hit and on-kill effect masks.
export const KIND = { bolt: 0, beam: 1, arc: 2, shell: 3, wave: 4, drone: 5 } as const;
export const PROJECTILES = ['bolt', 'beam', 'arc', 'shell', 'wave', 'drone'] as const;
export const ELEMENTS = ['none', 'void', 'fire', 'ice', 'psi'] as const;

export const HIT_BURN = 1;
export const HIT_FREEZE = 2;
export const HIT_PULL = 4;
export const HIT_CHAIN = 8;
export const HIT_BLIND = 16;
export const HIT_NAMES = ['burn', 'freeze', 'pull', 'chain', 'blind'] as const;

export const KILL_HEAL = 1;
export const KILL_AMMO = 2;
export const KILL_LIGHT = 4;
export const KILL_NAMES = ['heal', 'ammo', 'light'] as const;

/** An element adds the matching on-hit effect: fire burns, ice freezes, void pulls, psi blinds. */
export const ELEMENT_HIT = [0, HIT_PULL, HIT_BURN, HIT_FREEZE, HIT_BLIND] as const;
