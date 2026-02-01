import { useEffect, useMemo } from "react";
import { PhaserViewport } from "../game/ui/PhaserViewport";
import Navigation from "./navigation.tsx";
import Inventory from "./inventory.tsx";
import Creative from "./creative.tsx";
import GuildPanel from "./guildPanel.tsx";
import CharacterView from "./CharacterView.tsx";
import { MAPS_LIBRARY_MANIFEST, mapsLibraryUrlForKey } from "../game/assets/mapsLibraryManifest";
import {useAppStore, appSelectors, useGameStore, gameSelectors} from "../state/store.ts";

export default function App() {
  const gold = useAppStore(appSelectors.gold);
  const ticks = useAppStore(appSelectors.ticks);
  const simConnected = useAppStore(appSelectors.simConnected);

  const brushKind = useAppStore(appSelectors.brushKind);
  const setBrushKind = useAppStore(appSelectors.setBrushKind);
  const selectedSceneId = useGameStore(gameSelectors.selectedSceneId);
  const clearSelectedMember = useGameStore(gameSelectors.clearSelectedMember);

  const applyOfflineProgress = useAppStore(appSelectors.applyOfflineProgress);
  const setSimConnected = useAppStore(appSelectors.setSimConnected);
  const markSavedNow = useAppStore(appSelectors.markSavedNow);

  const uiPanel = useAppStore(appSelectors.uiPanel);
  const selectedBuildingId = useAppStore(appSelectors.selectedBuildingId);
  const closePanel = useAppStore(appSelectors.closePanel);

  const editorEnabled = useAppStore(appSelectors.editorEnabled);
  const setEditorEnabled = useAppStore(appSelectors.setEditorEnabled);
  const creativeEnabled = useAppStore(appSelectors.creativeEnabled);
  const setCreativeEnabled = useAppStore(appSelectors.setCreativeEnabled);
  const editorLayer = useAppStore(appSelectors.editorLayer);
  const setEditorLayer = useAppStore(appSelectors.setEditorLayer);
  const selectedSpriteKey = useAppStore(appSelectors.selectedSpriteKey);
  const setSelectedSpriteKey = useAppStore(appSelectors.setSelectedSpriteKey);
  const selectedRotation = useAppStore(appSelectors.selectedRotation);
  const rotateSelected = useAppStore(appSelectors.rotateSelected);
  const exportSceneMapJson = useAppStore(appSelectors.exportSceneMapJson);

  const spriteKeys = MAPS_LIBRARY_MANIFEST.sprites
    .filter((s) => s.kind === brushKind)
    .map((s) => s.key);

  const worker = useMemo(
    () => new Worker(new URL("../sim/sim.worker.ts", import.meta.url), { type: "module" }),
    []
  );

  const selectedMember = useGameStore((s) =>
    s.selectedMemberId ? s.guildMembers[s.selectedMemberId] : null
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r") rotateSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rotateSelected]);

  useEffect(() => {
    if (!selectedMember) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelectedMember();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedMember, clearSelectedMember]);

  useEffect(() => {
    const s = useGameStore.getState();
    if (Object.keys(s.guildMembers).length === 0) s.createStarterGuild();
  }, []);

  useEffect(() => {
    const now = Date.now();
    applyOfflineProgress(now);

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
  }, [worker, applyOfflineProgress, setSimConnected, markSavedNow]);

  return (
    <div className="min-h-screen bg-[#0b1220] text-white/90">
      <div
        className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col px-4
                  md:w-[60%] md:max-w-none"
      >
        {/* TOP: centered square game + overlay */}
        <div className="flex justify-center py-3">
          <div className="relative inline-block">
            <PhaserViewport />

            {/* Overlay */}
            <div className="pointer-events-none absolute inset-0">
              {/* HUD */}
              <div className="pointer-events-none absolute left-2 top-2 text-xs opacity-90">
                {simConnected ? "Sim connected" : "Sim disconnected"} • Tick {ticks} • Gold {gold}
              </div>

              {/* Navigation / buttons - needs pointer events */}
              {selectedMember && (
                <div className="pointer-events-auto">
                  <CharacterView />
                </div>
              )}

              {/* Navigation / buttons - needs pointer events */}
              <div className="pointer-events-auto">
                <Navigation />
              </div>
            </div>
          </div>
        </div>

        {/* BELOW: fills remaining screen for management UI */}
        <div className="relative flex-1 overflow-auto border-t border-white/10 bg-white/[0.02] p-3 invisible md:visible">
          {/* Editor toggle */}

          <div className="pointer-events-auto">
            <Inventory />
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
          <Creative />

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

            <div className="mb-2 flex gap-2">
              <button
                disabled={!editorEnabled}
                onClick={() => setBrushKind("tile")}
                className={[
                  "h-8 flex-1 rounded-md border px-2 text-xs",
                  brushKind === "tile"
                    ? "border-white/40 bg-white/20 text-white"
                    : "border-white/15 bg-white/10 text-white/80",
                ].join(" ")}
              >
                Tiles (grid)
              </button>
              <button
                disabled={!editorEnabled}
                onClick={() => setBrushKind("object")}
                className={[
                  "h-8 flex-1 rounded-md border px-2 text-xs",
                  brushKind === "object"
                    ? "border-white/40 bg-white/20 text-white"
                    : "border-white/15 bg-white/10 text-white/80",
                ].join(" ")}
              >
                Objects (free)
              </button>
            </div>

            <div className="grid max-h-80 grid-cols-4 gap-1.5 overflow-auto pr-1">
              {spriteKeys.map((k) => {
                const src = mapsLibraryUrlForKey(k);
                if (!src) return null;

                return (
                  <button key={k} onClick={() => setSelectedSpriteKey(k)} title={k}>
                    <div className="mb-1 text-[10px] opacity-85">{k}</div>
                    <img src={src} alt={k} className="w-full [image-rendering:pixelated]" />
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
                <div className="text-xs text-white/70">Selected Unit</div>
                <div className="text-xl font-extrabold">{selectedMember?.name}</div>
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
