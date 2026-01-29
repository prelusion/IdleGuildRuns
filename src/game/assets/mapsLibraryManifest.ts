// src/game/assets/mapsLibraryManifest.ts
import manifest from "../../../public/assets/maps_library.manifest.json";

export type MapsLibrarySprite = {
  key: string;
  url: string;
  pack: string;
  category: string;
  subcategory: string;
  file: string;
};

export type MapsLibraryManifest = {
  version: number;
  generatedAt: string;
  root: string;
  sprites: MapsLibrarySprite[];
  packs: Record<string, Record<string, Record<string, string[]>>>;
};

export const MAPS_LIBRARY_MANIFEST = manifest as MapsLibraryManifest;

const urlByKey = new Map<string, string>(
  MAPS_LIBRARY_MANIFEST.sprites.map((s) => [s.key, s.url])
);

export function mapsLibraryUrlForKey(key: string): string | null {
  return urlByKey.get(key) ?? null;
}

export function mapsLibraryAllKeys(): string[] {
  return MAPS_LIBRARY_MANIFEST.sprites.map((s) => s.key);
}
