import type { SceneMap } from "./scenes";
import type {SceneId} from "../../../../state/gameTypes.ts";

const PLAINS = import.meta.glob("./openworld/plains/*.json", { eager: true });
const SNOWYFALLS = import.meta.glob("./openworld/snowyfalls/*.json", { eager: true });

export type SceneGroup = "plains" | "snowyfalls" | "town" | "hell";


export type SceneDef = {
  id: SceneId;
  name: string;
  group: SceneGroup;
  map: SceneMap;

  mobs?: {
    // example placeholder config
    enabled?: boolean;
    types?: string[];
    levelMin?: number;
    levelMax?: number;
  };
};

function fileBase(path: string) {
  // "./openworld/plains/autumn_1.json" -> "autumn_1"
  const m = path.split("/").pop() ?? path;
  return m.replace(".json", "");
}

function buildDefs(group: SceneGroup, globObj: Record<string, unknown>): SceneDef[] {
  const entries = Object.entries(globObj);

  // stable ordering: sort by filename
  entries.sort((a, b) => fileBase(a[0]).localeCompare(fileBase(b[0])));

  return entries.map(([p, mod]) => {
    const base = fileBase(p);

    //  scene ids become: "plains/autumn_1" or "snowyfalls/winter-medieval_1"
    const id = `${group}/${base}` as SceneId;

    // Vite eager json modules typically export default
    const map = (mod as any).default as SceneMap;

    return {
      id,
      name: base.replaceAll("_", " "),
      group,
      map,
      mobs: { enabled: true, levelMin: 1, levelMax: 3 },
    };
  });
}

//  export a single catalog
export const OPENWORLD_SCENES: SceneDef[] = [
  ...buildDefs("plains", PLAINS),
  ...buildDefs("snowyfalls", SNOWYFALLS),
];

// helpers
export function getOpenWorldScene(id: string): SceneDef | undefined {
  return OPENWORLD_SCENES.find((s) => s.id === id);
}

export function getFirstOpenWorldSceneId(group: SceneGroup): string | null {
  const s = OPENWORLD_SCENES.find((x) => x.group === group);
  return s?.id ?? null;
}
