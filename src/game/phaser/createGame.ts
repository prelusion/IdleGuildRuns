import Phaser from "phaser";
import type { PlacedTile, SceneMap } from "./scenes/maps/scenes";
import { TownScene } from "../scenes/TownScene";
import { HellScene } from "../scenes/HellScene";
import type { MapSceneBase } from "../scenes/MapSceneBase";
import type {MapsLibraryManifest} from "../assets/mapsLibrary.ts";

export type SceneKey = "TownScene" | "HellScene";

export type GameBridge = {
  startScene: (key: SceneKey) => void;
  resize: (size: number) => void;
  getCanvas: () => HTMLCanvasElement | null;
  destroy: () => void;

  setSceneMap: (map: SceneMap) => void;
  placeTile: (tx: number, ty: number, placed: PlacedTile | null, layer: "ground" | "objects") => void;
  setMapsManifest: (m: MapsLibraryManifest) => void;
};

function getActiveMapScene(game: Phaser.Game): MapSceneBase | null {
  const active = game.scene.getScenes(true);
  for (const s of active) {
    if ((s as any).setSceneMap && (s as any).placeTile) return s as MapSceneBase;
  }
  return null;
}

export function createGame(parent: HTMLDivElement, initialSize: number): GameBridge {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: initialSize,
    height: initialSize,
    backgroundColor: "#111827",
    scene: [TownScene, HellScene],
    fps: { target: 60, forceSetTimeOut: true },
    render: { pixelArt: true, roundPixels: true },
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
  };

  const game = new Phaser.Game(config);
  let pendingManifest: MapsLibraryManifest | null = null;

  let pendingMap: SceneMap | null = null;
  let pendingResize: number | null = initialSize;

  //  boot gating
  let isReady = false;
  let queuedScene: SceneKey | null = null;

  const applyPendingToActive = () => {
    const s = getActiveMapScene(game);
    if (!s) return;

    if (pendingManifest) {
      (s as any).setMapsManifest?.(pendingManifest);
      pendingManifest = null;
    }

    if (pendingResize != null) {
      game.scale.resize(pendingResize, pendingResize);
      s.onViewportResized?.();
      pendingResize = null;
    }

    if (pendingMap) {
      s.setSceneMap(pendingMap);
      pendingMap = null;
    }
  };

  game.events.once(Phaser.Core.Events.READY, () => {
    isReady = true;

    // If React asked for a scene before READY, do it now.
    if (queuedScene) {
      const k = queuedScene;
      queuedScene = null;
      startScene(k);
    } else {
      // If nothing requested, still apply pending size/map once something is active.
      applyPendingToActive();
    }
  });

  const startScene = (key: SceneKey) => {
    //  if Phaser not ready yet, queue it and bail
    if (!isReady) {
      queuedScene = key;
      return;
    }

    // If already active, just apply pending
    if (game.scene.isActive(key)) {
      applyPendingToActive();
      return;
    }

    // Stop any active scenes (hard reset)
    for (const s of game.scene.getScenes(true)) {
      game.scene.stop(s.scene.key);
    }

    // Start requested
    game.scene.start(key);

    // Wait until the scene has actually created, then apply pending
    const scene = game.scene.getScene(key) as Phaser.Scene | null;
    if (!scene) {
      // Extremely rare after READY, but safe guard
      return;
    }

    scene.events.once(Phaser.Scenes.Events.CREATE, () => {
      applyPendingToActive();
    });
  };

  return {
    startScene,

    setSceneMap: (map) => {
      pendingMap = map;
      applyPendingToActive();
    },

    setMapsManifest: (m) => {
      pendingManifest = m;
      applyPendingToActive();
    },

    placeTile: (tx, ty, placed, layer) => {
      getActiveMapScene(game)?.placeTile(tx, ty, placed, layer);
    },

    resize: (size) => {
      pendingResize = size;
      applyPendingToActive();
    },

    getCanvas: () => parent.querySelector("canvas"),
    destroy: () => game.destroy(true),
  };
}