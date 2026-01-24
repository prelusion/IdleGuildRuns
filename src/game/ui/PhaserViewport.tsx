import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createGame, type GameBridge } from "../phaser/createGame";
import { useAppStore } from "../../state/store";
import type {PlacedTile} from "../phaser/scenes/maps/scenes.ts";


function computeSquareSize() {
  // Fit within viewport width, and leave room for “below the square” UI if needed.
  // On phones, this tends to pick near full width.
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Reserve some space for below-panels (tweak as you like).
  const reservedBelow = Math.min(260, Math.floor(vh * 0.32));
  const availableH = Math.max(240, vh - reservedBelow);

  const size = Math.floor(Math.min(vw, availableH, 920)); // cap a bit on desktop
  return Math.max(240, size);
}

export function PhaserViewport(props: {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<GameBridge | null>(null);
  const [size, setSize] = useState<number>(() => (typeof window === "undefined" ? 480 : computeSquareSize()));

  const openBuildingPanel = useAppStore((s) => s.openBuildingPanel);
  // const bridge = useMemo(() => ({ current: bridgeRef.current }), []);

  const editorEnabled = useAppStore((s) => s.editorEnabled);
  const editorLayer = useAppStore((s) => s.editorLayer);
  const selectedSpriteKey = useAppStore((s) => s.selectedSpriteKey);
  const selectedRotation = useAppStore((s) => s.selectedRotation);
  const placeAt = useAppStore((s) => s.placeAt);
  const eraseAt = useAppStore((s) => s.eraseAt);
  const sceneMap = useAppStore((s) => s.sceneMap);


  useLayoutEffect(() => {
    const onResize = () => setSize(computeSquareSize());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;

    // Create game once
    bridgeRef.current = createGame(hostRef.current, size);
    props.onCanvasReady?.(bridgeRef.current.getCanvas());

    return () => {
      props.onCanvasReady?.(null);
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  useEffect(() => {
    const canvas = bridgeRef.current?.getCanvas();
    if (!canvas) return;

    // How fast to paint while holding (ms)
    const PAINT_INTERVAL_MS = 5;

    let isDown = false;
    let activePointerId: number | null = null;
    let lastPaintAt = 0;

    // Cache latest pointer position (updated on move)
    let latestClientX = 0;
    let latestClientY = 0;

    // Avoid repainting the same tile repeatedly
    let lastTx: number | null = null;
    let lastTy: number | null = null;

    const rectForEvent = () => canvas.getBoundingClientRect();

    const paintAtClient = (clientX: number, clientY: number, button: number) => {
      const rect = rectForEvent();

      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      const z = Number(canvas.dataset.zoom || "1") || 1;

      const wx = cx / z;
      const wy = cy / z;

      const tx = Math.floor(wx / sceneMap.tileSize);
      const ty = Math.floor(wy / sceneMap.tileSize);

      // Bounds check
      if (tx < 0 || ty < 0 || tx >= sceneMap.width || ty >= sceneMap.height) return;

      // If we’re still in the same tile, don’t spam updates
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

      // track pointer
      isDown = true;
      activePointerId = ev.pointerId;

      latestClientX = ev.clientX;
      latestClientY = ev.clientY;

      lastTx = null;
      lastTy = null;

      // capture so we still get move/up even if pointer leaves canvas
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch {
        // some browsers can throw if capture fails; safe to ignore
      }

      // IMPORTANT: paint immediately so a normal click works
      paintAtClient(ev.clientX, ev.clientY, ev.button);

      // Prevent browser actions (like scrolling on touch)
      ev.preventDefault();
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!editorEnabled) return;
      if (!isDown) return;
      if (activePointerId !== ev.pointerId) return;

      latestClientX = ev.clientX;
      latestClientY = ev.clientY;

      const now = performance.now();
      if (now - lastPaintAt < PAINT_INTERVAL_MS) return;
      lastPaintAt = now;

      // paint while dragging
      paintAtClient(latestClientX, latestClientY, ev.buttons === 2 ? 2 : 0);

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

    // Prevent right click menu
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Prevent touch scrolling while painting
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



  useEffect(() => {
    if (!bridgeRef.current) return;
    bridgeRef.current.setTownCallbacks({
      onBuildingClicked: (id) => openBuildingPanel(id),
    });
  }, [openBuildingPanel]);

  useEffect(() => {
    bridgeRef.current?.setSceneMap(sceneMap);
  }, [sceneMap]);

  useEffect(() => {
    // Resize Phaser when size changes
    bridgeRef.current?.resize(size);
  }, [size]);

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
