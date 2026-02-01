import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SAVE_VERSION, migrateSave } from "./saveMigrations";
import type { PlacedTile, Rotation, SceneMap } from "../game/phaser/scenes/maps/scenes";
import town from "../game/phaser/scenes/maps/town.json";
import hell from "../game/phaser/scenes/maps/hell.json";
import { getFirstOpenWorldSceneId, getOpenWorldScene } from "../game/phaser/scenes/maps/sceneCatalog";

import type { Item, ItemLike, ItemLikeOrNull } from "../app/types";

type UiPanel = "none" | "building";
type BrushKind = "tile" | "object";

export type SimSnapshot = {
  tick: number;
  goldDeltaSinceLast: number;
};

export type AppState = {
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

  // UI
  uiPanel: UiPanel;
  selectedBuildingId: string | null;
  openBuildingPanel: (id: string) => void;
  closePanel: () => void;

  // Inventory
  inventorySize: number;
  setInventorySize: (v: number) => void;
  inventoryItems: ItemLikeOrNull[];
  addInventoryItem: (v: Item) => void;
  setInventoryItems: (v: Item) => void; // backward-compatible alias
  removeInventoryItem: (idx: number) => void;
  swapInventoryItem: (idx: number, item: ItemLike | null) => void;

  // Editor
  editorEnabled: boolean;
  creativeEnabled: boolean;
  editorLayer: "ground" | "objects";
  brushKind: BrushKind;
  selectedSpriteKey: string | null;
  selectedRotation: Rotation;
  sceneMap: SceneMap;

  setSceneMap: (scene: string) => void;
  setEditorEnabled: (v: boolean) => void;
  setCreativeEnabled: (v: boolean) => void;
  setEditorLayer: (v: "ground" | "objects") => void;
  setBrushKind: (k: BrushKind) => void;
  placeFreeObjectAt: (x: number, y: number) => void;
  eraseFreeObjectAt: (x: number, y: number) => void;
  setSelectedSpriteKey: (k: string | null) => void;
  rotateSelected: () => void;
  placeAt: (tx: number, ty: number) => void;
  eraseAt: (tx: number, ty: number) => void;
  exportSceneMapJson: () => string;

  // Optional future hook if you want to feed Phaser a maps manifest through app state
  // (no-op currently; kept here only if you later want it)
  // setMapsManifest?: (m: MapsLibraryManifest) => void;
};

const STORAGE_KEYS = {
  app: "idle-raiders-app-save",
} as const;

function cloneTileLayers(sceneMap: SceneMap) {
  return {
    ground: sceneMap.ground.map((row) => row.slice()),
    objects: sceneMap.objects.map((row) => row.slice()),
  };
}

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

        // Placeholder offline gain: 1 gold per second
        const gained = Math.floor(elapsedMs / 1000);

        if (gained > 0) {
          set((s) => ({
            gold: s.gold + gained,
          }));
        }
        set({ lastSavedAt: now });
      },

      applySimSnapshot: (snap) => {
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

      inventorySize: 20,
      setInventorySize: (inventorySize) => set({ inventorySize }),
      inventoryItems: [],

      addInventoryItem: (item) => {
        set((state) => ({
          inventoryItems: [...state.inventoryItems.filter(Boolean), item],
        }));
      },

      // Backwards-compatible alias (keeps existing call sites working)
      setInventoryItems: (item) => {
        get().addInventoryItem(item);
      },

      removeInventoryItem: (idx) =>
        set((s) => {
          const next = [...s.inventoryItems];
          if (idx < 0 || idx >= next.length) return s;
          next[idx] = null;
          return { ...s, inventoryItems: next };
        }),

      swapInventoryItem: (idx, item) =>
        set((s) => {
          const next = [...s.inventoryItems];
          if (idx < 0 || idx >= next.length) return s;
          next[idx] = item;
          return { ...s, inventoryItems: next };
        }),

      // Editor defaults
      editorEnabled: false,
      creativeEnabled: false,
      editorLayer: "ground",
      brushKind: "tile",
      selectedSpriteKey: null,
      selectedRotation: 0,

      setBrushKind: (brushKind) => set({ brushKind }),

      sceneMap: (() => town as unknown as SceneMap)(),

      setSceneMap: (sceneId) => {
        if (sceneId === "town") {
          set({ sceneMap: town as unknown as SceneMap });
          return;
        }
        if (sceneId === "hell") {
          set({ sceneMap: hell as unknown as SceneMap });
          return;
        }

        const def = getOpenWorldScene(sceneId);
        if (def) {
          set({ sceneMap: def.map });
          return;
        }

        if (sceneId === "plains" || sceneId === "snowyfalls") {
          const first = getFirstOpenWorldSceneId(sceneId);
          if (first) {
            const d = getOpenWorldScene(first);
            if (d) set({ sceneMap: d.map });
          }
          return;
        }

        console.warn(`[setSceneMap] Unknown sceneId "${sceneId}"`);
      },

      setEditorEnabled: (editorEnabled) => set({ editorEnabled }),
      setCreativeEnabled: (creativeEnabled) => set({ creativeEnabled }),
      setEditorLayer: (editorLayer) => set({ editorLayer }),
      setSelectedSpriteKey: (selectedSpriteKey) => set({ selectedSpriteKey }),

      rotateSelected: () =>
        set((s) => {
          const next = (s.selectedRotation + 90) as Rotation;
          return { selectedRotation: (next === 360 ? 0 : next) as Rotation };
        }),

      placeFreeObjectAt: (x, y) =>
        set((s) => {
          const { selectedSpriteKey, selectedRotation, sceneMap } = s;
          if (!selectedSpriteKey) return s;

          const id = `o_${Math.random().toString(36).slice(2, 10)}`;
          const next = {
            id,
            key: selectedSpriteKey,
            x,
            y,
            rotation: selectedRotation,
            scale: { x: 1, y: 1 },
          };

          const nextMap: SceneMap = {
            ...sceneMap,
            objectsFree: [...(sceneMap.objectsFree ?? []), next],
          };

          return { sceneMap: nextMap };
        }),

      eraseFreeObjectAt: (x, y) =>
        set((s) => {
          const list = s.sceneMap.objectsFree ?? [];
          if (list.length === 0) return s;

          const R = 64;
          let bestIdx = -1;
          let bestD2 = Infinity;

          for (let i = 0; i < list.length; i++) {
            const dx = list[i].x - x;
            const dy = list[i].y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
              bestD2 = d2;
              bestIdx = i;
            }
          }

          if (bestIdx === -1 || bestD2 > R * R) return s;

          const nextList = list.slice();
          nextList.splice(bestIdx, 1);

          return {
            sceneMap: { ...s.sceneMap, objectsFree: nextList },
          };
        }),

      placeAt: (tx, ty) =>
        set((s) => {
          const { selectedSpriteKey, selectedRotation, editorLayer, sceneMap } = s;
          if (!selectedSpriteKey) return s;

          if (tx < 0 || ty < 0 || tx >= sceneMap.width || ty >= sceneMap.height) return s;

          const placed = { key: selectedSpriteKey, rotation: selectedRotation } as PlacedTile;
          const layers = cloneTileLayers(sceneMap);
          const nextMap: SceneMap = { ...sceneMap, ...layers };

          if (editorLayer === "ground") nextMap.ground[ty][tx] = placed;
          else nextMap.objects[ty][tx] = placed;

          return { sceneMap: nextMap };
        }),

      eraseAt: (tx, ty) =>
        set((s) => {
          const { editorLayer, sceneMap } = s;
          if (tx < 0 || ty < 0 || tx >= sceneMap.width || ty >= sceneMap.height) return s;

          const layers = cloneTileLayers(sceneMap);
          const nextMap: SceneMap = { ...sceneMap, ...layers };

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
      name: STORAGE_KEYS.app,
      storage: createJSONStorage(() => localStorage),
      version: SAVE_VERSION,
      migrate: (persisted) => migrateSave(persisted) as unknown as AppState,
      partialize: (s) => ({
        version: s.version,
        lastSavedAt: s.lastSavedAt,
        gold: s.gold,
        ticks: s.ticks,
      }),
    }
  )
);

export const appSelectors = {
  gold: (s: AppState) => s.gold,
  ticks: (s: AppState) => s.ticks,
  simConnected: (s: AppState) => s.simConnected,

  brushKind: (s: AppState) => s.brushKind,
  setBrushKind: (s: AppState) => s.setBrushKind,

  uiPanel: (s: AppState) => s.uiPanel,
  selectedBuildingId: (s: AppState) => s.selectedBuildingId,
  closePanel: (s: AppState) => s.closePanel,

  editorEnabled: (s: AppState) => s.editorEnabled,
  setEditorEnabled: (s: AppState) => s.setEditorEnabled,
  creativeEnabled: (s: AppState) => s.creativeEnabled,
  setCreativeEnabled: (s: AppState) => s.setCreativeEnabled,
  editorLayer: (s: AppState) => s.editorLayer,
  setEditorLayer: (s: AppState) => s.setEditorLayer,
  selectedSpriteKey: (s: AppState) => s.selectedSpriteKey,
  setSelectedSpriteKey: (s: AppState) => s.setSelectedSpriteKey,
  selectedRotation: (s: AppState) => s.selectedRotation,
  rotateSelected: (s: AppState) => s.rotateSelected,
  exportSceneMapJson: (s: AppState) => s.exportSceneMapJson,

  applyOfflineProgress: (s: AppState) => s.applyOfflineProgress,
  applySimSnapshot: (s: AppState) => s.applySimSnapshot,
  setSimConnected: (s: AppState) => s.setSimConnected,
  markSavedNow: (s: AppState) => s.markSavedNow,
} as const;
