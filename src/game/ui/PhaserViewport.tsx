import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createGame, type GameBridge } from "../phaser/createGame";
import { useAppStore } from "../../state/store";
import { useGameStore } from "../../state/store";
import type { PlacedTile } from "../phaser/scenes/maps/scenes";

function computeSquareSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const reservedBelow = Math.min(260, Math.floor(vh * 0.32));
  const availableH = Math.max(240, vh - reservedBelow);

  const size = Math.floor(Math.min(vw, availableH, 920));
  return Math.max(240, size);
}

export function PhaserViewport(props: {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<GameBridge | null>(null);

  const [size, setSize] = useState<number>(() =>
    typeof window === "undefined" ? 480 : computeSquareSize()
  );

  // App/UI store
  const editorEnabled = useAppStore((s) => s.editorEnabled);
  const editorLayer = useAppStore((s) => s.editorLayer);
  const selectedSpriteKey = useAppStore((s) => s.selectedSpriteKey);
  const selectedRotation = useAppStore((s) => s.selectedRotation);
  const placeAt = useAppStore((s) => s.placeAt);
  const eraseAt = useAppStore((s) => s.eraseAt);
  const sceneMap = useAppStore((s) => s.sceneMap);

  // Game store: selected scene ("town" | "hell" | etc)
  const selectedSceneId = useGameStore((s) => s.selectedSceneId);

  useLayoutEffect(() => {
    const onResize = () => setSize(computeSquareSize());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Create Phaser ONCE
  useEffect(() => {
    if (!hostRef.current) return;

    bridgeRef.current = createGame(hostRef.current, size);
    props.onCanvasReady?.(bridgeRef.current.getCanvas());

    return () => {
      props.onCanvasReady?.(null);
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch scenes when selectedSceneId changes
  useEffect(() => {
    const b = bridgeRef.current;
    if (!b) return;

    b.startScene(selectedSceneId === "hell" ? "HellScene" : "TownScene");
    b.resize(size);

    //  Only push map overrides when editor is enabled (or when you KNOW it matches the active scene)
    if (editorEnabled) {
      b.setSceneMap(sceneMap);
    }
  }, [selectedSceneId, size, editorEnabled]);

  // Keep active scene updated with latest map edits
  useEffect(() => {
    bridgeRef.current?.setSceneMap(sceneMap);
  }, [sceneMap]);

  // Resize Phaser when size changes
  useEffect(() => {
    bridgeRef.current?.resize(size);
  }, [size]);


  // Editor paint (unchanged)
  useEffect(() => {
    const canvas = bridgeRef.current?.getCanvas();
    if (!canvas) return;

    const PAINT_INTERVAL_MS = 5;

    let isDown = false;
    let activePointerId: number | null = null;
    let lastPaintAt = 0;

    let lastTx: number | null = null;
    let lastTy: number | null = null;

    const paintAtClient = (clientX: number, clientY: number, button: number) => {
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      const z = Number(canvas.dataset.zoom || "1") || 1;
      const wx = cx / z;
      const wy = cy / z;

      const tx = Math.floor(wx / sceneMap.tileSize);
      const ty = Math.floor(wy / sceneMap.tileSize);

      if (tx < 0 || ty < 0 || tx >= sceneMap.width || ty >= sceneMap.height) return;
      if (tx === lastTx && ty === lastTy) return;

      lastTx = tx;
      lastTy = ty;

      if (button === 2) {
        eraseAt(tx, ty);
        bridgeRef.current?.placeTile(tx, ty, null, editorLayer);
        return;
      }

      if (!selectedSpriteKey) return;

      const placed: PlacedTile = { key: selectedSpriteKey, rotation: selectedRotation };
      placeAt(tx, ty);
      bridgeRef.current?.placeTile(tx, ty, placed, editorLayer);
    };


    const onPointerDown = (ev: PointerEvent) => {
      if (!editorEnabled) return;

      isDown = true;
      activePointerId = ev.pointerId;
      lastTx = null;
      lastTy = null;

      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch {
        // ignore
      }

      paintAtClient(ev.clientX, ev.clientY, ev.button);
      ev.preventDefault();
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!editorEnabled || !isDown) return;
      if (activePointerId !== ev.pointerId) return;

      const now = performance.now();
      if (now - lastPaintAt < PAINT_INTERVAL_MS) return;
      lastPaintAt = now;

      paintAtClient(ev.clientX, ev.clientY, ev.buttons === 2 ? 2 : 0);
      ev.preventDefault();
    };

    const endStroke = (ev: PointerEvent) => {
      if (activePointerId !== ev.pointerId) return;

      isDown = false;
      activePointerId = null;
      lastTx = null;
      lastTy = null;

      try {
        canvas.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }

      ev.preventDefault();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.style.touchAction = "none";

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endStroke);
      canvas.removeEventListener("pointercancel", endStroke);
    };
  }, [
    editorEnabled,
    editorLayer,
    selectedSpriteKey,
    selectedRotation,
    sceneMap.tileSize,
    sceneMap.width,
    sceneMap.height,
    eraseAt,
    placeAt,
  ]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.25)",
        position: "relative",
      }}
    >
      <div ref={hostRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
