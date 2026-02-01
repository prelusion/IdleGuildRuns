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

const urlByKey = new Map<string, string>(
  MAPS_LIBRARY_MANIFEST.sprites.map((s) => [s.key, s.url])
);

export function mapsLibraryUrlForKey(key: string): string | null {
  return urlByKey.get(key) ?? null;
}