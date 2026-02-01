export const SAVE_VERSION = 1 as const;

export type SaveV1 = {
  version: 1;
  lastSavedAt: number;
  gold: number;
  ticks: number;
};

export type PersistedSave = SaveV1;

export function migrateSave(raw: unknown): PersistedSave {
  const now = Date.now();

  if (!raw || typeof raw !== "object") {
    return { version: 1, lastSavedAt: now, gold: 0, ticks: 0 };
  }

  const r = raw as Partial<PersistedSave>;

  if (r.version === 1) {
    return {
      version: 1,
      lastSavedAt: typeof r.lastSavedAt === "number" ? r.lastSavedAt : now,
      gold: typeof r.gold === "number" ? r.gold : 0,
      ticks: typeof r.ticks === "number" ? r.ticks : 0,
    };
  }

  // Future migrations from older versions can go here.
  return { version: 1, lastSavedAt: now, gold: 0, ticks: 0 };
}
