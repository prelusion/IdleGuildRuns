type Rank = "bronze" | "silver" | "iron" | "gold" | "platinum" | "emerald" | "diamond" | "master" | "demon"
type Type = "cloth" | "leather" | "mail" | "plate";
type quality  = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface Item {
  quality: quality
  name: string;
  src: string
  effect?: () => void;
  monetaryValue: number;
  value: number;
}

export interface Accessory extends Item {
  primaryStats: Stats
  secondaryStats: SecondaryStats
}

export interface Gear extends Item {
  rank: Rank
  type: Type
  armor: number
  primaryStats: Stats
  secondaryStats: SecondaryStats
}

export interface Weapon extends Item {
  rank: Rank
  fromDamage: number;
  toDamage: number;
  parry: number;
  block: number;
  range: number;
  armor: number;
  primaryStats: Stats;
  secondaryStats: SecondaryStats;
}

type Stats = {
  stamina: number;
  strength: number;
  intellect: number;
  agility: number;
  spirit: number;
}

type SecondaryStats = {
  leech: number;
  speed: number;
  haste: number;
  crit: number;
  resistances: Resistances
}

type Resistances = {
  fireResistance: number;
  frostResistance: number;
  arcaneResistance: number
  shadowResistance: number;
  poisonResistance: number;
  stunResistance: number;
}