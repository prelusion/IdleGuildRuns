import type { JSX } from "react";
import { useMemo, useState } from "react";
import ItemPreview from "./ItemPreview";

import {
  type Accessory,
  type EquipSlotUI,
  type Gear,
  hasStats,
  isGear,
  isWeapon,
  normalizeSrc,
  OffHanded,
  OneHanded,
  TwoHanded,
  type Item,
  type Weapon,
  type AccessoryKind,
  type TwoHandedKind,
  type OneHandedKind,
  type OffHandedKind,
} from "./types";
import { useAppStore, useGameStore } from "../state/store.ts";
import type { GuildMember } from "../state/gameTypes.ts";

type Stat = { k: string; v: string | number };

type EquipmentSlots =
  | "helmet"
  | "trousers"
  | "necklace"
  | "chest"
  | "bracers"
  | "gloves"
  | "belt"
  | "feet"
  | "ring1"
  | "ring2"
  | "trinket1"
  | "trinket2"
  | "leftHand"
  | "rightHand";

const AccessoryTypes = ["necklace", "ring1", "ring2", "trinket1", "trinket2"] as const;

type ItemLike = Item | Gear | Weapon | Accessory;

type TabsMode = "primary" | "secondary" | "resistances";

type GearSlotProps = {
  label: string;
  item?: { icon?: string; name: string; __placeholder?: boolean } | null;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;

  // additions (no styling changes)
  onClick?: () => void;
  canDrop?: boolean;
  onDropInvIndex?: (invIndex: number) => void;
};

type AppStoreSlice = {
  inventoryItems: (ItemLike | null)[];
  removeInventoryItem: (idx: number) => void;
};

type GameStoreSlice = {
  selectedMemberId: string | null;
  guildMembers: Record<string, GuildMember>;
  equipToSelectedMember: (slot: EquipSlotUI, item: ItemLike) => void;
};

type PickerEntry = { it: ItemLike; idx: number };

function GearSlot({
                    label,
                    item,
                    isActive,
                    onHover,
                    onLeave,
                    onClick,
                    canDrop,
                    onDropInvIndex,
                  }: GearSlotProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onMouseEnter={onHover}
        onFocus={onHover}
        onMouseLeave={onLeave}
        onBlur={onLeave}
        onClick={onClick}
        onDragOver={(e) => {
          if (!canDrop) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          if (!onDropInvIndex) return;
          const raw = e.dataTransfer.getData("application/x-inv-idx");
          const idx = Number(raw);
          if (Number.isFinite(idx)) onDropInvIndex(idx);
        }}
        className={[
          "h-14 w-14 rounded-lg border-2 bg-zinc-900/70",
          "flex items-center justify-center",
          "transition-transform hover:scale-[1.03]",
          isActive
            ? "border-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.22)]"
            : "border-zinc-700",
        ].join(" ")}
        aria-label={label}
        title={label}
      >
        {item?.icon ? (
          <img
            src={item.icon}
            alt={item.name}
            className="h-9 w-9 object-contain pointer-events-none"
            draggable={false}
          />
        ) : (
          <span className="text-xs text-zinc-400 pointer-events-none">+</span>
        )}
      </button>
      <span className="text-[10px] text-zinc-400">{label}</span>
    </div>
  );
}

function StatTabs({
                    primary,
                    secondary,
                    resistances,
                  }: {
  primary: Stat[];
  secondary: Stat[];
  resistances: Stat[];
}) {
  const [mode, setMode] = useState<TabsMode>("primary");
  const active = mode === "primary" ? primary : mode === "secondary" ? secondary : resistances;

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-700 p-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-200">Stats</div>

        <div className="relative h-8 w-full max-w-[240px] rounded-lg border border-zinc-700 bg-zinc-950/40 p-1 overflow-hidden">
          <div
            className={[
              "absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md",
              "bg-zinc-200/15 border border-zinc-200/15",
              "transition-transform duration-200",
              mode === "primary"
                ? "translate-x-0"
                : mode === "secondary"
                  ? "translate-x-[calc(100%+0.25rem)]"
                  : "translate-x-[calc(200%+0.5rem)]",
            ].join(" ")}
          />
          <div className="relative grid grid-cols-3 h-full">
            <button
              type="button"
              onClick={() => setMode("primary")}
              className={["text-xs font-medium rounded-md", mode === "primary" ? "text-zinc-100" : "text-zinc-400"].join(
                " "
              )}
            >
              Primary
            </button>
            <button
              type="button"
              onClick={() => setMode("secondary")}
              className={[
                "text-xs font-medium rounded-md",
                mode === "secondary" ? "text-zinc-100" : "text-zinc-400",
              ].join(" ")}
            >
              Secondary
            </button>
            <button
              type="button"
              onClick={() => setMode("resistances")}
              className={[
                "text-xs font-medium rounded-md",
                mode === "resistances" ? "text-zinc-100" : "text-zinc-400",
              ].join(" ")}
            >
              Resists
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {active.map((s) => (
          <div
            key={s.k}
            className="flex items-center justify-between rounded-lg bg-zinc-950/50 border border-zinc-800 px-3 py-2"
          >
            <span className="text-xs text-zinc-300">{s.k}</span>
            <span className="text-xs font-medium text-zinc-100">{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function XpBar({ current, toNext }: { current: number; toNext: number }) {
  const safeToNext = Math.max(1, toNext);
  const safeCurrent = Math.max(0, Math.min(current, safeToNext));
  const remaining = safeToNext - safeCurrent;
  const pct = (safeCurrent / safeToNext) * 100;

  return (
    <div className="relative h-6 w-full rounded-full border border-zinc-700 bg-zinc-950/40 overflow-hidden">
      <div className="h-full bg-amber-400/40" style={{ width: `${pct}%` }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] text-zinc-100/90 drop-shadow">{remaining} XP to next level</span>
      </div>
    </div>
  );
}

const n0 = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);

function sumResists(r: {
  fireResistance: number;
  frostResistance: number;
  arcaneResistance: number;
  shadowResistance: number;
  poisonResistance: number;
  stunResistance: number;
}) {
  return (
    n0(r.fireResistance) +
    n0(r.frostResistance) +
    n0(r.arcaneResistance) +
    n0(r.shadowResistance) +
    n0(r.poisonResistance) +
    n0(r.stunResistance)
  );
}

// basic slot rules (type-based, no extra data needed)
function canEquip(slot: EquipmentSlots, item: ItemLike): boolean {
  // hands are special (weapon kinds)
  if (slot === "leftHand") {
    if (!isWeapon(item)) return false;
    if (TwoHanded.includes(item.slot as TwoHandedKind)) return true;
    if (OneHanded.includes(item.slot as OneHandedKind)) return true;
    return false;
  }

  if (slot === "rightHand") {
    if (!isWeapon(item)) return false;
    if (OneHanded.includes(item.slot as OneHandedKind)) return true;
    if (OffHanded.includes(item.slot as OffHandedKind)) return true;
    if (TwoHanded.includes(item.slot as TwoHandedKind)) return true;
    return false;
  }

  // accessories: slot UI has ring1/ring2/trinket1/trinket2 but item.slot is ring/trinket/necklace
  const baseSlot = slot.replace(/\d$/, "");
  if (AccessoryTypes.includes(slot as AccessoryKind)) {
    if (baseSlot !== item.slot) return false;
    return hasStats(item) && !isWeapon(item) && !isGear(item);
  }

  // armor gear (helmet/chest/bracers/gloves/belt/feet/trousers)
  if (slot !== item.slot) return false;
  return isGear(item);
}

type SlotDisplayItem = { icon?: string; name: string; __placeholder?: boolean } | null;

const PLACEHOLDER: Record<EquipmentSlots, { icon: string; name: string; __placeholder: true }> = {
  helmet: { icon: "https://dummyimage.com/64x64/111827/fbbf24.png&text=H", name: "Empty", __placeholder: true },
  trousers: { icon: "https://dummyimage.com/64x64/111827/fbbf24.png&text=T", name: "Empty", __placeholder: true },
  necklace: { icon: "https://dummyimage.com/64x64/111827/22c55e.png&text=N", name: "Empty", __placeholder: true },
  chest: { icon: "https://dummyimage.com/64x64/111827/60a5fa.png&text=C", name: "Empty", __placeholder: true },
  bracers: { icon: "https://dummyimage.com/64x64/111827/a78bfa.png&text=B", name: "Empty", __placeholder: true },
  gloves: { icon: "https://dummyimage.com/64x64/111827/f472b6.png&text=G", name: "Empty", __placeholder: true },
  belt: { icon: "https://dummyimage.com/64x64/111827/38bdf8.png&text=W", name: "Empty", __placeholder: true },
  feet: { icon: "https://dummyimage.com/64x64/111827/facc15.png&text=F", name: "Empty", __placeholder: true },
  ring1: { icon: "https://dummyimage.com/64x64/111827/eab308.png&text=R1", name: "Empty", __placeholder: true },
  ring2: { icon: "https://dummyimage.com/64x64/111827/94a3b8.png&text=R2", name: "Empty", __placeholder: true },
  trinket1: { icon: "https://dummyimage.com/64x64/111827/38bdf8.png&text=T1", name: "Empty", __placeholder: true },
  trinket2: { icon: "https://dummyimage.com/64x64/111827/f43f5e.png&text=T2", name: "Empty", __placeholder: true },
  leftHand: { icon: "https://dummyimage.com/64x64/111827/34d399.png&text=L", name: "Empty", __placeholder: true },
  rightHand: { icon: "https://dummyimage.com/64x64/111827/f87171.png&text=R", name: "Empty", __placeholder: true },
};

export default function CharacterView(): JSX.Element {
  const selectedMember = useGameStore((s) => (s.selectedMemberId ? s.guildMembers[s.selectedMemberId] : null));

  // inventory + equip actions
  const inventoryItems = useAppStore((s: AppStoreSlice) => s.inventoryItems);
  const removeInventoryItem = useAppStore((s: AppStoreSlice) => s.removeInventoryItem);
  const equipToSelectedMember = useGameStore((s: GameStoreSlice) => s.equipToSelectedMember);

  const equipment: Partial<Record<EquipmentSlots, ItemLike>> = useMemo(() => {
    const gearAny = (selectedMember?.gear ?? {}) as Record<string, unknown>;
    const perSlot = gearAny;

    // legacy fallback: some older saves used "weapon" instead of rightHand
    const weapon = perSlot["weapon"];

    return {
      helmet: perSlot.helmet as ItemLike | undefined,
      trousers: perSlot.trousers as ItemLike | undefined,
      necklace: perSlot.necklace as ItemLike | undefined,

      chest: perSlot.chest as ItemLike | undefined,
      bracers: perSlot.bracers as ItemLike | undefined,
      gloves: perSlot.gloves as ItemLike | undefined,
      belt: perSlot.belt as ItemLike | undefined,
      feet: perSlot.feet as ItemLike | undefined,

      ring1: perSlot.ring1 as ItemLike | undefined,
      ring2: perSlot.ring2 as ItemLike | undefined,
      trinket1: perSlot.trinket1 as ItemLike | undefined,
      trinket2: perSlot.trinket2 as ItemLike | undefined,

      rightHand: (perSlot.rightHand ?? weapon) as ItemLike | undefined,
      leftHand: perSlot.leftHand as ItemLike | undefined,
    };
  }, [selectedMember]);

  const derived = useMemo(() => {
    const items = Object.values(equipment).filter(Boolean) as ItemLike[];

    let damageMin = 0;
    let damageMax = 0;
    let armor = 0;

    let range = 0;
    let parry = 0;
    let block = 0;

    const primary = { strength: 0, agility: 0, stamina: 0, intellect: 0, spirit: 0 };
    const secondary = { crit: 0, haste: 0, speed: 0, leech: 0 };
    const res = {
      fireResistance: 0,
      frostResistance: 0,
      arcaneResistance: 0,
      shadowResistance: 0,
      poisonResistance: 0,
      stunResistance: 0,
    };

    for (const it of items) {
      if (isWeapon(it)) {
        damageMin = Math.max(damageMin, n0(it.fromDamage));
        damageMax = Math.max(damageMax, n0(it.toDamage));
        range = Math.max(range, n0(it.range));
        parry = Math.max(parry, n0(it.parry));
        block = Math.max(block, n0(it.block));
        armor += n0(it.armor);
      } else if (isGear(it)) {
        armor += n0(it.armor);
      }

      if (hasStats(it)) {
        primary.strength += n0(it.primaryStats.strength);
        primary.agility += n0(it.primaryStats.agility);
        primary.stamina += n0(it.primaryStats.stamina);
        primary.intellect += n0(it.primaryStats.intellect);
        primary.spirit += n0(it.primaryStats.spirit);

        secondary.crit += n0(it.secondaryStats.crit);
        secondary.haste += n0(it.secondaryStats.haste);
        secondary.speed += n0(it.secondaryStats.speed);
        secondary.leech += n0(it.secondaryStats.leech);

        res.fireResistance += n0(it.secondaryStats.resistances.fireResistance);
        res.frostResistance += n0(it.secondaryStats.resistances.frostResistance);
        res.arcaneResistance += n0(it.secondaryStats.resistances.arcaneResistance);
        res.shadowResistance += n0(it.secondaryStats.resistances.shadowResistance);
        res.poisonResistance += n0(it.secondaryStats.resistances.poisonResistance);
        res.stunResistance += n0(it.secondaryStats.resistances.stunResistance);
      }
    }

    return { damageMin, damageMax, armor, range, parry, block, primary, secondary, res };
  }, [equipment]);

  const name = selectedMember?.name ?? "Unknown";
  const level = n0(selectedMember?.level);
  const className = "Adventurer";
  const avatar = "https://dummyimage.com/128x128/27272a/ffffff.png&text=Hero";

  const hp = n0(selectedMember?.hp);
  const xpCurrent = n0(selectedMember?.xpCurrent);
  const xpToNext = n0(selectedMember?.xpToNext);

  const primaryStats: Stat[] = useMemo(
    () => [
      { k: "Strength", v: derived.primary.strength },
      { k: "Agility", v: derived.primary.agility },
      { k: "Stamina", v: derived.primary.stamina },
      { k: "Intellect", v: derived.primary.intellect },
      { k: "Spirit", v: derived.primary.spirit },
    ],
    [derived]
  );

  const secondaryStats: Stat[] = useMemo(
    () => [
      { k: "Crit", v: derived.secondary.crit },
      { k: "Haste", v: derived.secondary.haste },
      { k: "Speed", v: derived.secondary.speed },
      { k: "Leech", v: derived.secondary.leech },
      { k: "Resists (sum)", v: sumResists(derived.res) },
    ],
    [derived]
  );

  const resistances: Stat[] = useMemo(
    () => [
      { k: "Fire Resistance", v: derived.res.fireResistance },
      { k: "Frost Resistance", v: derived.res.frostResistance },
      { k: "Arcane Resistance", v: derived.res.arcaneResistance },
      { k: "Shadow Resistance", v: derived.res.shadowResistance },
      { k: "Poison Resistance", v: derived.res.poisonResistance },
      { k: "Stun Resistance", v: derived.res.stunResistance },
    ],
    [derived]
  );

  const [hoveredItem, setHoveredItem] = useState<ItemLike | null>(null);
  const setPreview = (slot: EquipmentSlots) => {
    const it = equipment[slot] ?? null;
    setHoveredItem(it);
  };

  const [pickerSlot, setPickerSlot] = useState<EquipmentSlots | null>(null);

  const dropToSlot = (slot: EquipmentSlots) => (invIndex: number) => {
    const it = inventoryItems[invIndex];
    if (!it) return;
    if (!selectedMember) return;
    if (!canEquip(slot, it)) return;

    equipToSelectedMember(slot, it);
    removeInventoryItem(invIndex);
  };

  const slotDisplay = useMemo((): Record<EquipmentSlots, SlotDisplayItem> => {
    const m: Record<EquipmentSlots, SlotDisplayItem> = { ...PLACEHOLDER };

    (Object.keys(PLACEHOLDER) as EquipmentSlots[]).forEach((k) => {
      const real = equipment[k];
      if (real) m[k] = { name: real.name, icon: normalizeSrc(real.src) };
    });

    return m;
  }, [equipment]);

  const pickerItems = useMemo<PickerEntry[]>(() => {
    if (!pickerSlot) return [];
    const out: PickerEntry[] = [];
    inventoryItems.forEach((it, idx) => {
      if (!it) return;
      if (!canEquip(pickerSlot, it)) return;
      out.push({ it, idx });
    });
    return out;
  }, [inventoryItems, pickerSlot]);

  return (
    <div className="w-[40rem] h-[40rem]">
      {/* Picker modal (click slot to open) */}
      {pickerSlot && (
        <div className="fixed inset-0 z-[9998]" onMouseDown={() => setPickerSlot(null)}>
          <div
            className="fixed left-1/2 top-1/2 z-[9999] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/80 p-3"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/90">
                Choose item for <span className="text-white">{pickerSlot}</span>
              </div>
              <button className="text-xs text-white/70 hover:text-white" onClick={() => setPickerSlot(null)}>
                Close
              </button>
            </div>

            {pickerItems.length === 0 ? (
              <div className="text-xs text-white/60">No matching items in inventory.</div>
            ) : (
              <div className="grid grid-cols-6 gap-2">
                {pickerItems.map(({ it, idx }) => (
                  <button
                    key={idx}
                    className="relative aspect-square rounded-lg border border-white/10 bg-black/60 hover:bg-white/5"
                    onMouseEnter={() => setHoveredItem(it)}
                    onMouseLeave={() => setHoveredItem(null)}
                    onClick={() => {
                      if (!pickerSlot) return;
                      equipToSelectedMember(pickerSlot, it);
                      removeInventoryItem(idx);
                      setPickerSlot(null);
                    }}
                    title={it.name}
                  >
                    <img
                      src={normalizeSrc(it.src)}
                      alt={it.name}
                      className="absolute inset-[10%] h-[80%] w-[80%] object-contain"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full h-full flex flex-col gap-4 p-5 text-zinc-100">
        {/* Top */}
        <div className="flex gap-4">
          {/* Icon */}
          <div className="w-30 h-30 rounded-xl bg-zinc-900/60 border border-zinc-700 p-4 flex items-center justify-center">
            <img src={avatar} alt={name} className="h-full w-full object-cover rounded-lg" />
          </div>

          {/* Name card */}
          <div className="flex-1  rounded-xl bg-zinc-900/60 border border-zinc-700 p-4 flex flex-col">
            <div className="text-xl font-semibold">{name}</div>
            <div className="mt-1 text-sm text-zinc-300">
              Lv. {level} • {className}
            </div>

            <div className="mt-3">
              <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 px-3 py-2">
                <div className="text-[11px] text-zinc-400">Damage</div>
                <div className="font-medium">
                  {n0(derived.damageMin)} - {n0(derived.damageMax)}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-3">
              <XpBar current={xpCurrent} toNext={xpToNext} />
            </div>
          </div>

          {/* Tabs */}
          <div className="w-70">
            <StatTabs primary={primaryStats} secondary={secondaryStats} resistances={resistances} />
          </div>
        </div>

        {/* Bottom */}
        <div className="flex-1 rounded-xl bg-zinc-900/60 border border-zinc-700 p-4">
          <div className="grid grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr_auto] gap-4 h-full">
            {/* Top row */}
            <div className="col-start-1 row-start-1 flex justify-center">
              <GearSlot
                label="Helmet"
                item={slotDisplay.helmet}
                isActive={hoveredItem ? hoveredItem === equipment.helmet : false}
                onHover={() => setPreview("helmet")}
                onLeave={() => setHoveredItem(null)}
                onClick={() => setPickerSlot("helmet")}
                canDrop
                onDropInvIndex={dropToSlot("helmet")}
              />
            </div>

            {/* HP + Armor above preview */}
            <div className="col-start-2 row-start-1">
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 px-3 py-2">
                  <div className="text-[11px] text-zinc-400">HP</div>
                  <div className="font-medium">{hp}</div>
                </div>
                <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 px-3 py-2">
                  <div className="text-[11px] text-zinc-400">Armor</div>
                  <div className="font-medium">{n0(derived.armor)}</div>
                </div>
              </div>
            </div>

            <div className="col-start-3 row-start-1 flex justify-center">
              <GearSlot
                label="Trousers"
                item={slotDisplay.trousers}
                isActive={hoveredItem ? hoveredItem === equipment.trousers : false}
                onHover={() => setPreview("trousers")}
                onLeave={() => setHoveredItem(null)}
                onClick={() => setPickerSlot("trousers")}
                canDrop
                onDropInvIndex={dropToSlot("trousers")}
              />
            </div>

            {/* Left column */}
            <div className="col-start-1 row-start-2 flex flex-col items-center justify-center gap-4">
              {(
                [
                  ["chest", "Chest"],
                  ["bracers", "Bracers"],
                  ["gloves", "Gloves"],
                  ["belt", "Belt"],
                  ["feet", "Feet"],
                ] as const
              ).map(([key, label]) => (
                <GearSlot
                  key={key}
                  label={label}
                  item={slotDisplay[key]}
                  isActive={hoveredItem ? hoveredItem === equipment[key] : false}
                  onHover={() => setPreview(key)}
                  onLeave={() => setHoveredItem(null)}
                  onClick={() => setPickerSlot(key)}
                  canDrop
                  onDropInvIndex={dropToSlot(key)}
                />
              ))}
            </div>

            {/* Preview */}
            <div className="col-start-2 row-start-2 rounded-xl bg-zinc-950/40 border border-zinc-800 p-4 flex flex-col relative">
              <div className="mt-3 flex-1 flex items-center justify-center">
                {hoveredItem ? (
                  <ItemPreview item={hoveredItem} customClass={""} />
                ) : (
                  <div className="text-sm text-zinc-400 text-center">Hover a slot to preview the item.</div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="col-start-3 row-start-2 flex flex-col items-center justify-center gap-4">
              {(
                [
                  ["necklace", "Necklace"],
                  ["ring1", "Ring 1"],
                  ["ring2", "Ring 2"],
                  ["trinket1", "Trinket 1"],
                  ["trinket2", "Trinket 2"],
                ] as const
              ).map(([key, label]) => (
                <GearSlot
                  key={key}
                  label={label}
                  item={slotDisplay[key]}
                  isActive={hoveredItem ? hoveredItem === equipment[key] : false}
                  onHover={() => setPreview(key)}
                  onLeave={() => setHoveredItem(null)}
                  onClick={() => setPickerSlot(key)}
                  canDrop
                  onDropInvIndex={dropToSlot(key)}
                />
              ))}
            </div>

            {/* Hands */}
            <div className="col-start-2 row-start-3 flex items-center justify-center gap-6">
              <div className="flex items-center justify-center gap-10">
                {(
                  [
                    ["leftHand", "Left hand"],
                    ["rightHand", "Right hand"],
                  ] as const
                ).map(([key, label]) => (
                  <GearSlot
                    key={key}
                    label={label}
                    item={slotDisplay[key]}
                    isActive={hoveredItem ? hoveredItem === equipment[key] : false}
                    onHover={() => setPreview(key)}
                    onLeave={() => setHoveredItem(null)}
                    onClick={() => setPickerSlot(key)}
                    canDrop
                    onDropInvIndex={dropToSlot(key)}
                  />
                ))}
              </div>
            </div>

            <div className="col-start-1 row-start-3" />
            <div className="col-start-3 row-start-3">
              <div className=" relative w-full">
                <div className=" absolute right-0 mt-4 grid grid-cols-3 gap-2 w-40">
                  <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 px-3 py-2">
                    <div className="text-[11px] text-zinc-400">Range</div>
                    <div className="font-medium">{n0(derived.range)}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 px-3 py-2">
                    <div className="text-[11px] text-zinc-400">Parry</div>
                    <div className="font-medium">{n0(derived.parry)}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 px-3 py-2">
                    <div className="text-[11px] text-zinc-400">Block</div>
                    <div className="font-medium">{n0(derived.block)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
