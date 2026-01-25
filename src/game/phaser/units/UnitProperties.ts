import type { UnitDef, UnitKind, Team, UnitStats } from "./unitTypes";
import {MOBS} from "../mobs/mobVisuals.ts";

const DEFAULTS: Record<UnitKind, Omit<UnitStats, "hp">> = {
  mob: {
    maxHp: 75,
    walkSpeed: 120,
    runSpeed: 220,
    aggroRange: 2900,
    attackRange: 70,
    attackWindupMs: 180,
    attackCooldownMs: 1400,
    damage: 3,
  },
  boss: {
    maxHp: 400,
    walkSpeed: 290,
    runSpeed: 170,
    aggroRange: 5200,
    attackRange: 150,
    attackWindupMs: 260,
    attackCooldownMs: 1700,
    damage: 16,
  },
  adventurer: {
    maxHp: 240,
    walkSpeed: 140,
    runSpeed: 260,
    aggroRange: 5400,
    attackRange: 70,
    attackWindupMs: 200,
    attackCooldownMs: 1100,
    damage: 20,
  },
  worker: {
    maxHp: 90,
    walkSpeed: 120,
    runSpeed: 280,
    aggroRange: 5000,
    attackRange: 0,
    attackWindupMs: 0,
    attackCooldownMs: 999_999,
    damage: 0,
  },
};

function inferKindAndTeam(id: string): { kind: UnitKind; team: Team } {
  if (id.includes("boss")) return { kind: "boss", team: "enemy" };
  return { kind: "mob", team: "enemy" };
}

function inferRadius(id: string): number {
  if (id.includes("boss")) return 52;
  if (id.startsWith("golem")) return 46;
  if (id.startsWith("orc")) return 42;
  return 34;
}

const OVERRIDES: Partial<Record<string, Partial<UnitDef>>> = {
  slime4: {
    baseStats: { ...DEFAULTS.mob, maxHp: 80, damage: 7, attackCooldownMs: 1600 },
    radius: 40,
  },
  slime_boss1: {
    kind: "boss",
    team: "enemy",
    baseStats: { ...DEFAULTS.boss, maxHp: 900, damage: 22, attackCooldownMs: 2000 },
    radius: 120,
  },
  lizardman1: {
    kind: "adventurer",
    team: "ally",
    baseStats: { ...DEFAULTS.adventurer, attackRange: 380, attackCooldownMs: 1400 },
    radius: 60,
  },
  ghost1_worker: {
    // This is not in MOBS by default; this is a gameplay unit using ghost1 visuals.
    // We’ll define it manually below in EXTRA_UNITS.
  },
};

const EXTRA_UNITS: Record<string, UnitDef> = {
  ghost1_worker: {
    id: "ghost1_worker",
    kind: "worker",
    team: "ally",
    visuals: MOBS["ghost1"],
    radius: 34,
    baseStats: { ...DEFAULTS.worker },
  },
};

// 6) Build the full catalog
export function buildUnitCatalog(): Record<string, UnitDef> {
  const out: Record<string, UnitDef> = {};

  for (const [id, visuals] of Object.entries(MOBS)) {
    const { kind, team } = inferKindAndTeam(id);
    const baseStats = { ...DEFAULTS[kind] };

    out[id] = {
      id,
      kind,
      team,
      visuals,
      radius: inferRadius(id),
      baseStats,
    };

    const ov = OVERRIDES[id];
    if (ov) out[id] = { ...out[id], ...ov, baseStats: ov.baseStats ?? out[id].baseStats };
  }

  Object.assign(out, EXTRA_UNITS);

  return out;
}
