import Phaser from "phaser";
import { TownScene, type TownSceneCallbacks } from "./scenes/TownScene";
import type {PlacedTile, SceneMap} from "./scenes/maps/scenes.ts";


export type GameBridge = {
  setTownCallbacks: (cb: TownSceneCallbacks) => void;
  resize: (size: number) => void;
  getCanvas: () => HTMLCanvasElement | null;
  destroy: () => void;
  setSceneMap: (map: SceneMap) => void;
  placeTile: (tx: number, ty: number, placed: PlacedTile | null, layer: "ground" | "objects") => void;
};

function getTownScene(game: Phaser.Game): TownScene | null {
  const s = game.scene.getScene("TownScene");
  return s instanceof TownScene ? s : null;
}

export function createGame(parent: HTMLDivElement, initialSize: number): GameBridge {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: initialSize,
    height: initialSize,
    backgroundColor: "#111827",
    scene: [TownScene],
    fps: { target: 60, forceSetTimeOut: true },
    render: { pixelArt: true, roundPixels: true },
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },

  };

  const game = new Phaser.Game(config);


  return {
    setSceneMap: (map) => {
      getTownScene(game)?.setSceneMap(map);
    },
    placeTile: (tx, ty, placed, layer) => {


      getTownScene(game)?.placeTile(tx, ty, placed, layer);
    },


    setTownCallbacks: (cb) => {
      getTownScene(game)?.setCallbacks(cb);
    },

    resize: (size: number) => {
      game.scale.resize(size, size);
      getTownScene(game)?.onViewportResized();
    },


    getCanvas: () => parent.querySelector("canvas"),

    destroy: () => game.destroy(true),
  };
}


