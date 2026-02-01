export type Dir4 = "down" | "up" | "left" | "right";
export type MobAction = string; // allow custom actions like "walk_attack", "run_attack", "attack2", etc.

export const TypeMobs = {
  BEHOLDER: "beholder",
  DEMON: "demon",
  ENT: "ent",
  GHOST: "ghost",
  GNOLL: "gnoll",
  GOBLIN: "goblin",
  GOLEM: "golem",
  IMP: "imp",
  LICH: "lich",
  LIZARDMAN: "lizardman",
  MUSHROOM: "mushroom",
  ORC: "orc",
  PLANT: "plant",
  RAT: "rat",
  SKELETON: "skeleton",
  SLIME: "slime",
  SLIMEBOSS: "slime_boss",
  VAMPIRES: "vampires",
  ZOMBIE: "zombie",
}

export type LayerId =
  | "body"
  | "shadow"
  | "head"
  | "spear"
  | "spear_back"
  | "fire"
  | "red"
  | "swing"
  | "smoke"
  | "shade"
  | "leaves"
  | "bones"
  | "fire_soot"
  | "magic"
  | "cup"
  | "arms"
  | "sword"
  | "sword_back"
  | "sword_front"
  | "brown"
  | "back"
  | "death_effects"
  | "image"
  | "attack";  // Verify if attack is really needed here..;

export type MobLayerDef = {
  id: LayerId;
  depthOffset: number;
};

export type MobActionDef = {
  /** folder name under mob root, e.g. "walk", "run_attack", "attack2" */
  folder: string;
  /** per-layer filename, e.g. { body:"body.png", shadow:"shadow.png" } */
  files: Partial<Record<LayerId, string>>;
  /** if omitted we assume 4 rows */
  rows?: number;
  /** optional override for columns (frames per row) */
  cols?: number;
  /** fps override */
  fps?: number;
};

export type MobDef = {
  id: string;        // "slime1"
  basePath: string;  // "/assets/mobs/slime/slime1"
  frameW: number;
  frameH: number;
  cols: number;      // default columns if action doesn't override
  scale?: number;    // e.g. 2 for 64->128 world
  actions: Record<string, MobActionDef>;
  layers: MobLayerDef[]; // draw order
  fpsDefault: number;
};

export const DIR_ROW: Record<Dir4, number> = {
  down: 0,
  up: 1,
  left: 2,
  right: 3,
};
