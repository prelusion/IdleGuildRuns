export type Rank =
  | "bronze"
  | "silver"
  | "iron"
  | "gold"
  | "platinum"
  | "emerald"
  | "diamond"
  | "master"
  | "demon";

export type ArmorType = "cloth" | "leather" | "mail" | "plate";
export type AllArmorType = "all" | "cloth" | "leather" | "mail" | "plate";

export type Quality =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";
export type AllQuality =
  | "all"
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type ItemLike = Item | Gear | Weapon | Accessory;
export type ItemLikeOrNull = ItemLike | null;

export const accessories = ["necklace", "ring", "trinket"] as const;
export const armor = ["belt", "bracers", "chest", "feet", "helmet", "trousers"] as const;
export const weapons = ["axe", "bow", "crossbow", "dagger", "mace", "shield", "staff", "sword", "tome"] as const;

export const TwoHanded = ["axe", "bow", "crossbow", "mace", "staff"]
export const OneHanded = ["dagger", "sword"]
export const OffHanded = ["shield", "tome"]

export type AccessoryKind = (typeof accessories)[number];
export type ArmorKind = (typeof armor)[number];
export type WeaponKind = (typeof weapons)[number];

export type EquipmentSlot =
  | "helmet"
  | "necklace"
  | "chest"
  | "bracers"
  | "gloves"
  | "belt"
  | "trousers"
  | "feet"
  | "ring1"
  | "ring2"
  | "trinket1"
  | "trinket2"
  | "leftHand"
  | "rightHand";


/* =========================
   RULES
========================= */
export type EquipSlotUI =
  | "helmet" | "necklace" | "chest" | "bracers" | "gloves" | "belt" | "feet"| "trousers"
  | "ring1" | "ring2" | "trinket1" | "trinket2"
  | "leftHand" | "rightHand";

export type EquipSlot =
  | "helmet" | "necklace" | "ring" | "trinket" | "chest" | "bracers" | "trousers" | "gloves" | "belt" | "feet" | "axe" | "bow" | "crossbow" | "dagger" | "mace" | "shield" | "staff" | "sword" | "tome"



/* =========================
   STATS
========================= */

export type Stats = {
  stamina: number;
  strength: number;
  intellect: number;
  agility: number;
  spirit: number;
};

export type Resistances = {
  fireResistance: number;
  frostResistance: number;
  arcaneResistance: number;
  shadowResistance: number;
  poisonResistance: number;
  stunResistance: number;
};

export type SecondaryStats = {
  leech: number;
  speed: number;
  haste: number;
  crit: number;
  resistances: Resistances;
};

export interface Item {
  slot: EquipSlot,
  quality: Quality
  name: string;
  src: string
  effect?: () => void;
  monetaryValue: number;
  value: number;
}

/* =========================
   EQUIPPABLE ITEMS
========================= */

export interface Accessory extends Item {
  primaryStats: Stats;
  secondaryStats: SecondaryStats;
}

export interface Gear extends Item {
  rank: Rank;
  type: ArmorType;
  armor: number;

  primaryStats: Stats;
  secondaryStats: SecondaryStats;
}

export interface Weapon extends Item {
  rank: Rank;

  fromDamage: number;
  toDamage: number;

  parry: number;
  block: number;
  range: number;
  armor: number;

  primaryStats: Stats;
  secondaryStats: SecondaryStats;
}

export function isWeapon(item: ItemLike): item is Weapon {
  return "fromDamage" in item && "toDamage" in item && "parry" in item && "block" in item && "range" in item;
}

export function isGear(item: ItemLike): item is Gear {
  return "armor" in item && "rank" in item && "type" in item && !isWeapon(item);
}

export function hasStats(x: unknown): x is Gear | Weapon | Accessory {
  return (
    !!x &&
    typeof x === "object" &&
    "primaryStats" in (x as any) &&
    "secondaryStats" in (x as any)
  );
}