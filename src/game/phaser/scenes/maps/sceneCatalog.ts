import type { SceneMap } from "./scenes";
import type { SceneId } from "../../../../state/gameTypes";

const PLAINS = import.meta.glob("./openworld/plains/*.json", { eager: true });
const SNOWYFALLS = import.meta.glob("./openworld/snowyfalls/*.json", { eager: true });

export type SceneGroup = "plains" | "snowyfalls" | "town" | "hell";
export type OpenWorldGroup = "plains" | "snowyfalls";

export type MobConfig = {
  enabled?: boolean;
  types?: string[];
  levelMin?: number;
  levelMax?: number;
};

export type SceneDef = {
  id: SceneId;
  name: string;
  group: SceneGroup;
  map: SceneMap;
  mobs?: MobConfig;
};

type JsonModule<T> = { default: T };

const DEFAULT_MOBS: MobConfig = { enabled: true, levelMin: 1, levelMax: 3 };

function fileBaseName(path: string): string {
  // "./openworld/plains/autumn_1.json" -> "autumn_1"
  const file = path.split("/").pop() ?? path;
  return file.endsWith(".json") ? file.slice(0, -5) : file;
}

function buildDefs(group: OpenWorldGroup, globObj: Record<string, unknown>): SceneDef[] {
  const entries = Object.entries(globObj);

  // stable ordering: sort by filename
  entries.sort((a, b) => fileBaseName(a[0]).localeCompare(fileBaseName(b[0])));

  return entries.map(([path, mod]) => {
    const base = fileBaseName(path);

    // scene ids become: "plains/autumn_1" or "snowyfalls/winter-medieval_1"
    const id = `${group}/${base}` as SceneId;

    // Vite eager JSON modules export a { default } object
    const map = (mod as JsonModule<SceneMap>).default;

    return {
      id,
      name: base.replaceAll("_", " "),
      group,
      map,
      mobs: DEFAULT_MOBS,
    };
  });
}

// Export a single catalog
export const OPENWORLD_SCENES: SceneDef[] = [
  ...buildDefs("plains", PLAINS),
  ...buildDefs("snowyfalls", SNOWYFALLS),
];

export function getOpenWorldScene(id: string): SceneDef | undefined {
  return OPENWORLD_SCENES.find((s) => s.id === id);
}

export function getFirstOpenWorldSceneId(group: OpenWorldGroup): SceneId | null {
  const s = OPENWORLD_SCENES.find((x) => x.group === group);
  return s?.id ?? null;
}
