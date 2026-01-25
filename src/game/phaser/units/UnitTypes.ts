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
  aggroRange: number;      // how far you notice enemies
  attackRange: number;     // melee ~ 40-70, ranged larger
  attackWindupMs: number;  // when the hit applies after attack starts
  attackCooldownMs: number;// time between attacks
  damage: number;
};

export type UnitDef = {
  id: string;          // "slime4" etc
  kind: UnitKind;
  team: Team;
  visuals: MobDef;     // reuse your existing mob visuals/animations defs
  radius: number;      // collision circle radius in world px

  baseStats: Omit<UnitStats, "hp">; // hp will be initialized to maxHp
};
