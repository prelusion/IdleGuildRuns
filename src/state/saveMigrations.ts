export const SAVE_VERSION = 1;

export type SaveV1 = {
  version: 1;
  lastSavedAt: number;
  gold: number;
  ticks: number;
};

export function migrateSave(raw: unknown): SaveV1 {
  // Very defensive: treat anything unknown as a fresh save.
  const now = Date.now();

  if (!raw || typeof raw !== "object") {
    return { version: 1, lastSavedAt: now, gold: 0, ticks: 0 };
  }

  const r = raw as Partial<SaveV1>;

  // If already v1, normalize missing fields.
  if (r.version === 1) {
    return {
      version: 1,
      lastSavedAt: typeof r.lastSavedAt === "number" ? r.lastSavedAt : now,
      gold: typeof r.gold === "number" ? r.gold : 0,
      ticks: typeof r.ticks === "number" ? r.ticks : 0,
    };
  }

  // Future: handle migrations from older versions here.
  return { version: 1, lastSavedAt: now, gold: 0, ticks: 0 };
}
