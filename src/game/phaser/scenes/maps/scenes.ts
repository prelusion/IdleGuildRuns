import town from "./town.json";
import hell from "./hell.json";

export type Rotation = 0 | 90 | 180 | 270 | 360;

export type PlacedTile = {
  key: string;
  rotation: Rotation;
};

export type PlacedFreeObject = {
  key: string;
  x: number;
  y: number;
  z?: number; //  NEW: explicit depth
  rotation: Rotation;
  scale?: { x: number; y: number };
};

export type SceneMap = {
  scene: string;
  tileSize: number;
  width: number;
  height: number;

  ground: (PlacedTile | null)[][];
  objects: (PlacedTile | null)[][];

  //  NEW: free-positioned objects (not grid-bound)
  objectsFree?: PlacedFreeObject[];

  // optional generator metadata
  meta?: any;
};

export type SceneWrapper = {
  scene: string,
  sceneMap: SceneMap,
}

export const Scenes: SceneWrapper[] = [
  {
    scene: "town",
    sceneMap: town as SceneMap,
  },
  {
    scene: "hell",
    sceneMap: hell as SceneMap
  },
]