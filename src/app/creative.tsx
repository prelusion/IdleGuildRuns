import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../state/store.ts";
import type { Accessory, Gear, Item, Weapon } from "./types.ts";
import ItemPreview from "./ItemPreview.tsx";

type AnyItem = (Item | Gear | Weapon | Accessory) & {
  __group: "weapons" | "armor" | "accessories";
  __slot: string;
};

type GroupFilter = "all" | "weapons" | "armor" | "accessories";
type Quality = "common" | "uncommon" | "rare" | "epic" | "legendary";
type SortKey = "name" | "quality" | "group" | "slot" | "rank" | "gearType";

const QUALITY_META: Record<
  Quality,
  { label: string; border: string; tint: string; iconTint: string; order: number }
> = {
  common: {
    label: "Common",
    border: "border-zinc-300/60",
    tint: "from-zinc-400/20 to-zinc-200/5",
    iconTint: "rgba(244,244,245,0.92)",
    order: 1,
  },
  uncommon: {
    label: "Uncommon",
    border: "border-emerald-400/60",
    tint: "from-emerald-500/20 to-emerald-300/5",
    iconTint: "rgba(52,211,153,0.92)",
    order: 2,
  },
  rare: {
    label: "Rare",
    border: "border-sky-400/60",
    tint: "from-sky-500/20 to-sky-300/5",
    iconTint: "rgba(56,189,248,0.92)",
    order: 3,
  },
  epic: {
    label: "Epic",
    border: "border-fuchsia-400/60",
    tint: "from-fuchsia-500/20 to-violet-300/5",
    iconTint: "rgba(217,70,239,0.92)",
    order: 4,
  },
  legendary: {
    label: "Legendary",
    border: "border-amber-400/60",
    tint: "from-amber-500/20 to-orange-300/5",
    iconTint: "rgba(251,191,36,0.92)",
    order: 5,
  },
};

function isWeapon(x: AnyItem): x is AnyItem & Weapon {
  return "fromDamage" in x && "toDamage" in x && "parry" in x && "block" in x && "range" in x;
}
function isGear(x: AnyItem): x is AnyItem & Gear {
  return "armor" in x && "type" in x && "rank" in x && !isWeapon(x);
}

function normalizeSrc(src: string) {
  // Your JSON shows: "icons/axe/axe-0.png" etc.
  // Your public folder shows: /public/assets/icons/gear/...
  // If you actually serve icons under /assets/, this makes them work:
  if (src.startsWith("/")) return src;
  if (src.startsWith("assets/")) return `/${src}`;
  if (src.startsWith("icons/")) return `/assets/${src}`;

  return `/${src}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json();
}

export default function Creative() {
  const creativeEnabled = useAppStore((s) => s.creativeEnabled);
  const setInventoryItems = useAppStore((s) => s.setInventoryItems);

  const [items, setItems] = useState<AnyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [slot, setSlot] = useState<string>("all");
  const [quality, setQuality] = useState<"all" | Quality>("all");
  const [gearType, setGearType] = useState<"all" | "cloth" | "leather" | "mail" | "plate">("all");

  // sorting
  const [sortKey, setSortKey] = useState<SortKey>("quality");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Load everything once
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setErr(null);

      try {
        // These paths assume you put the jsons under /public/assets/data/...
        // Adjust base path if yours differs.
        const base = "public/assets";

        const accessories = ["neckless", "ring", "trinket"] as const;
        const armor = ["belt", "bracers", "chest", "feet", "helmet", "trousers"] as const;
        const weapons = ["axe", "bow", "crossbow", "dagger", "mace", "shield", "staff", "sword", "tome"] as const;

        const reqs: Array<Promise<AnyItem[]>> = [];

        for (const s of accessories) {
          reqs.push(
            fetchJson<Array<Accessory>>(`${base}/out-accessories/${s}.json`).then((arr) =>
              arr.map((it) => ({ ...(it), __group: "accessories", __slot: s }))
            )
          );
        }

        for (const s of armor) {
          reqs.push(
            fetchJson<Array<Gear>>(`${base}/out-armor/${s}.json`).then((arr) =>
              arr.map((it) => ({ ...(it), __group: "armor", __slot: s }))
            )
          );
        }

        for (const s of weapons) {
          reqs.push(
            fetchJson<Array<Weapon>>(`${base}/out-weapons/${s}.json`).then((arr) =>
              arr.map((it) => ({ ...(it), __group: "weapons", __slot: s }))
            )
          );
        }

        const chunks = await Promise.all(reqs);
        const all = chunks.flat();

        if (!cancelled) setItems(all);
      } catch (e: unknown) {
        if (cancelled) return;

        const message =
          e instanceof Error ? e.message :
            typeof e === "string" ? e :
              "Failed loading items";

        setErr(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // only load if panel can be used (optional)
    if (creativeEnabled) loadAll();

    return () => {
      cancelled = true;
    };
  }, [creativeEnabled]);

  const slots = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.__slot);
    return ["all", ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let arr = items;

    if (group !== "all") arr = arr.filter((it) => it.__group === group);
    if (slot !== "all") arr = arr.filter((it) => it.__slot === slot);
    if (quality !== "all") arr = arr.filter((it) => it.quality === quality);

    if (gearType !== "all") {
      arr = arr.filter((it) => (isGear(it) ? it.type === gearType : false));
    }

    if (needle) {
      arr = arr.filter((it) => it.name.toLowerCase().includes(needle));
    }

    const dir = sortDir === "asc" ? 1 : -1;

    const get = (it: AnyItem) => {
      switch (sortKey) {
        case "name":
          return it.name.toLowerCase();
        case "quality":
          return QUALITY_META[it.quality as Quality].order;
        case "group":
          return it.__group;
        case "slot":
          return it.__slot;
        case "rank":
          return (it).rank ?? "";
        case "gearType":
          return isGear(it) ? it.type : "";
        default:
          return "";
      }
    };

    return [...arr].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [items, q, group, slot, quality, gearType, sortKey, sortDir]);

  return (
    <div
      className={[
        "pointer-events-auto fixed top-2 right-20 w-[340px] max-h-[70%]  rounded-xl border border-white/15 bg-black/45 p-2.5 backdrop-blur",
        creativeEnabled ? "visible" : "invisible",
      ].join(" ")}
    >
      {
        selectedItem &&
        <ItemPreview item={selectedItem} />
      }
      {/* Controls */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name…"
          className="col-span-2 h-8 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none placeholder:text-white/35"
        />

        <select
          value={group}
          onChange={(e) => {
            setGroup(e.target.value as GroupFilter);
            setSlot("all");
          }}
          className="h-8 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none"
        >
          <option value="all">All</option>
          <option value="weapons">Weapons</option>
          <option value="armor">Armor</option>
          <option value="accessories">Accessories</option>
        </select>

        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          className="h-8 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none"
        >
          {slots.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          className="h-8 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none"
        >
          <option value="all">Any quality</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="epic">Epic</option>
          <option value="legendary">Legendary</option>
        </select>

        <select
          value={gearType}
          onChange={(e) => setGearType(e.target.value)}
          className="h-8 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none"
          title="Only applies to armor (Gear)"
        >
          <option value="all">Any gear type</option>
          <option value="cloth">Cloth</option>
          <option value="leather">Leather</option>
          <option value="mail">Mail</option>
          <option value="plate">Plate</option>
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="h-8 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none"
        >
          <option value="quality">Sort: quality</option>
          <option value="name">Sort: name</option>
          <option value="group">Sort: group</option>
          <option value="slot">Sort: slot</option>
          <option value="rank">Sort: rank</option>
          <option value="gearType">Sort: gear type</option>
        </select>

        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="h-8 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white/90 hover:bg-white/15"
        >
          {sortDir === "asc" ? "Asc ↑" : "Desc ↓"}
        </button>
      </div>

      {/* Status */}
      <div className="mb-2 flex items-center justify-between text-[11px] text-white/60">
        <span>
          {loading ? "Loading…" : err ? "Error" : "Items"}:{" "}
          <span className="text-white/85 tabular-nums">{filtered.length}</span>
        </span>
        {err && <span className="text-rose-300/90">{err}</span>}
      </div>

      {/* Grid */}
      <div className="max-h-[52vh] overflow-auto pr-1">
        <div className="grid grid-cols-4 gap-2">
          {filtered.map((it, idx) => {
            const qm = QUALITY_META[it.quality as Quality];

            return (
              <button
                key={`${it.__group}-${it.__slot}-${it.name}-${idx}`}
                className="group rounded-lg p-1 text-left hover:bg-white/5"
                title={`${it.name} • ${it.__group}/${it.__slot} • ${qm.label}`}
                onClick={() => {
                  setSelectedItem(it);
                  setInventoryItems(it);
                }}
              >
                <div
                  className={[
                    "relative h-14 w-14 rounded-lg border bg-gradient-to-br overflow-hidden",
                    qm.border,
                    qm.tint,
                  ].join(" ")}
                  style={{
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
                  }}
                >
                  <img
                    src={normalizeSrc(it.src)}
                    alt={it.name}
                    className="h-full w-full object-cover"
                    style={{
                      filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.55))`,
                      mixBlendMode: "screen",
                      opacity: 0.95,
                    }}
                    draggable={false}
                  />
                  {/* color wash */}
                </div>

                <div className="mt-1 line-clamp-2 text-[10px] leading-3 text-white/85">
                  {it.name}
                </div>
              </button>
            );
          })}
        </div>

        {!loading && !err && filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-white/60">
            No items match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
