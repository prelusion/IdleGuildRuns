export type TilesetDef = {
  id: "grass" | "nether" | "path";
  baseUrl: string;      // served from /public
  xMax: number;
  yMax: number;
};

export const TILESETS: TilesetDef[] = [
  { id: "nether", baseUrl: "/assets/tiles/nether", xMax: 7, yMax: 7 },
  { id: "path", baseUrl: "/assets/tiles/path", xMax: 7, yMax: 7 },
  { id: "grass", baseUrl: "/assets/tiles/grass", xMax: 7, yMax: 7 },
];

export function makeKey(id: string, x: number, y: number) {
  return `${id}_${x}_${y}`;
}

export function makeUrl(baseUrl: string, x: number, y: number) {
  return `${baseUrl}/tile_${x}_${y}.png`;
}

export function allSpriteKeys(): string[] {
  const keys: string[] = [];
  for (const ts of TILESETS) {
    for (let x = 0; x <= ts.xMax; x++) {
      for (let y = 0; y <= ts.yMax; y++) {
        keys.push(makeKey(ts.id, x, y));
      }
    }
  }
  return keys;
}
