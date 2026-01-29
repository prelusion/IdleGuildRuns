import type {EquipmentSlot, EquipSlot, ItemLike} from "../app/types.ts";

export type InstanceType = "TOWN" | "OPEN_WORLD" | "DUNGEON" | "RAID" | "GATHERER";

export type SceneId =
  | "town"
  | "hell"; // add more as you create scenes

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