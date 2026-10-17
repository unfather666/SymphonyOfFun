// Player progress: owned items, rig presets, points. Owns the save section and the rig menu. Wiring only; the rules are in logic/rig, unlocks, saveData.
import type { CoreContext } from '../../src/core/api';
import type { Content } from './content/load';
import { DEFAULT_SHOT } from './logic/shots';
import { PRESETS, SLOTS, activeItems, cyclePreset, giveItem, newProgress, placeItem, resolveRig, type ItemDef, type Progress } from './logic/rig';
import { PROGRESS_VERSION, sanitizeProgress } from './logic/saveData';
import { dropPool, slotsFor } from './logic/unlocks';
import { setShot } from './logic/world';
import type { World } from './logic/types';

const SLOT = 'main';

export interface HudRig {
  slots: Array<ItemDef | null>;
  unlocked: number;
  active: number;
}

export interface ProgressControl {
  progress: Progress;
  hud: HudRig;
  unlockedSlots(): number;
  /** Highest level cleared so far (0 = none). */
  highestCleared(): number;
  openRig(): void;
  cycle(dir: number): void;
  /** Re-resolve the active preset into the world's shot and refresh the HUD info. */
  apply(w: World): void;
  /** Item ordinals the world's elites may drop right now. */
  drops(): number[];
  give(ordinal: number): void;
  save(): void;
}

export function createProgressControl(ctx: CoreContext, content: Content, getWorld: () => World): ProgressControl {
  const byId = new Map(content.items.map((i) => [i.id, i]));
  const known = new Set(byId.keys());
  const start = content.unlocks.startItems.filter((id) => known.has(id));
  let progress = newProgress(start);
  let cheatSlots = 0;
  const hud: HudRig = { slots: new Array<ItemDef | null>(SLOTS).fill(null), unlocked: 1, active: 0 };

  ctx.saves.register<Progress>({
    key: 'progress',
    version: PROGRESS_VERSION,
    serialize: () => progress,
    deserialize: (d) => {
      progress = sanitizeProgress(d, known, start);
    },
    migrate: (d) => d as Progress,
  });
  const loaded = ctx.saves.load(SLOT);
  if (!loaded.ok && ctx.saves.has(SLOT)) ctx.log.warn('save-load', ctx.strings('load_problem', { msg: loaded.message }));

  const ctl: ProgressControl = {
    get progress() {
      return progress;
    },
    hud,
    unlockedSlots: () => Math.max(cheatSlots, slotsFor(ctl.highestCleared(), content.unlocks)),
    highestCleared: () => 0,
    save() {
      const r = ctx.saves.save(SLOT);
      if (!r.ok) ctx.log.warn('save-write', r.message);
    },
    apply(w) {
      const n = ctl.unlockedSlots();
      setShot(w, resolveRig(activeItems(progress, n, byId), DEFAULT_SHOT(w.rules).shots[0]!));
      hud.unlocked = n;
      hud.active = progress.active;
      const list = progress.presets[progress.active]!;
      for (let s = 0; s < SLOTS; s++) hud.slots[s] = list[s] ? (byId.get(list[s]!) ?? null) : null;
    },
    cycle(dir) {
      cyclePreset(progress, dir);
      ctl.apply(getWorld());
      ctl.save();
    },
    drops: () => dropPool(content.items, progress.ownedItems, progress.totalPoints, ctl.highestCleared(), content.unlocks),
    give(ordinal) {
      const it = content.items[ordinal];
      if (!it || !giveItem(progress, it.id)) return;
      ctx.ui.notice(ctx.strings('found_item', { name: ctx.strings(`item_${it.id}`) }), 2200);
      ctl.save();
    },
    openRig() {
      let handle: { close(): void } | null = null;
      const name = (id: string | null) => (id ? ctx.strings(`item_${id}`) : ctx.strings('rig_empty'));
      const finish = () => {
        handle?.close();
        handle = null;
        ctl.apply(getWorld());
        ctl.save();
      };
      const pickFor = (slot: number) => {
        handle?.close();
        const cur = progress.presets[progress.active]!;
        const items: Array<{ label: string; disabled?: boolean; onPick(): void }> = [
          { label: ctx.strings('rig_clear'), onPick: () => { placeItem(progress, ctl.unlockedSlots(), progress.active, slot, null); top(); } },
        ];
        for (const id of progress.ownedItems) {
          const it = byId.get(id)!;
          const used = cur.includes(id) && cur[slot] !== id;
          items.push({
            label: `${ctx.strings(used ? 'rig_in_use' : 'item_' + id, { name: name(id) })} ${ctx.strings('kind_' + it.kind)}`,
            disabled: used,
            onPick: () => { placeItem(progress, ctl.unlockedSlots(), progress.active, slot, id); top(); },
          });
        }
        handle = ctx.ui.menu({ title: ctx.strings('rig_pick', { n: slot + 1 }), items, onCancel: top });
      };
      const top = () => {
        handle?.close();
        const n = ctl.unlockedSlots();
        const cur = progress.presets[progress.active]!;
        const items: Array<{ label: string; disabled?: boolean; onPick(): void }> = [
          { label: ctx.strings('rig_preset', { n: progress.active + 1 }), onPick: () => { progress.active = (progress.active + 1) % PRESETS; top(); } },
        ];
        for (let s = 0; s < SLOTS; s++) {
          const need = content.unlocks.slotLevels[s - 1] ?? 0;
          items.push(
            s < n
              ? { label: ctx.strings('rig_slot', { n: s + 1, name: name(cur[s] ?? null) }), onPick: () => pickFor(s) }
              : { label: ctx.strings('rig_locked', { n: s + 1, l: need }), disabled: true, onPick: () => {} },
          );
        }
        items.push({ label: ctx.strings('rig_done'), onPick: finish });
        handle = ctx.ui.menu({ title: ctx.strings('rig_title'), items, onCancel: finish });
      };
      top();
    },
  };

  ctx.events.on('dev:cheat', (p) => {
    if (p.id === 'give_all') for (let i = 0; i < content.items.length; i++) giveItem(progress, content.items[i]!.id);
    else if (p.id === 'slots6') cheatSlots = SLOTS;
    else if (p.id === 'madness') getWorld().madness = 97;
    else if (p.id === 'madness3') getWorld().madness = 65;
    ctl.apply(getWorld());
  });
  return ctl;
}
