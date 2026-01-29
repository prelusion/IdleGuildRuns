import type { Accessory, Gear, Item, Weapon } from "./types.ts";

type Props = {
  item: Item | Gear | Weapon | Accessory;
  customClass: string;
};

const QUALITY = {
  common: {
    label: "Common",
    ring: "from-zinc-300 via-zinc-100 to-zinc-400",
    glow: "rgba(245,245,245,0.30)",
    accent: "text-zinc-100",
    muted: "text-zinc-300/80",
  },
  uncommon: {
    label: "Uncommon",
    ring: "from-emerald-400 via-emerald-200 to-emerald-500",
    glow: "rgba(52,211,153,0.30)",
    accent: "text-emerald-100",
    muted: "text-emerald-200/80",
  },
  rare: {
    label: "Rare",
    ring: "from-sky-500 via-sky-200 to-sky-600",
    glow: "rgba(56,189,248,0.28)",
    accent: "text-sky-100",
    muted: "text-sky-200/80",
  },
  epic: {
    label: "Epic",
    ring: "from-fuchsia-500 via-violet-300 to-fuchsia-700",
    glow: "rgba(217,70,239,0.28)",
    accent: "text-fuchsia-100",
    muted: "text-fuchsia-200/80",
  },
  legendary: {
    label: "Legendary",
    ring: "from-amber-500 via-yellow-200 to-orange-600",
    glow: "rgba(251,191,36,0.28)",
    accent: "text-amber-100",
    muted: "text-amber-200/80",
  },
} as const;

const PRIMARY_LABELS: Record<
  keyof NonNullable<Accessory["primaryStats"]>,
  string
> = {
  stamina: "STA",
  strength: "STR",
  intellect: "INT",
  agility: "AGI",
  spirit: "SPI",
};

const SECONDARY_LABELS: Record<
  keyof NonNullable<Accessory["secondaryStats"]>,
  string
> = {
  leech: "Leech",
  speed: "Speed",
  haste: "Haste",
  crit: "Crit",
  resistances: "Resists",
};

function isWeapon(x: Item | Gear | Weapon | Accessory): x is Weapon {
  return (
    "fromDamage" in x &&
    "toDamage" in x &&
    "parry" in x &&
    "block" in x &&
    "range" in x
  );
}

function isGear(x: Item | Gear | Weapon | Accessory): x is Gear {
  return "armor" in x && "type" in x && "rank" in x && !isWeapon(x);
}

function hasStats(
  x: Item | Gear | Weapon | Accessory
): x is Gear | Weapon | Accessory {
  return "primaryStats" in x && "secondaryStats" in x;
}

function sumResists(r: Accessory["secondaryStats"]["resistances"]) {
  return (
    r.fireResistance +
    r.frostResistance +
    r.arcaneResistance +
    r.shadowResistance +
    r.poisonResistance +
    r.stunResistance
  );
}

function StatRow({
                   label,
                   value,
                 }: {
  label: string;
  value: number;
}) {
  const sign = value > 0 ? "+" : "";
  return (
    <div className="flex items-center justify-between gap-3 text-[11px] leading-4">
      <span className="text-white/70">{label}</span>
      <span className="font-semibold tabular-nums text-white/90">
        {sign}
        {value}
      </span>
    </div>
  );
}

export default function ItemPreview({ item, customClass }: Props) {
  const q = QUALITY[item.quality];

  const primary = hasStats(item) ? item.primaryStats : null;
  const secondary = hasStats(item) ? item.secondaryStats : null;

  return (
    <div className={"w-[230px] top-10 right-90 z-50 "+ customClass }>
      {/* Gradient fantasy frame */}
      <div className="relative rounded-2xl p-[2px]">
        {/* Outer gradient ring */}
        <div
          className={[
            "absolute inset-0 rounded-2xl bg-gradient-to-br",
            q.ring,
            "opacity-90",
          ].join(" ")}
        />

        {/* Ornamental “branches” overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl">
          {/* subtle inner filigree lines */}
          <div className="absolute inset-2 rounded-xl border border-white/10" />
        </div>

        {/* Inner panel */}
        <div
          className="relative rounded-2xl bg-zinc-950/90 backdrop-blur p-4"
          style={{
            boxShadow: `0 0 0 1px rgba(255,255,255,0.08) inset, 0 10px 30px rgba(0,0,0,0.45), 0 0 30px ${q.glow}`,
          }}
        >
          {/* Header: icon + name */}
          <div className="flex gap-3">
            <div className="relative">
              {/* Icon frame */}
              <div className="rounded-xl p-[2px] bg-gradient-to-br from-white/25 to-white/5">
                <div className="h-14 w-14 rounded-[10px] bg-zinc-900/80 grid place-items-center overflow-hidden">
                  <img
                    src={"public/assets/"+item.src}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    draggable={false}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                  <span className="text-white/60 text-xl select-none">✦</span>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="shrink-0 flex justify-end">
                <span
                  className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold bg-white/5 border border-white/10 text-white/75">

                {q.label}
                </span>
                <span
                  className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold bg-white/5 border border-white/10 text-white/75">
                    {isWeapon(item)
                      ? "Weapon"
                      : isGear(item)
                        ? `${item.type.toUpperCase()} • ${item.rank.toUpperCase()}`
                        : "Item"}
                  </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div
                    className={[
                      "text-base font-semibold leading-5 ",
                      q.accent,
                    ].join(" ")}
                  >
                    {item.name}
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className={"flex flex-col w-full items-center justify-center"}>

            <div className={["text-xs mt-1", q.muted].join(" ")}>
              Value:{" "}
              <span className="font-semibold text-white/90 tabular-nums">
                      {item.value}
                    </span>{" "}
              · Gold:{" "}
              <span className="font-semibold text-white/90 tabular-nums">
                      {item.monetaryValue}
                    </span>
            </div>
            {/* Weapon/Gear extra line */}
            {(isWeapon(item) || isGear(item)) && (
              <div className="mt-2 text-[11px] text-white/70 flex flex-wrap gap-x-3 gap-y-1  items-center justify-center">
                {isWeapon(item) && (
                  <>
                      <span className="tabular-nums">
                        DMG:{" "}
                        <span className="text-white/90 font-semibold">
                          {item.fromDamage}-{item.toDamage}
                        </span>
                      </span>
                    <span className="tabular-nums">
                        Parry:{" "}
                      <span className="text-white/90 font-semibold">
                          {item.parry}
                        </span>
                      </span>
                    <span className="tabular-nums">
                        Block:{" "}
                      <span className="text-white/90 font-semibold">
                          {item.block}
                        </span>
                      </span>
                    <span className="tabular-nums">
                        Range:{" "}
                      <span className="text-white/90 font-semibold">
                          {item.range}
                        </span>
                      </span>
                    <span className="tabular-nums">
                        Armor:{" "}
                      <span className="text-white/90 font-semibold">
                          {item.armor}
                        </span>
                      </span>
                  </>
                )}

                {isGear(item) && (
                  <span className="tabular-nums">
                      Armor:{" "}
                    <span className="text-white/90 font-semibold">
                        {item.armor}
                      </span>
                    </span>
                )}
              </div>
            )}
          </div>

          {/* Stats: primary under icon, secondary to the right */}
          {primary && secondary && (
            <div className="grid grid-rows-1 gap-3">
              {/* Spacer column aligns under icon */}
              <div className="pt-2">
                <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">
                  Primary
                </div>
                <div className="space-y-1 rounded-xl bg-white/5 border border-white/10 p-2 grid grid-cols-2 gap-x-4">
                  {(Object.keys(PRIMARY_LABELS) as Array<keyof typeof PRIMARY_LABELS>).map(
                    (k) => (
                      <StatRow key={k} label={PRIMARY_LABELS[k]} value={primary[k]} />
                    )
                  )}
                </div>
              </div>

              <div className="">
                <div className="flex items-baseline justify-between">
                  <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">
                    Secondary
                  </div>
                  <div className="text-[10px] text-white/45">
                    Total Resists:{" "}
                    <span className="font-semibold text-white/75 tabular-nums">
                      {sumResists(secondary.resistances)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 rounded-xl bg-white/5 border border-white/10 p-2">
                    <StatRow label={SECONDARY_LABELS.leech} value={secondary.leech} />
                    <StatRow label={SECONDARY_LABELS.speed} value={secondary.speed} />
                    <StatRow label={SECONDARY_LABELS.haste} value={secondary.haste} />
                    <StatRow label={SECONDARY_LABELS.crit} value={secondary.crit} />
                  </div>

                  <div className="space-y-[.5] rounded-xl bg-white/5 border border-white/10 p-2">
                    <StatRow label="Fire" value={secondary.resistances.fireResistance} />
                    <StatRow label="Frost" value={secondary.resistances.frostResistance} />
                    <StatRow label="Arcane" value={secondary.resistances.arcaneResistance} />
                    <StatRow label="Shadow" value={secondary.resistances.shadowResistance} />
                    <StatRow label="Poison" value={secondary.resistances.poisonResistance} />
                    <StatRow label="Stun" value={secondary.resistances.stunResistance} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* If item has no stats, keep it clean */}
          {!primary && (
            <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white/65">
              No stats on this item type.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
