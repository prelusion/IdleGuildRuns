import type { MobDef } from "../mobs/mobTypes";

export type UnitKind = "mob" | "boss" | "adventurer" | "worker";
export type Team = "enemy" | "ally";

export type UnitStats = {
  maxHp: number;
  hp: number;

  // Movement
  walkSpeed: number;
  runSpeed: number;

  // Combat
  aggroRange: number;
  attackRange: number;
  attackWindupMs: number;
  attackCooldownMs: number;
  damage: number;
};

export type UnitDef = {
  id: string;
  kind: UnitKind;
  team: Team;
  visuals: MobDef;
  radius: number;

  baseStats: Omit<UnitStats, "hp">;
};
