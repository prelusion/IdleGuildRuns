import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type {
  Accessory,
  EquipSlot,
  EquipSlotUI,
  Gear,
  ItemLike,
  Weapon,
} from "../app/types";
import type { GuildMember, Party, SceneId } from "./gameTypes";
import type { EquipmentSlot } from "../app/types";
import { useAppStore } from "./useAppStore";

const STORAGE_KEYS = {
  game: "idle-raiders-game-save",
} as const;

const DEAD_RECALL_MS = 60_000;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function isWeapon(x: ItemLike): x is Weapon {
  return "fromDamage" in x && "toDamage" in x && "parry" in x && "block" in x && "range" in x;
}
function isGear(x: ItemLike): x is Gear {
  return "armor" in x && "type" in x && "rank" in x && !isWeapon(x);
}
function hasStats(x: ItemLike): x is Gear | Weapon | Accessory {
  return "primaryStats" in x && "secondaryStats" in x;
}

export type DerivedMemberStats = {
  damageMin: number;
  damageMax: number;
  armor: number;
  parry: number;
  block: number;
  range: number;

  strength: number;
  agility: number;
  stamina: number;
  intellect: number;
  spirit: number;

  crit: number;
  haste: number;
  speed: number;
  leech: number;

  fireResistance: number;
  frostResistance: number;
  arcaneResistance: number;
  shadowResistance: number;
  poisonResistance: number;
  stunResistance: number;
};

export function computeDerivedFromGear(items: ItemLike[]): DerivedMemberStats {
  const derived: DerivedMemberStats = {
    damageMin: 0,
    damageMax: 0,
    armor: 0,
    parry: 0,
    block: 0,
    range: 0,

    strength: 0,
    agility: 0,
    stamina: 0,
    intellect: 0,
    spirit: 0,

    crit: 0,
    haste: 0,
    speed: 0,
    leech: 0,

    fireResistance: 0,
    frostResistance: 0,
    arcaneResistance: 0,
    shadowResistance: 0,
    poisonResistance: 0,
    stunResistance: 0,
  };

  for (const it of items) {
    if (isGear(it)) derived.armor += it.armor;

    if (isWeapon(it)) {
      derived.armor += it.armor;
      derived.damageMin = Math.max(derived.damageMin, it.fromDamage);
      derived.damageMax = Math.max(derived.damageMax, it.toDamage);
      derived.parry = Math.max(derived.parry, it.parry);
      derived.block = Math.max(derived.block, it.block);
      derived.range = Math.max(derived.range, it.range);
    }

    if (hasStats(it)) {
      derived.strength += it.primaryStats.strength;
      derived.agility += it.primaryStats.agility;
      derived.stamina += it.primaryStats.stamina;
      derived.intellect += it.primaryStats.intellect;
      derived.spirit += it.primaryStats.spirit;

      derived.crit += it.secondaryStats.crit;
      derived.haste += it.secondaryStats.haste;
      derived.speed += it.secondaryStats.speed;
      derived.leech += it.secondaryStats.leech;

      derived.fireResistance += it.secondaryStats.resistances.fireResistance;
      derived.frostResistance += it.secondaryStats.resistances.frostResistance;
      derived.arcaneResistance += it.secondaryStats.resistances.arcaneResistance;
      derived.shadowResistance += it.secondaryStats.resistances.shadowResistance;
      derived.poisonResistance += it.secondaryStats.resistances.poisonResistance;
      derived.stunResistance += it.secondaryStats.resistances.stunResistance;
    }
  }

  return derived;
}

export type GameState = {
  gold: number;

  guildMembers: Record<string, GuildMember>;
  parties: Record<string, Party>;

  selectedPartyId: string | null;
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;
  clearSelectedMember: () => void;

  addGold: (amount: number) => void;

  createStarterGuild: () => void;

  createParty: (name: string) => string;
  addMemberToParty: (memberId: string, partyId: string) => void;
  removeMemberFromParty: (memberId: string) => void;

  sendPartyToScene: (partyId: string, sceneId: SceneId) => void;
  setMemberScene: (memberId: string, sceneId: SceneId) => void;

  applyGear: (memberId: string, slot: EquipSlot, item: ItemLike) => void;
  recomputeMemberStats: (memberId: string) => void;

  setMemberHp: (memberId: string, hp: number) => void;
  markMemberDead: (memberId: string, nowMs: number) => void;
  reviveOrRecallDeadMembers: (nowMs: number) => void;

  equipToSelectedMember: (slot: EquipSlotUI, item: ItemLike) => void;

  selectedSceneId: SceneId;
  setSelectedSceneId: (id: SceneId) => void;
  goToScene: (sceneId: SceneId) => void;
};

export const useGameStore = create<GameState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        gold: 0,

        guildMembers: {},
        parties: {},

        selectedPartyId: null,
        selectedMemberId: null,
        setSelectedMemberId: (id) => set({ selectedMemberId: id }),
        clearSelectedMember: () => set({ selectedMemberId: null }),

        selectedSceneId: "town",
        setSelectedSceneId: (id) => set({ selectedSceneId: id }),

        addGold: (amount) => set((s) => ({ gold: s.gold + amount })),

        goToScene: (sceneId) => {
          set({ selectedSceneId: sceneId });
          useAppStore.getState().setSceneMap(sceneId);
        },

        createStarterGuild: () => {
          const a1: GuildMember = {
            id: uid("gm"),
            name: "damage dealer",
            role: "adventurer",
            unitDefId: "lizardman1",
            sceneId: "town",
            partyId: null,
            level: 1,
            gear: {},
            maxHp: 140,
            hp: 140,
            deadAtMs: null,
          };

          const a2: GuildMember = {
            id: uid("gm"),
            name: "tank",
            role: "adventurer",
            unitDefId: "lizardman1",
            sceneId: "town",
            partyId: null,
            level: 1,
            gear: {},
            maxHp: 140,
            hp: 140,
            deadAtMs: null,
          };

          const a3: GuildMember = {
            id: uid("gm"),
            name: "miner",
            role: "worker",
            unitDefId: "lizardman1",
            sceneId: "town",
            partyId: null,
            level: 1,
            gear: {},
            maxHp: 140,
            hp: 140,
            deadAtMs: null,
          };

          set((s) => ({
            guildMembers: {
              ...s.guildMembers,
              [a1.id]: a1,
              [a2.id]: a2,
              [a3.id]: a3,
            },
          }));

          const partyId = get().createParty("Party 1");
          get().addMemberToParty(a1.id, partyId);
        },

        createParty: (name) => {
          const id = uid("party");
          set((s) => ({
            parties: {
              ...s.parties,
              [id]: { id, name, memberIds: [], sceneId: "town" },
            },
          }));
          return id;
        },

        addMemberToParty: (memberId, partyId) => {
          const gm = get().guildMembers[memberId];
          const party = get().parties[partyId];
          if (!gm || !party) return;

          if (gm.partyId) get().removeMemberFromParty(memberId);

          set((s) => ({
            guildMembers: {
              ...s.guildMembers,
              [memberId]: { ...gm, partyId, sceneId: party.sceneId },
            },
            parties: {
              ...s.parties,
              [partyId]: {
                ...party,
                memberIds: party.memberIds.includes(memberId)
                  ? party.memberIds
                  : [...party.memberIds, memberId],
              },
            },
          }));
        },

        removeMemberFromParty: (memberId) => {
          const gm = get().guildMembers[memberId];
          if (!gm || !gm.partyId) return;

          const party = get().parties[gm.partyId];
          if (!party) return;

          set((s) => ({
            guildMembers: {
              ...s.guildMembers,
              [memberId]: { ...gm, partyId: null, sceneId: "town" },
            },
            parties: {
              ...s.parties,
              [party.id]: {
                ...party,
                memberIds: party.memberIds.filter((id) => id !== memberId),
              },
            },
          }));
        },

        sendPartyToScene: (partyId, sceneId) => {
          const party = get().parties[partyId];
          if (!party) return;

          set((s) => {
            const updatedMembers = { ...s.guildMembers };
            for (const mid of party.memberIds) {
              const gm = updatedMembers[mid];
              if (gm) updatedMembers[mid] = { ...gm, sceneId };
            }
            return {
              parties: { ...s.parties, [partyId]: { ...party, sceneId } },
              guildMembers: updatedMembers,
            };
          });
        },

        setMemberScene: (memberId, sceneId) => {
          const gm = get().guildMembers[memberId];
          if (!gm) return;

          set((s) => ({
            guildMembers: { ...s.guildMembers, [memberId]: { ...gm, sceneId } },
          }));
        },

        applyGear: (memberId, slot, item) => {
          const gm = get().guildMembers[memberId];
          if (!gm) return;

          set((s) => ({
            guildMembers: {
              ...s.guildMembers,
              [memberId]: { ...gm, gear: { ...gm.gear, [slot]: item } },
            },
          }));

          get().recomputeMemberStats(memberId);
        },

        equipToSelectedMember: (slot: EquipmentSlot, item: ItemLike) => {
          const { selectedMemberId, guildMembers } = get();
          if (!selectedMemberId) return;

          const gm = guildMembers[selectedMemberId];
          if (!gm) return;

          set((s) => ({
            ...s,
            guildMembers: {
              ...s.guildMembers,
              [selectedMemberId]: {
                ...gm,
                gear: { ...gm.gear, [slot]: item },
              },
            },
          }));
        },

        recomputeMemberStats: (memberId) => {
          const gm = get().guildMembers[memberId];
          if (!gm) return;

          const items = Object.values(gm.gear).filter(Boolean) as ItemLike[];
          const derived = computeDerivedFromGear(items);

          const baseMaxHp = 140;
          const newMaxHp = Math.max(1, baseMaxHp + derived.stamina * 10);
          const newHp = Math.min(gm.hp, newMaxHp);

          set((s) => ({
            guildMembers: {
              ...s.guildMembers,
              [memberId]: { ...gm, maxHp: newMaxHp, hp: newHp },
            },
          }));
        },

        setMemberHp: (memberId, hp) => {
          const gm = get().guildMembers[memberId];
          if (!gm) return;

          set((s) => ({
            guildMembers: { ...s.guildMembers, [memberId]: { ...gm, hp } },
          }));
        },

        markMemberDead: (memberId, nowMs) => {
          const gm = get().guildMembers[memberId];
          if (!gm) return;

          set((s) => ({
            guildMembers: {
              ...s.guildMembers,
              [memberId]: { ...gm, hp: 0, deadAtMs: nowMs },
            },
          }));
        },

        reviveOrRecallDeadMembers: (nowMs) => {
          const { guildMembers, parties } = get();
          const updatedMembers: typeof guildMembers = { ...guildMembers };
          const updatedParties: typeof parties = { ...parties };

          let changed = false;

          for (const gm of Object.values(guildMembers)) {
            if (!gm.deadAtMs) continue;

            if (nowMs - gm.deadAtMs >= DEAD_RECALL_MS) {
              if (gm.partyId && updatedParties[gm.partyId]) {
                const p = updatedParties[gm.partyId];
                updatedParties[gm.partyId] = {
                  ...p,
                  memberIds: p.memberIds.filter((id) => id !== gm.id),
                };
              }
              updatedMembers[gm.id] = { ...gm, partyId: null, sceneId: "town" };
              changed = true;
            }
          }

          if (changed) set({ guildMembers: updatedMembers, parties: updatedParties });
        },
      }),
      {
        name: STORAGE_KEYS.game,
      }
    )
  )
);

export const gameSelectors = {
  selectedSceneId: (s: GameState) => s.selectedSceneId,
  clearSelectedMember: (s: GameState) => s.clearSelectedMember,
  selectedMemberId: (s: GameState) => s.selectedMemberId,
  setSelectedMemberId: (s: GameState) => s.setSelectedMemberId,
  goToScene: (s: GameState) => s.goToScene,
} as const;
