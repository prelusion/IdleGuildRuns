export type Rotation = 0 | 90 | 180 | 270 | 360;

export type PlacedTile = {
  key: string;
  rotation: Rotation;
};

export type PlacedFreeObject = {
  key: string;
  x: number;
  y: number;
  z?: number; // explicit depth (optional)
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

  // free-positioned objects (not grid-bound)
  objectsFree?: PlacedFreeObject[];

  // optional generator metadata
  meta?: unknown;
};