import type {EquipmentSlot, EquipSlot, ItemLike} from "../app/types.ts";

export type InstanceType = "TOWN" | "OPEN_WORLD" | "DUNGEON" | "RAID" | "GATHERER";

export type SceneId =
  "plains/autumn_1" |
  "plains/autumn_2" |
  "plains/autumn_3" |
  "plains/autumn_4" |
  "plains/autumn_5" |
  "plains/autumn_6" |
  "plains/autumn_7" |
  "plains/autumn_8" |
  "plains/autumn_9" |
  "plains/autumn_10" |
  "snowyfalls/autumn_1" |
  "snowyfalls/autumn_2" |
  "snowyfalls/autumn_3" |
  "snowyfalls/autumn_4" |
  "snowyfalls/autumn_5" |
  "snowyfalls/autumn_6" |
  "snowyfalls/autumn_7" |
  "snowyfalls/autumn_8" |
  "snowyfalls/autumn_9" |
  "snowyfalls/autumn_10" |
  "hell" |
  "town";

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

  deadAtMs: number | null

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