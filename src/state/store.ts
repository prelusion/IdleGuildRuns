import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { SAVE_VERSION, migrateSave } from "./saveMigrations";
import type {PlacedTile, Rotation, SceneMap, SceneWrapper} from "../game/phaser/scenes/maps/scenes.ts";
import { Scenes } from "../game/phaser/scenes/maps/scenes.ts";
import type {Item} from "../app/types.ts";

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
