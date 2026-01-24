import type { LayerId, MobActionDef, MobDef } from "./mobTypes";
import { TypeMobs } from "./mobTypes";

type Pattern = {
  family: string;          // "slime"
  variants: string[];      // ["slime1","slime2",...]
  frameW?: number;
  frameH?: number;
  cols?: number;
  scale?: number;
  fpsDefault?: number;
  layers: { id: LayerId; depthOffset: number }[];
  actions: Record<string, MobActionDef>;
};

/** Helper: create numbered variants like slime1..slime9 */
function numVariants(prefix: string, from: number, to: number) {
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(`${prefix}${i}`);
  return out;
}

/** Helper: standard 64x64 sheet, 6 columns, scaled to 128-tile world */
function baseDef(id: string, basePath: string, layers: MobDef["layers"], actions: MobDef["actions"], scale = 2, fpsDefault = 10, frameW = 64, frameH = 64, cols = 6): MobDef {
  return { id, basePath, frameW, frameH, cols, scale, layers, actions, fpsDefault };
}

/** Helper: quick action with same filenames across actions */
function act(folder: string, files: Partial<Record<LayerId, string>>, fps?: number, cols?: number): MobActionDef {
  return { folder, files, fps, cols };
}

/** Build a registry from patterns */
function build(patterns: Pattern[]): Record<string, MobDef> {
  const out: Record<string, MobDef> = {};
  for (const p of patterns) {
    const frameW = p.frameW ?? 64;
    const frameH = p.frameH ?? 64;
    const cols = p.cols ?? 6;
    const scale = p.scale ?? 8;
    const fpsDefault = p.fpsDefault ?? 10;

    for (const v of p.variants) {
      out[v] = {
        id: v,
        basePath: `assets/mobs/${p.family}/${v}`,
        frameW,
        frameH,
        cols,
        scale,
        fpsDefault,
        layers: p.layers,
        actions: p.actions,
      };
    }
  }
  return out;
}

/**
 * PATTERNS
 * Notes:
 * - If a layer file doesn't exist for an action, omit it (no spritesheet loaded/animated for that layer/action).
 * - Weird filename variations are handled explicitly (bpdy.png, red.png, etc.)
 */

export const MOBS: Record<string, MobDef> = build([
  // ---------------- beholder1..3 ----------------
  {
    family: TypeMobs.BEHOLDER,
    variants: ["beholder1", "beholder2", "beholder3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "fire", depthOffset: 2 },
      { id: "red", depthOffset: 3 },
      { id: "swing", depthOffset: 4 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", shadow: "shadow.png", swing: "swing.png" }, 12),
      attack: act("attack", { body: "body.png", shadow: "shadow.png", fire: "fire.png" }, 12),
      hurt: act("hurt", { body: "body.png", shadow: "shadow.png", red: "red.png" }, 10),
      // beholder1 death has typo in your list: "bpdy.png" — support both by using body.png in folder normally
      death: act("death", { body: "body.png", shadow: "shadow.png", red: "red.png" }, 8),
    },
  },

  // ---------------- demon1..3 ----------------
  {
    family: TypeMobs.DEMON,
    variants: ["demon1", "demon2", "demon3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "spear", depthOffset: 3 },
      { id: "fire", depthOffset: 4 },
      { id: "red", depthOffset: 5 },
      { id: "death_effects", depthOffset: 6 },
      { id: "back", depthOffset: 1 }, // demon1 run uses back.png sometimes
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", spear: "spear.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", spear: "spear.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", spear: "spear.png", shadow: "shadow.png", back: "back.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", spear: "spear.png", shadow: "shadow.png", fire: "fire.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", spear: "spear.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", spear: "spear.png", shadow: "shadow.png", death_effects: "death_effects.png" }, 8),
    },
  },

  // ---------------- ent1..3 ----------------
  {
    family: TypeMobs.ENT,
    variants: ["ent1", "ent2", "ent3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "leaves", depthOffset: 2 },
      { id: "red", depthOffset: 3 },
      { id: "swing", depthOffset: 4 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", shadow: "shadow.png", leaves: "leaves.png" }, 8),
      walk: act("walk", { body: "body.png", shadow: "shadow.png", leaves: "leaves.png" }, 10),
      run: act("run", { body: "body.png", shadow: "shadow.png", leaves: "leaves.png" }, 12),
      attack: act("attack", { body: "body.png", shadow: "shadow.png", leaves: "leaves.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", shadow: "shadow.png", leaves: "leaves.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", shadow: "shadow.png", leaves: "leaves.png" }, 8),
    },
  },

  // ---------------- ghost1..3 ----------------
  {
    family: TypeMobs.GHOST,
    variants: ["ghost1", "ghost2", "ghost3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "shade", depthOffset: 1 },
      { id: "body", depthOffset: 2 },
      { id: "head", depthOffset: 3 },
      { id: "attack", depthOffset: 4 } as any, // not in LayerId list; we won't use it directly
      { id: "swing", depthOffset: 5 },
      { id: "red", depthOffset: 6 },
      { id: "smoke", depthOffset: 7 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png", swing: "swing.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", shade: "shade.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png", smoke: "smoke.png" }, 8),
    },
  },

  // ---------------- gnoll1..3 ----------------
  {
    family: TypeMobs.GNOLL,
    variants: ["gnoll1", "gnoll2", "gnoll3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "swing", depthOffset: 3 },
      { id: "red", depthOffset: 4 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 8),
      // gnoll1 special death naming in your list (death_body.png etc). If your folder really uses these, add:
      death_alt: act("death", { body: "death_body.png", head: "death_head.png", shadow: "death_shadow.png", red: "death_red.png" }, 8),
    },
  },

  // ---------------- goblin2..3 (standard) ----------------
  {
    family: TypeMobs.GOBLIN,
    variants: ["goblin2", "goblin3"],
    layers: [
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "spear_back", depthOffset: 3 },
      { id: "spear", depthOffset: 4 }, // use for spear-front
      { id: "swing", depthOffset: 5 },
      { id: "red", depthOffset: 6 }, // red
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", spear: "spear-front.png", spear_back: "spear_back.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", spear: "spear-front.png", spear_back: "spear_back.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", spear: "spear-front.png", spear_back: "spear_back.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", spear: "spear-front.png", spear_back: "spear_back.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", spear: "spear-front.png", spear_back: "spear_back.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", spear: "spear-front.png", spear_back: "spear_back.png", red: "red.png" }, 8),
      run_attack: act("run_attack", { body: "body.png", head: "head.png", spear: "spear_front.png", spear_back: "spear_back.png", swing: "swing.png" }, 12),
      walk_attack: act("walk_attack", { body: "body.png", head: "head.png", spear: "spear-front.png", spear_back: "spear_back.png", swing: "swing.png" }, 12),
    },
  },

  // ---------------- golem1..3 ----------------
  {
    family: TypeMobs.GOLEM,
    variants: ["golem1", "golem2", "golem3"],
    layers: [
      { id: "body", depthOffset: 1 },
      { id: "arms", depthOffset: 2 },
      { id: "head", depthOffset: 3 },
      { id: "swing", depthOffset: 4 },
      { id: "red", depthOffset: 5 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", arms: "arms.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", red: "red.png" }, 8),
    },
  },

  // ---------------- imp1..3 ----------------
  {
    family: TypeMobs.IMP,
    variants: ["imp1", "imp2", "imp3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "fire", depthOffset: 3 },
      { id: "swing", depthOffset: 4 },
      { id: "bones", depthOffset: 5 },
      { id: "fire_soot", depthOffset: 6 },
      { id: "red", depthOffset: 7 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", fire: "fire.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", bones: "bones.png", fire_soot: "fire_soot.png" }, 8),
    },
  },

  // ---------------- lich1..3 ----------------
  {
    family: TypeMobs.LICH,
    variants: ["lich1", "lich2", "lich3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "fire", depthOffset: 2 },
      { id: "red", depthOffset: 3 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", shadow: "shadow.png", fire: "fire.png" }, 12),
      hurt: act("hurt", { body: "body.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", shadow: "shadow.png", red: "red.png" }, 8),
    },
  },

  // ---------------- lizardman1..3 ----------------
  {
    family: TypeMobs.LIZARDMAN,
    variants: ["lizardman1", "lizardman2", "lizardman3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "sword", depthOffset: 3 },
      { id: "swing", depthOffset: 4 },
      { id: "red", depthOffset: 5 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png", red: "red.png" }, 8),
    },
  },

  // ---------------- mushroom1..3 ----------------
  {
    family: TypeMobs.MUSHROOM,
    variants: ["mushroom1", "mushroom2", "mushroom3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "cup", depthOffset: 2 },
      { id: "swing", depthOffset: 3 },
      { id: "red", depthOffset: 4 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", cup: "cup.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", cup: "cup.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", cup: "cup.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", cup: "cup.png", shadow: "shadow.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", cup: "cup.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", cup: "cup.png", shadow: "shadow.png", red: "red.png" }, 8),
      // mushroom3 has weird idle filenames in your list: fbody.png, fcup.png, fshadow.png
      idle_alt: act("idle", { body: "fbody.png", cup: "fcup.png", shadow: "fshadow.png" }, 8),
    },
  },

  // ---------------- orc1..3 ----------------
  {
    family: TypeMobs.ORC,
    variants: ["orc1", "orc2", "orc3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "sword_back", depthOffset: 3 },
      { id: "sword_front", depthOffset: 4 },
      { id: "swing", depthOffset: 5 },
      { id: "red", depthOffset: 6 }, // red or red
      { id: "back", depthOffset: 1 }, // orc1 walk has back.png
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png", sword_back: "sword_back.png", sword_front: "sword_front.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png", sword_back: "sword_back.png", sword_front: "sword_front.png", back: "back.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png", sword_back: "sword_back.png", sword_front: "sword_front.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", sword_back: "sword_back.png", sword_front: "sword_front.png", swing: "swing.png" }, 12),
      run_attack: act("run_attack", { body: "body.png", head: "head.png", shadow: "shadow.png", sword_back: "sword_back.png", sword_front: "sword_front.png", swing: "swing.png" }, 12),
      walk_attack: act("walk_attack", { body: "body.png", head: "head.png", shadow: "shadow.png", sword_back: "sword_back.png", sword_front: "sword_front.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", sword_back: "sword_back.png", sword_front: "sword_front.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", sword_back: "sword_back.png", sword_front: "sword_front.png", red: "red.png" }, 8),

      // orc3 uses red.png
      hurt_red: act("hurt", { body: "body.png", head: "head.png", sword_back: "sword_back.png", sword_front: "sword_front.png", red: "red.png" }, 10),
      death_red: act("death", { body: "body.png", head: "head.png", sword_back: "sword_back.png", sword_front: "sword_front.png", red: "red.png" }, 8),

      // orc2 walk_attack uses prefixed filenames in your list
      walk_attack_orc2_prefixed: act("walk_attack", {
        body: "orc2_walk_attack_body.png",
        head: "orc2_walk_attack_head.png",
        swing: "orc2_walk_attack_swing.png",
        sword_back: "orc2_walk_attack_sword_back.png",
        sword_front: "orc2_walk_attack_sword_front.png",
      }, 12),
    },
  },

  // ---------------- plant1..3 ----------------
  {
    family: TypeMobs.PLANT,
    variants: ["plant1", "plant2", "plant3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "swing", depthOffset: 3 },
      { id: "red", depthOffset: 4 },
      { id: "brown", depthOffset: 5 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", brown: "brown.png" }, 8),
      // plant2 has "shadow/image.png" typo in your list — support a fallback
      run_shadow_image: act("run", { body: "body.png", head: "head.png", shadow: "image.png" }, 12),
    },
  },

  // ---------------- rat1..3 ----------------
  {
    family: TypeMobs.RAT,
    variants: ["rat1", "rat2", "rat3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "swing", depthOffset: 3 },
      { id: "red", depthOffset: 4 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 8),
    },
  },

  // ---------------- skeleton1..3 ----------------
  {
    family: TypeMobs.SKELETON,
    variants: ["skeleton1", "skeleton2", "skeleton3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "sword", depthOffset: 3 },
      { id: "swing", depthOffset: 4 },
      { id: "red", depthOffset: 5 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png", swing: "swing.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", sword: "sword.png" }, 8),
    },
  },

  // ---------------- slime1..9 ----------------
  {
    family: TypeMobs.SLIME,
    variants: numVariants("slime", 1, 9),
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "image", depthOffset: 2 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", shadow: "shadow.png" }, 12),
      hurt: act("hurt", { body: "body.png", shadow: "shadow.png", image: "image.png" }, 10),
      death: act("death", { body: "body.png", shadow: "shadow.png", image: "image.png" }, 8),
    },
  },

  // ---------------- slime_boss1..3 ----------------
  {
    family: TypeMobs.SLIMEBOSS,
    variants: ["slime_boss1", "slime_boss2", "slime_boss3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "image", depthOffset: 2 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", shadow: "shadow.png" }, 12),
      attack2: act("attack2", { body: "body.png", shadow: "shadow.png" }, 12),
      hurt: act("hurt", { body: "body.png", shadow: "shadow.png", image: "image.png" }, 10),
      death: act("death", { body: "body.png", shadow: "shadow.png", image: "image.png" }, 8),
    },
  },

  // ---------------- vampires1..3 ----------------
  {
    family: TypeMobs.VAMPIRES,
    variants: ["vampires1", "vampires2", "vampires3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "magic", depthOffset: 3 },
      { id: "red", depthOffset: 4 },
      { id: "smoke", depthOffset: 5 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", magic: "magic.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png", smoke: "smoke.png" }, 8),
    },
  },

  // ---------------- zombie1..3 ----------------
  {
    family: TypeMobs.ZOMBIE,
    variants: ["zombie1", "zombie2", "zombie3"],
    layers: [
      { id: "shadow", depthOffset: 0 },
      { id: "body", depthOffset: 1 },
      { id: "head", depthOffset: 2 },
      { id: "smoke", depthOffset: 3 },
      { id: "red", depthOffset: 4 },
    ],
    actions: {
      idle: act("idle", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 8),
      walk: act("walk", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 10),
      run: act("run", { body: "body.png", head: "head.png", shadow: "shadow.png" }, 12),
      attack: act("attack", { body: "body.png", head: "head.png", shadow: "shadow.png", smoke: "smoke.png" }, 12),
      hurt: act("hurt", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 10),
      death: act("death", { body: "body.png", head: "head.png", shadow: "shadow.png", red: "red.png" }, 8),
    },
  },
]);

/**
 * If you need to access a specific mob:
 *   const slime1 = MOBS["slime1"];
 */
