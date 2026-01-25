export type InstanceType = "TOWN" | "OPEN_WORLD" | "DUNGEON" | "RAID" | "GATHERER";

export type SceneId =
  | "town"
  | "hell"; // add more as you create scenes

export type GuildMemberId = string;
export type PartyId = string;

export type GearSlot = "weapon" | "armor" | "trinket";

export type GearItem = {
  id: string;
  name: string;
  slot: GearSlot;
  stats: Partial<{
    maxHp: number;
    damage: number;
    attackCooldownMs: number;
    attackRange: number;
    walkSpeed: number;
    runSpeed: number;
    aggroRange: number;
  }>;
};

export type MemberRole = "adventurer" | "worker";

export type GuildMember = {
  id: GuildMemberId;
  name: string;
  role: MemberRole;

  // visuals: which UnitDef to use when spawning in Phaser
  unitDefId: string; // e.g. "lizardman1", later "hero_knight1", etc.

  // assignment
  sceneId: SceneId;         // where they currently are
  partyId: PartyId | null;  // which party they’re in (if any)

  // progression
  level: number;
  gear: Partial<Record<GearSlot, GearItem>>;

  // persistent combat state
  hp: number;
  maxHp: number;

  // death handling
  deadAtMs: number | null; // if dead in combat
};

export type Party = {
  id: PartyId;
  name: string;
  memberIds: GuildMemberId[];
  sceneId: SceneId; // where this party is currently deployed
};

export type SceneMeta = {
  id: SceneId;
  name: string;
  instanceType: InstanceType;
};
