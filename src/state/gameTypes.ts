import type { EquipmentSlot, EquipSlot, ItemLike } from "../app/types.ts";

/** Where a party/member is (used by Phaser routing + UI). */
export const OPENWORLD_GROUPS = ["plains", "snowyfalls"] as const;
export type OpenWorldGroup = (typeof OPENWORLD_GROUPS)[number];

export type InstanceType = "TOWN" | "OPEN_WORLD" | "DUNGEON" | "RAID" | "GATHERER";

/** Helper: build "plains/autumn_1".."plains/autumn_10" etc as a type */
type Num1to10 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type PlainsId = `plains/autumn_${Num1to10}`;
type SnowyfallsId = `snowyfalls/winter-medieval_${Num1to10}`;

export type SceneId = "hell" | "town" | PlainsId | SnowyfallsId;

export type MemberRole = "adventurer" | "worker";

export type EquippedItem = {
  slot: EquipSlot;
  item: ItemLike;
};

export type GuildMember = {
  id: string;
  name: string;
  role: MemberRole;

  unitDefId: string;
  xpCurrent?: number;
  xpToNext?: number;

  sceneId: SceneId;
  partyId: string | null;

  level: number;

  hp: number;
  maxHp: number;

  deadAtMs: number | null;

  gear: Partial<Record<EquipmentSlot, ItemLike>>;
};

export type Party = {
  id: string;
  name: string;
  memberIds: string[];
  sceneId: SceneId;
};

export type SceneMeta = {
  id: SceneId;
  name: string;
  instanceType: InstanceType;
};
