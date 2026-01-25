import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { SAVE_VERSION, migrateSave } from "./saveMigrations";
import type {PlacedTile, Rotation, SceneMap, SceneWrapper} from "../game/phaser/scenes/maps/scenes.ts";
import { Scenes } from "../game/phaser/scenes/maps/scenes.ts";
import type {Item} from "../app/types.ts";
import type { GuildMember, GuildMemberId, Party, PartyId, SceneId, GearItem } from "./gameTypes.ts";

type UiPanel = "none" | "building";

type SimSnapshot = {
  tick: number;
  goldDeltaSinceLast: number;
};

type AppState = {
  // Persisted progression
  version: number;
  lastSavedAt: number;
  gold: number;
  ticks: number;

  // Non-persisted runtime
  simConnected: boolean;

  // Actions
  applyOfflineProgress: (now: number) => void;
  applySimSnapshot: (snap: SimSnapshot) => void;
  markSavedNow: (now: number) => void;
  setSimConnected: (v: boolean) => void;


  uiPanel: UiPanel;
  selectedBuildingId: string | null;

  openBuildingPanel: (id: string) => void;
  closePanel: () => void;

  inventorySize: number;
  setInventorySize: (v: number) => void;
  inventoryItems: Item[];
  setInventoryItems: (v: Item) => void;

  editorEnabled: boolean;
  creativeEnabled: boolean;
  editorLayer: "ground" | "objects";
  selectedSpriteKey: string | null;
  selectedRotation: Rotation;
  sceneMap: SceneMap;

  setSceneMap: (scene: string) => void;
  setEditorEnabled: (v: boolean) => void;
  setCreativeEnabled: (v: boolean) => void;
  setEditorLayer: (v: "ground" | "objects") => void;
  setSelectedSpriteKey: (k: string | null) => void;
  rotateSelected: () => void;
  placeAt: (tx: number, ty: number) => void;
  eraseAt: (tx: number, ty: number) => void;
  exportSceneMapJson: () => string;
};



export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      version: SAVE_VERSION,
      lastSavedAt: Date.now(),
      gold: 0,
      ticks: 0,

      simConnected: false,

      applyOfflineProgress: (now) => {
        const { lastSavedAt } = get();
        const elapsedMs = Math.max(0, now - lastSavedAt);

        // Example offline calc: 1 gold per second (replace with real sim later)
        const gained = Math.floor(elapsedMs / 1000);

        if (gained > 0) {
          set((s) => ({
            gold: s.gold + gained,
            // don't advance ticks here unless you want to; many idlers do
          }));
        }
        set({ lastSavedAt: now });
      },

      applySimSnapshot: (snap) => {
        // Snapshot includes delta, so UI doesn’t need to know internal sim details.
        set((s) => ({
          ticks: snap.tick,
          gold: s.gold + snap.goldDeltaSinceLast,
        }));
      },

      markSavedNow: (now) => set({ lastSavedAt: now }),
      setSimConnected: (v) => set({ simConnected: v }),

      uiPanel: "none",
      selectedBuildingId: null,

      openBuildingPanel: (id) => set({ uiPanel: "building", selectedBuildingId: id }),
      closePanel: () => set({ uiPanel: "none", selectedBuildingId: null }),

      editorEnabled: false,
      creativeEnabled: false,
      editorLayer: "ground",
      selectedSpriteKey: null,
      selectedRotation: 0,

      inventorySize: 20,
      setInventorySize: (size: number) => {set({inventorySize: size});},
      inventoryItems: [],
      setInventoryItems: (item: Item) => {
        set((state) => ({
          inventoryItems: [...state.inventoryItems, item],
        }));
      },


      sceneMap: (() => {
        return (Scenes.find((s) => {return s.scene === "town"}) as SceneWrapper).sceneMap;
      })(),

      setSceneMap: (v) => {
        const scene =  (Scenes.filter((s) => v.toLowerCase() === s.scene) as SceneWrapper[])[0].sceneMap;
        set({sceneMap: scene})
      },

      setEditorEnabled: (v) => set({ editorEnabled: v }),
      setCreativeEnabled: (v) => set({ creativeEnabled: v }),
      setEditorLayer: (v) => set({ editorLayer: v }),
      setSelectedSpriteKey: (k) => set({ selectedSpriteKey: k }),

      rotateSelected: () =>
        set((s) => {
          const next = (s.selectedRotation + 90) as Rotation;
          return { selectedRotation: (next === 360 ? 0 : next) as Rotation };
        }),

      placeAt: (tx, ty) =>
        set((s) => {
          const { selectedSpriteKey, selectedRotation, editorLayer, sceneMap } = s;
          if (!selectedSpriteKey) return s;

          if (tx < 0 || ty < 0 || tx >= sceneMap.width || ty >= sceneMap.height) return s;

          const placed = { key: selectedSpriteKey, rotation: selectedRotation } as PlacedTile;

          const nextMap: SceneMap = {
            ...sceneMap,
            ground: sceneMap.ground.map((row) => row.slice()),
            objects: sceneMap.objects.map((row) => row.slice()),
          };

          if (editorLayer === "ground") nextMap.ground[ty][tx] = placed;
          else nextMap.objects[ty][tx] = placed;

          return { sceneMap: nextMap };
        }),

      eraseAt: (tx, ty) =>
        set((s) => {
          const { editorLayer, sceneMap } = s;
          if (tx < 0 || ty < 0 || tx >= sceneMap.width || ty >= sceneMap.height) return s;

          const nextMap: SceneMap = {
            ...sceneMap,
            ground: sceneMap.ground.map((row) => row.slice()),
            objects: sceneMap.objects.map((row) => row.slice()),
          };

          if (editorLayer === "ground") nextMap.ground[ty][tx] = null;
          else nextMap.objects[ty][tx] = null;

          return { sceneMap: nextMap };
        }),

      exportSceneMapJson: () => {
        const { sceneMap } = get();
        return JSON.stringify(sceneMap, null, 2);
      },

    }),
    {
      name: "idle-raiders-save",
      storage: createJSONStorage(() => localStorage),
      version: SAVE_VERSION,
      migrate: (persisted, _version) => migrateSave(persisted) as unknown as AppState, // eslint-disable-line
      partialize: (s) => ({
        version: s.version,
        lastSavedAt: s.lastSavedAt,
        gold: s.gold,
        ticks: s.ticks,
      }),
    }
  )
);

type GameState = {
  gold: number;

  // --- guild / parties ---
  guildMembers: Record<GuildMemberId, GuildMember>;
  parties: Record<PartyId, Party>;

  // --- selection / ui (optional) ---
  selectedPartyId: PartyId | null;
  selectedMemberId: GuildMemberId | null;

  // --- actions ---
  addGold: (amount: number) => void;

  createStarterGuild: () => void;

  createParty: (name: string) => PartyId;
  addMemberToParty: (memberId: GuildMemberId, partyId: PartyId) => void;
  removeMemberFromParty: (memberId: GuildMemberId) => void;

  sendPartyToScene: (partyId: PartyId, sceneId: SceneId) => void;
  setMemberScene: (memberId: GuildMemberId, sceneId: SceneId) => void;

  applyGear: (memberId: GuildMemberId, item: GearItem) => void;
  recomputeMemberStats: (memberId: GuildMemberId) => void;

  // combat sync hooks called by Phaser
  setMemberHp: (memberId: GuildMemberId, hp: number) => void;
  markMemberDead: (memberId: GuildMemberId, nowMs: number) => void;

  // “death rule”: after 60s dead -> remove from party & send back to town
  reviveOrRecallDeadMembers: (nowMs: number) => void;

  selectedSceneId: SceneId;
  setSelectedSceneId: (id: SceneId) => void;
  goToScene: (sceneId: SceneId) => void;

};

const DEAD_RECALL_MS = 60_000;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      gold: 0,

      guildMembers: {},
      parties: {},

      selectedPartyId: null,
      selectedMemberId: null,

      selectedSceneId: "town",
      setSelectedSceneId: (id) => set({ selectedSceneId: id }),

      addGold: (amount) => set((s) => ({ gold: s.gold + amount })),
      goToScene: (sceneId) => {
        set({ selectedSceneId: sceneId });
        // update tile scene map in app store too
        useAppStore.getState().setSceneMap(sceneId);
      },

      createStarterGuild: () => {
        const a1: GuildMember = {
          id: uid("gm"),
          name: "Alya",
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
        // const a2: GuildMember = {
        //   id: uid("gm"),
        //   name: "cccc",
        //   role: "adventurer",
        //   unitDefId: "lizardman1",
        //   sceneId: "town",
        //   partyId: null,
        //   level: 1,
        //   gear: {},
        //   maxHp: 140,
        //   hp: 140,
        //   deadAtMs: null,
        // };
        // const a3: GuildMember = {
        //   id: uid("gm"),
        //   name: "bbbb",
        //   role: "adventurer",
        //   unitDefId: "lizardman1",
        //   sceneId: "town",
        //   partyId: null,
        //   level: 1,
        //   gear: {},
        //   maxHp: 140,
        //   hp: 140,
        //   deadAtMs: null,
        // };
        // const a4: GuildMember = {
        //   id: uid("gm"),
        //   name: "dddd",
        //   role: "adventurer",
        //   unitDefId: "lizardman1",
        //   sceneId: "town",
        //   partyId: null,
        //   level: 1,
        //   gear: {},
        //   maxHp: 140,
        //   hp: 140,
        //   deadAtMs: null,
        // };
        //
        // const w1: GuildMember = {
        //   id: uid("gm"),
        //   name: "Miro",
        //   role: "worker",
        //   unitDefId: "ghost1_worker",
        //   sceneId: "town",
        //   partyId: null,
        //   level: 1,
        //   gear: {},
        //   maxHp: 90,
        //   hp: 90,
        //   deadAtMs: null,
        // };

        set((s) => ({
          guildMembers: { ...s.guildMembers,
            [a1.id]: a1,
            // [a2.id]: a2, [a3.id]: a3, [a4.id]: a4, [w1.id]: w1
            },
        }));

        // create a default party and put adventurer in it
        const partyId = get().createParty("Party 1");
        get().addMemberToParty(a1.id, partyId);
        // get().addMemberToParty(a2.id, partyId);
        // get().addMemberToParty(a3.id, partyId);
        // get().addMemberToParty(a4.id, partyId);
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

        // remove from any previous party first
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

      applyGear: (memberId, item) => {
        const gm = get().guildMembers[memberId];
        if (!gm) return;
        set((s) => ({
          guildMembers: {
            ...s.guildMembers,
            [memberId]: { ...gm, gear: { ...gm.gear, [item.slot]: item } },
          },
        }));
        get().recomputeMemberStats(memberId);
      },

      recomputeMemberStats: (memberId) => {
        const gm = get().guildMembers[memberId];
        if (!gm) return;

        const gearItems = Object.values(gm.gear).filter(Boolean) as GearItem[];
        const bonus = gearItems.reduce(
          (acc, it) => {
            for (const [k, v] of Object.entries(it.stats)) {
              (acc)[k] = ((acc)[k] ?? 0) + (v ?? 0);
            }
            return acc;
          },
          {} as Record<string, number>
        );

        // for now keep it simple: only maxHp affects hp clamp
        const newMaxHp = Math.max(1, gm.maxHp + (bonus.maxHp ?? 0));
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

        // recall anyone who’s been dead for >= 60s
        const updatedMembers: typeof guildMembers = { ...guildMembers };
        const updatedParties: typeof parties = { ...parties };
        let changed = false;

        for (const gm of Object.values(guildMembers)) {
          if (!gm.deadAtMs) continue;

          if (nowMs - gm.deadAtMs >= DEAD_RECALL_MS) {
            // remove from party and send to town
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
    { name: "idle-raiders-save-v1" }
  )
);