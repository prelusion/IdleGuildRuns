import manifest from "../../../public/assets/maps_library.manifest.json";

export type MapsLibrarySprite = {
  key: string;
  url: string;
  pack: string;
  category: string;
  subcategory: string;
  file: string;

  kind: "tile" | "object";
  scale: { x: number; y: number };
  anchor: { x: number; y: number };
};

export type MapsLibraryManifest = {
  version: number;
  generatedAt: string;
  root: string;
  sprites: MapsLibrarySprite[];
  packs: Record<
    string,
    {
      tile: Record<string, Record<string, string[]>>;
      object: Record<string, Record<string, string[]>>;
    }
  >;
};

export const MAPS_LIBRARY_MANIFEST = manifest as MapsLibraryManifest;

// Fast lookup for urls
const urlByKey = new Map<string, string>(
  MAPS_LIBRARY_MANIFEST.sprites.map((s) => [s.key, s.url])
);

export function mapsLibraryUrlForKey(key: string): string | null {
  return urlByKey.get(key) ?? null;
}

export function mapsLibraryAllKeys(kind?: "tile" | "object"): string[] {
  if (!kind) return MAPS_LIBRARY_MANIFEST.sprites.map((s) => s.key);
  return MAPS_LIBRARY_MANIFEST.sprites.filter((s) => s.kind === kind).map((s) => s.key);
}

export function mapsLibraryKindForKey(key: string): "tile" | "object" | null {
  const s = MAPS_LIBRARY_MANIFEST.sprites.find((x) => x.key === key);
  return s?.kind ?? null;
}

const spriteByKey = new Map(MAPS_LIBRARY_MANIFEST.sprites.map((s) => [s.key, s]));

export function mapsLibrarySpriteMeta(key: string): MapsLibrarySprite | null {
  return spriteByKey.get(key) ?? null;
}
