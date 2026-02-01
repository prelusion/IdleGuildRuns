import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createGame, type GameBridge } from "../phaser/createGame";
import { useAppStore, useGameStore } from "../../state/store";
import type { PlacedTile } from "../phaser/scenes/maps/scenes";
import {computeSquareSize} from "./ViewportSizing.ts";

export function PhaserViewport(props: {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<GameBridge | null>(null);

  const [size, setSize] = useState<number>(() =>
    typeof window === "undefined" ? 480 : computeSquareSize()
  );

  const editorEnabled = useAppStore((s) => s.editorEnabled);
  const sceneMap = useAppStore((s) => s.sceneMap);

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

    b.startScene(selectedSceneId);
    b.resize(size);

    if (editorEnabled) {
      b.setSceneMap(sceneMap);
    }
  }, [selectedSceneId, size, editorEnabled, sceneMap]);

  // Keep active scene updated with latest map edits
  useEffect(() => {
    bridgeRef.current?.setSceneMap(sceneMap);
  }, [sceneMap]);

  // Resize Phaser when size changes
  useEffect(() => {
    bridgeRef.current?.resize(size);
  }, [size]);

  // Editor paint: bind once; read latest store state inside handlers
  useEffect(() => {
    const canvas = bridgeRef.current?.getCanvas();
    if (!canvas) return;

    const PAINT_INTERVAL_MS = 5;

    let isDown = false;
    let activePointerId: number | null = null;
    let lastPaintAt = 0;

    let lastTx: number | null = null;
    let lastTy: number | null = null;

    const pushLatestMapToPhaser = () => {
      bridgeRef.current?.setSceneMap(useAppStore.getState().sceneMap);
    };

    const paintAtClient = (clientX: number, clientY: number, button: number) => {
      // Always read freshest store state (prevents stale closure issues)
      const s = useAppStore.getState();
      if (!s.editorEnabled) return;

      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      const z = Number(canvas.dataset.zoom || "1") || 1;
      const wx = cx / z;
      const wy = cy / z;

      if (s.brushKind === "object") {
        if (button === 2) {
          s.eraseFreeObjectAt(wx, wy);
          pushLatestMapToPhaser();
          return;
        }

        if (!s.selectedSpriteKey) return;

        s.placeFreeObjectAt(wx, wy);
        pushLatestMapToPhaser();
        return;
      }

      const map = s.sceneMap;
      const tx = Math.floor(wx / map.tileSize);
      const ty = Math.floor(wy / map.tileSize);

      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;
      if (tx === lastTx && ty === lastTy) return;

      lastTx = tx;
      lastTy = ty;

      if (button === 2) {
        s.eraseAt(tx, ty);
        bridgeRef.current?.placeTile(tx, ty, null, s.editorLayer);
        return;
      }

      if (!s.selectedSpriteKey) return;

      const placed: PlacedTile = { key: s.selectedSpriteKey, rotation: s.selectedRotation };
      s.placeAt(tx, ty);
      bridgeRef.current?.placeTile(tx, ty, placed, s.editorLayer);
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (!useAppStore.getState().editorEnabled) return;

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
      if (!useAppStore.getState().editorEnabled || !isDown) return;
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

    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);
    canvas.addEventListener("contextmenu", onContextMenu);

    canvas.style.touchAction = "none";

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endStroke);
      canvas.removeEventListener("pointercancel", endStroke);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [editorEnabled]); // keeps behavior (disabled stops doing anything)

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
