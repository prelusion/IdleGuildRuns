import React, {useMemo, useState} from "react";
import {useAppStore} from "../state/store.ts";
import type {Accessory, Gear, Item, Weapon} from "./types.ts";
import ItemPreview from "./ItemPreview.tsx";

type AnyItem = Item | Gear | Weapon | Accessory;
type Quality = "common" | "uncommon" | "rare" | "epic" | "legendary";

const QUALITY_RING: Record<Quality, string> = {
  common: "border-zinc-300/60",
  uncommon: "border-emerald-400/60",
  rare: "border-sky-400/60",
  epic: "border-fuchsia-400/60",
  legendary: "border-amber-400/60",
};

const QUALITY_TINT: Record<Quality, string> = {
  common: "rgba(244,244,245,0.82)",
  uncommon: "rgba(52,211,153,0.82)",
  rare: "rgba(56,189,248,0.82)",
  epic: "rgba(217,70,239,0.82)",
  legendary: "rgba(251,191,36,0.82)",
};

function normalizeSrc(src: string) {
  if (!src) return "";
  if (src.startsWith("/")) return src;
  if (src.startsWith("assets/")) return `/${src}`;
  if (src.startsWith("icons/")) return `/assets/${src}`;
  return `/${src}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Inventory() {
  const inventorySize = useAppStore((s: any) => s.inventorySize) as number;
  const inventoryItems = useAppStore((s: any) => s.inventoryItems) as (AnyItem | null)[];

  const ROWS = 5;
  const cols = useMemo(() => Math.ceil(Math.max(1, inventorySize) / ROWS), [inventorySize]);
  const slotCount = useMemo(() => ROWS * cols, [ROWS, cols]);

  const slots = useMemo(() => {
    const out: Array<AnyItem | null> = new Array(slotCount).fill(null);
    for (let i = 0; i < Math.min(inventoryItems?.length ?? 0, slotCount); i++) out[i] = inventoryItems[i];
    return out;
  }, [inventoryItems, slotCount]);

  // hover state
  const [hoverItem, setHoverItem] = useState<AnyItem | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  return (
    <div className={"w-full flex flex-row justify-center gap-10 p-5"}>

      <div className="w-60 pointer-events-auto z-40">
        {/* Preview (always above hovered slot) */}

        {/* Bag background */}
        <div
          className="relative rounded-2xl border border-black/40 p-4 shadow-2xl"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.10), rgba(0,0,0,0) 40%), linear-gradient(135deg, rgba(113,71,32,0.95), rgba(73,43,18,0.95))",
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset",
          }}
        >
          <div className="pointer-events-none absolute inset-2 rounded-xl border border-white/10"/>
          <div className="pointer-events-none absolute inset-3 rounded-lg border border-black/35"/>

          {/* Grid wrapper */}
          <div
            className="rounded-xl p-2"
            style={{
              background: "rgba(0,0,0,0.65)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
            }}
            onMouseLeave={() => {
              setHoverItem(null);
              setAnchorRect(null);
            }}
          >
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
              }}
            >
              {slots.map((it, idx) => {
                const quality = (it?.quality as Quality | undefined) ?? "common";

                return (
                  <div
                    key={idx}
                    className={[
                      "relative aspect-square rounded-lg border bg-black/85",
                      it ? QUALITY_RING[quality] : "border-white/10",
                    ].join(" ")}
                    style={{boxShadow: "0 0 0 1px rgba(255,255,255,0.05) inset"}}
                    onMouseEnter={(e) => {
                      if (!it) return;
                      setHoverItem(it);
                      setAnchorRect((e.currentTarget as HTMLDivElement).getBoundingClientRect());
                    }}
                    onMouseMove={(e) => {
                      // keep it anchored if layout/scroll changes slightly while hovering
                      if (!it) return;
                      setAnchorRect((e.currentTarget as HTMLDivElement).getBoundingClientRect());
                    }}
                    onMouseLeave={() => {
                      setHoverItem(null);
                      setAnchorRect(null);
                    }}
                  >
                    {it && (
                      <>
                        <img
                          src={normalizeSrc(it.src)}
                          alt={it.name}
                          className="absolute inset-[10%] h-[80%] w-[80%] object-contain"
                          draggable={false}
                          style={{
                            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
                            mixBlendMode: "screen",
                            opacity: 0.95,
                          }}
                        />
                        <div
                          className="absolute inset-0 rounded-lg"
                          style={{
                            background: QUALITY_TINT[quality],
                            mixBlendMode: "color",
                            opacity: 0.55,
                          }}
                        />
                        <div
                          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                          style={{
                            background: QUALITY_TINT[quality],
                            boxShadow: `0 0 10px ${QUALITY_TINT[quality]}`,
                          }}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 text-[11px] text-white/70">
              Slots:{" "}
              <span className="text-white/90 font-semibold tabular-nums">{inventorySize}</span>{" "}
              <span className="text-white/50">
              ({ROWS}×{cols})
            </span>
            </div>
          </div>
        </div>
      </div>



      {hoverItem && anchorRect && (
          <ItemPreview item={hoverItem as any}/>
      )}

      <div className="z-50 text-center align-middle w-[360px]">
      </div>
    </div>
  );
}
