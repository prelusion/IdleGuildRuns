import Phaser from "phaser";
import type { Dir4, MobDef } from "./mobTypes";
import { DIR_ROW } from "./mobTypes";

const DIRS: readonly Dir4[] = ["down", "up", "left", "right"];

export function textureKey(mobId: string, layerId: string, action: string) {
  return `mob:${mobId}:${layerId}:${action}`;
}

export function animKey(mobId: string, layerId: string, action: string, dir: Dir4) {
  return `anim:${mobId}:${layerId}:${action}:${dir}`;
}

function isOneShotAction(action: string) {
  return (
    action.includes("death") ||
    action.includes("attack") ||
    action.includes("swing") ||
    action.includes("hurt")
  );
}

export function preloadMob(scene: Phaser.Scene, def: MobDef) {
  for (const [action, adef] of Object.entries(def.actions)) {
    for (const layer of def.layers) {
      const filename = adef.files[layer.id];
      if (!filename) continue;

      const tKey = textureKey(def.id, layer.id, action);
      const url = `/${def.basePath}/${adef.folder}/${filename}`;

      if (scene.textures.exists(tKey)) continue;

      scene.load.spritesheet(tKey, url, {
        frameWidth: def.frameW,
        frameHeight: def.frameH,
      });
    }
  }
}

export function createMobAnimations(scene: Phaser.Scene, def: MobDef) {
  for (const [action, adef] of Object.entries(def.actions)) {
    const fps = adef.fps ?? def.fpsDefault;

    for (const layer of def.layers) {
      const tKey = textureKey(def.id, layer.id, action);
      if (!scene.textures.exists(tKey)) continue;

      const tex = scene.textures.get(tKey);
      const src = tex.getSourceImage();

      // src can be HTMLImageElement | HTMLCanvasElement | ...; we only need width/height
      const srcW = src && "width" in src ? Number(src.width) : 0;
      const srcH = src && "height" in src ? Number(src.height) : 0;

      // Auto-detect columns from actual sheet width
      const detectedCols = srcW > 0 ? Math.floor(srcW / def.frameW) : 0;
      const cols = adef.cols ?? (detectedCols > 0 ? detectedCols : def.cols);

      if (!Number.isFinite(cols) || cols <= 0) continue;

      // Detect rows (optional)
      const detectedRows = srcH > 0 ? Math.floor(srcH / def.frameH) : 0;
      const rows = adef.rows ?? Math.min(4, detectedRows > 0 ? detectedRows : 4);

      for (const dir of DIRS) {
        const row = DIR_ROW[dir];
        if (row >= rows) continue;

        const start = row * cols;
        const end = start + (cols - 1);

        const aKey = animKey(def.id, layer.id, action, dir);
        if (scene.anims.exists(aKey)) continue;

        const frames = scene.anims.generateFrameNumbers(tKey, { start, end });
        if (!frames.length) continue;

        scene.anims.create({
          key: aKey,
          frames,
          frameRate: fps,
          repeat: isOneShotAction(action) ? 0 : -1,
        });
      }
    }
  }
}
