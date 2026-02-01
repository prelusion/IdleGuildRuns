import Phaser from "phaser";
import type { PlacedTile, SceneMap } from "./scenes/maps/scenes";
import { TownScene } from "../scenes/TownScene";
import { HellScene } from "../scenes/HellScene";
import { OpenWorldScene } from "../scenes/OpenWorldScene";
import type { MapSceneBase } from "../scenes/MapSceneBase";
import type { MapsLibraryManifest } from "../assets/mapsLibraryManifest";

export type SceneKey = "TownScene" | "HellScene" | "OpenWorldScene";

export type GameBridge = {
  startScene: (sceneId: string) => void;
  resize: (size: number) => void;
  getCanvas: () => HTMLCanvasElement | null;
  destroy: () => void;

  setSceneMap: (map: SceneMap) => void;
  placeTile: (
    tx: number,
    ty: number,
    placed: PlacedTile | null,
    layer: "ground" | "objects"
  ) => void;
  setMapsManifest: (m: MapsLibraryManifest) => void;
};

type MapSceneLike = MapSceneBase & {
  setMapsManifest?: (m: MapsLibraryManifest) => void;
};

function isMapScene(scene: Phaser.Scene): scene is MapSceneLike {
  return (
    typeof (scene as MapSceneBase).setSceneMap === "function" &&
    typeof (scene as MapSceneBase).placeTile === "function"
  );
}

function getActiveMapScene(game: Phaser.Game): MapSceneLike | null {
  const active = game.scene.getScenes(true);
  for (const s of active) {
    if (isMapScene(s)) return s;
  }
  return null;
}

function routeSceneKey(sceneId: string): SceneKey {
  if (sceneId === "town") return "TownScene";
  if (sceneId === "hell") return "HellScene";
  return "OpenWorldScene";
}

export function createGame(parent: HTMLDivElement, initialSize: number): GameBridge {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: initialSize,
    height: initialSize,
    backgroundColor: "#111827",
    scene: [TownScene, HellScene, OpenWorldScene],
    fps: { target: 60, forceSetTimeOut: true },
    render: { pixelArt: true, roundPixels: true },
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
  };

  const game = new Phaser.Game(config);

  let pendingManifest: MapsLibraryManifest | null = null;
  let pendingMap: SceneMap | null = null;
  let pendingResize: number | null = initialSize;

  let isReady = false;
  let queuedSceneId: string | null = null;

  const applyPendingToActive = () => {
    const s = getActiveMapScene(game);
    if (!s) return;

    if (pendingManifest) {
      s.setMapsManifest?.(pendingManifest);
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

  const startScene = (sceneId: string) => {
    if (!isReady) {
      queuedSceneId = sceneId;
      return;
    }

    const key = routeSceneKey(sceneId);

    // If already active scene key, just pass data (OpenWorldScene needs sceneId)
    if (game.scene.isActive(key)) {
      if (key === "OpenWorldScene") {
        game.scene.stop(key);
        game.scene.start(key, { sceneId });
      }
      applyPendingToActive();
      return;
    }

    for (const s of game.scene.getScenes(true)) {
      game.scene.stop(s.scene.key);
    }

    game.scene.start(key, { sceneId });

    const scene = game.scene.getScene(key) as Phaser.Scene | null;
    if (!scene) return;

    scene.events.once(Phaser.Scenes.Events.CREATE, () => {
      applyPendingToActive();
    });
  };

  game.events.once(Phaser.Core.Events.READY, () => {
    isReady = true;

    if (queuedSceneId) {
      const id = queuedSceneId;
      queuedSceneId = null;
      startScene(id);
    } else {
      applyPendingToActive();
    }
  });

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
