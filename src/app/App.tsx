import { useEffect, useMemo, useState } from "react";
import { PhaserViewport } from "../game/ui/PhaserViewport";
import {useAppStore, useGameStore} from "../state/store";
import type { SimOutMsg } from "../sim/simTypes";
import { allSpriteKeys } from "../game/assets/tilesets";
import Navigation from "./navigation.tsx";
import Inventory from "./inventory.tsx";
import Creative from "./creative.tsx";
import GuildPanel from "./guildPanel.tsx";

export default function App() {
  const gold = useAppStore((s) => s.gold);
  const ticks = useAppStore((s) => s.ticks);
  const simConnected = useAppStore((s) => s.simConnected);

  const selectedSceneId = useGameStore((s) => s.selectedSceneId);
  const applyOfflineProgress = useAppStore((s) => s.applyOfflineProgress);
  const applySimSnapshot = useAppStore((s) => s.applySimSnapshot);
  const setSimConnected = useAppStore((s) => s.setSimConnected);
  const markSavedNow = useAppStore((s) => s.markSavedNow);

  const uiPanel = useAppStore((s) => s.uiPanel);
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const closePanel = useAppStore((s) => s.closePanel);

  const editorEnabled = useAppStore((s) => s.editorEnabled);
  const setEditorEnabled = useAppStore((s) => s.setEditorEnabled);
  const creativeEnabled = useAppStore((s) => s.creativeEnabled);
  const setCreativeEnabled = useAppStore((s) => s.setCreativeEnabled);
  const editorLayer = useAppStore((s) => s.editorLayer);
  const setEditorLayer = useAppStore((s) => s.setEditorLayer);
  const selectedSpriteKey = useAppStore((s) => s.selectedSpriteKey);
  const setSelectedSpriteKey = useAppStore((s) => s.setSelectedSpriteKey);
  const selectedRotation = useAppStore((s) => s.selectedRotation);
  const rotateSelected = useAppStore((s) => s.rotateSelected);
  const exportSceneMapJson = useAppStore((s) => s.exportSceneMapJson);

  const spriteKeys = allSpriteKeys();

  const worker = useMemo(
    () => new Worker(new URL("../sim/sim.worker.ts", import.meta.url), { type: "module" }),
    []
  );

  const [unitOverlay, setUnitOverlay] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r") rotateSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rotateSelected]);

  useEffect(() => {
    const s = useGameStore.getState();
    if (Object.keys(s.guildMembers).length === 0) s.createStarterGuild();
  }, []);

  useEffect(() => {
    const now = Date.now();
    applyOfflineProgress(now);

    worker.onmessage = (e: MessageEvent<SimOutMsg>) => {
      const msg = e.data;
      if (msg.type === "SNAPSHOT") applySimSnapshot(msg);
    };

    worker.postMessage({ type: "START", now: Date.now() });
    setSimConnected(true);

    const onBeforeUnload = () => {
      markSavedNow(Date.now());
      worker.postMessage({ type: "STOP" });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    const autosave = window.setInterval(() => markSavedNow(Date.now()), 10_000);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearInterval(autosave);
      worker.postMessage({ type: "STOP" });
      worker.terminate();
      setSimConnected(false);
    };
  }, [worker, applyOfflineProgress, applySimSnapshot, setSimConnected, markSavedNow]);

  return (
    <div className="min-h-screen bg-[#0b1220] text-white/90">
      <div className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col px-4
                  md:w-[60%] md:max-w-none">
        {/* TOP: centered square game + overlay */}
        <div className="flex justify-center py-3">
          <div className="relative inline-block">
            <PhaserViewport
              onCanvasReady={(canvas) => {
                if (canvas) setUnitOverlay({x: 224, y: 224});
                else setUnitOverlay(null);
              }}
            />

            {/* Overlay */}
            <div className="pointer-events-none absolute inset-0">
              {/* HUD */}
              <div className="pointer-events-none absolute left-2 top-2 text-xs opacity-90">
                {simConnected ? "Sim connected" : "Sim disconnected"} • Tick {ticks} • Gold {gold}
              </div>

              {/* Unit label */}
              {unitOverlay && (
                <div
                  className="pointer-events-none absolute whitespace-nowrap rounded-full border border-white/15 bg-black/35 px-2 py-1 text-xs"
                  style={{
                    left: unitOverlay.x,
                    top: unitOverlay.y,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  Unit A
                </div>
              )}

              {/* Navigation / buttons - needs pointer events */}
              <div className="pointer-events-auto">
                <Navigation/>
              </div>
            </div>
          </div>
        </div>

        {/* BELOW: fills remaining screen for management UI */}
        <div
          className="relative flex-1 overflow-auto border-t border-white/10 bg-white/[0.02] p-3 invisible md:visible">
          {/* Editor toggle */}

          <div className="pointer-events-auto">
            <Inventory/>
          </div>
          <div className="mb-2 flex w-full justify-end">
            <label className="flex items-center gap-2 text-xs opacity-90">
              <input
                type="checkbox"
                checked={editorEnabled}
                onChange={(e) => setEditorEnabled(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
              Editor
            </label>
          </div>
          <div className="mb-2 flex w-full justify-end">
            <label className="flex items-center gap-2 text-xs opacity-90">
              <input
                type="checkbox"
                checked={creativeEnabled}
                onChange={(e) => setCreativeEnabled(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
              Creative
            </label>
          </div>

          {/* Guild Panel */}
          <GuildPanel />

          {/* Creative panel */}
          <Creative/>

          {/* Editor palette panel */}
          <div
            className={[
              "pointer-events-auto fixed left-2 top-2 w-[260px] max-h-[70%] overflow-hidden rounded-xl border border-white/15 bg-black/45 p-2.5",
              editorEnabled ? "visible" : "invisible",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center gap-2">
              <select
                value={editorLayer}
                onChange={(e) => setEditorLayer(e.target.value as "ground" | "objects")}
                disabled={!editorEnabled}
                className="h-8 flex-1 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none disabled:opacity-50"
              >
                <option value="ground">ground</option>
                <option value="objects">objects</option>
              </select>

              <button
                onClick={rotateSelected}
                disabled={!editorEnabled || !selectedSpriteKey}
                className="h-8 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white disabled:opacity-50"
              >
                Rotate: {selectedRotation}°
              </button>
            </div>

            <div className="mb-2 flex gap-2">
              <button
                disabled={!editorEnabled}
                onClick={() => {
                  const json = exportSceneMapJson();
                  navigator.clipboard.writeText(json);
                  alert("Scene JSON copied to clipboard");
                }}
                className="h-8 flex-1 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white disabled:opacity-50"
              >
                Copy JSON
              </button>

              <button
                disabled={!editorEnabled}
                onClick={() => setSelectedSpriteKey(null)}
                className="h-8 flex-1 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white disabled:opacity-50"
              >
                Clear Brush
              </button>
            </div>

            <div className="mb-1.5 text-xs opacity-80">
              Brush: <span className="font-semibold text-white">{selectedSpriteKey ?? "(none)"}</span>
            </div>

            <div className="grid max-h-80 grid-cols-4 gap-1.5 overflow-auto pr-1">
              {spriteKeys.map((k) => {
                const [setId, x, y] = k.split("_");
                const src =
                  setId === "path"
                    ? `/assets/tiles/path/tile_${x}_${y}.png`
                    : setId === "nether"
                      ? `/assets/tiles/nether/tile_${x}_${y}.png`
                      : `/assets/tiles/grass/tile_${x}_${y}.png`;

                const selected = k === selectedSpriteKey;

                return (
                  <button
                    key={k}
                    onClick={() => setSelectedSpriteKey(k)}
                    title={k}
                    className={[
                      "cursor-pointer rounded-lg p-1.5 text-left",
                      selected ? "border-2 border-white bg-white/10" : "border border-white/10 bg-white/5",
                    ].join(" ")}
                  >
                    <div className="mb-1 text-[10px] leading-tight opacity-85">{k}</div>
                    <img src={src} className="w-full [image-rendering:pixelated]"/>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 text-[11px] leading-snug opacity-70">
              Place: left click on grid. Erase: right click (desktop). Rotation applies to next placements.
            </div>
          </div>

          {/* Panels */}
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <h2 className="mb-2 text-sm font-semibold tracking-wide opacity-90">Details</h2>
            <div className="flex flex-wrap gap-2">
              <div className="min-w-[140px] rounded-lg border border-white/10 bg-black/20 p-2.5">
                <div className="text-xs text-white/70">Scene</div>
                <div className="text-xl font-extrabold">{selectedSceneId}</div>
              </div>
              <div className="min-w-[140px] rounded-lg border border-white/10 bg-black/20 p-2.5">
                <div className="text-xs text-white/70">Gold</div>
                <div className="text-xl font-extrabold">{gold}</div>
              </div>
              <div className="min-w-[140px] rounded-lg border border-white/10 bg-black/20 p-2.5">
                <div className="text-xs text-white/70">Ticks</div>
                <div className="text-xl font-extrabold">{ticks}</div>
              </div>
            </div>
          </div>

          {uiPanel === "building" && (
            <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <h2 className="mb-2 text-sm font-semibold tracking-wide opacity-90">Building</h2>
              <div className="text-xs opacity-85">
                Selected: <span className="font-semibold text-white">{selectedBuildingId}</span>
              </div>
              <div className="mt-2">
                <button
                  onClick={closePanel}
                  className="h-9 rounded-md border border-white/15 bg-white/10 px-3 text-xs text-white"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <h2 className="mb-2 text-sm font-semibold tracking-wide opacity-90">Inventory / Loot</h2>
            <div className="text-xs leading-relaxed opacity-75">
              This section scrolls and fills the remaining screen space under the square scene.
            </div>
          </div>

          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <h2 className="mb-2 text-sm font-semibold tracking-wide opacity-90">Heroes / Upgrades</h2>
            <div className="text-xs leading-relaxed opacity-75">
              Add your lists, tooltips, comparisons, and upgrade buttons here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
