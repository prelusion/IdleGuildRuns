import Phaser from "phaser";
import type { Dir4, MobDef } from "./mobTypes";
import { DIR_ROW } from "./mobTypes";

const DIRS: Dir4[] = ["down", "up", "left", "right"];

export function textureKey(mobId: string, layerId: string, action: string) {
  return `mob:${mobId}:${layerId}:${action}`;
}

export function animKey(mobId: string, layerId: string, action: string, dir: Dir4) {
  return `anim:${mobId}:${layerId}:${action}:${dir}`;
}

export function preloadMob(scene: Phaser.Scene, def: MobDef) {
  for (const [action, adef] of Object.entries(def.actions)) {
    for (const layer of def.layers) {
      const filename = adef.files[layer.id];
      if (!filename) continue;

      const tKey = textureKey(def.id, layer.id, action);
      const url = `/${def.basePath}/${adef.folder}/${filename}`;

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
      const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;

      // ✅ Auto-detect columns from the actual sheet width
      const detectedCols = Math.floor(src.width / def.frameW);
      const cols = adef.cols ?? (detectedCols > 0 ? detectedCols : def.cols);

      // Safety: if cols is bogus, skip
      if (!Number.isFinite(cols) || cols <= 0) continue;

      // Also detect rows (optional)
      const detectedRows = Math.floor(src.height / def.frameH);
      const rows = adef.rows ?? Math.min(4, detectedRows > 0 ? detectedRows : 4);

      for (const dir of DIRS) {
        const row = DIR_ROW[dir];
        if (row >= rows) continue; // sheet doesn't have that direction row

        const start = row * cols;
        const end = start + (cols - 1);

        const aKey = animKey(def.id, layer.id, action, dir);
        if (scene.anims.exists(aKey)) continue;

        const frames = scene.anims.generateFrameNumbers(tKey, { start, end });
        if (!frames.length) continue;

        const oneShot =
          action.includes("death") ||
          action.includes("attack") ||
          action.includes("swing") ||
          action.includes("hurt");


        scene.anims.create({
          key: aKey,
          frames,
          frameRate: fps,
          repeat: oneShot ? 0 : -1,
        });
      }
    }
  }
}
