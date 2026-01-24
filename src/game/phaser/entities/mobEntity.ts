import Phaser from "phaser";
import type {Dir4, LayerId} from "../mobs/mobTypes";
import type { MobDef } from "../mobs/mobTypes";
import { animKey, textureKey } from "../mobs/mobLoader";

export class MobEntity {
  readonly def: MobDef;
  readonly container: Phaser.GameObjects.Container;

  /** Sprites keyed by layer id (body, shadow, etc.) */
  readonly layers: Record<string, Phaser.GameObjects.Sprite> = {};

  x: number;
  y: number;

  dir: Dir4 = "down";
  action: string = "idle";
  radius = 64

  constructor(scene: Phaser.Scene, def: MobDef, x: number, y: number, radius: number = 64) {
    this.def = def;
    this.x = x;
    this.y = y;
    this.radius = radius

    this.container = scene.add.container(x, y);

    for (const layer of def.layers) {
      const initAction = this.findFirstActionWithLayer(layer.id);
      if (!initAction) {
        continue;
      }

      const tKey = textureKey(def.id, layer.id, initAction);
      const spr = scene.add.sprite(0, 0, tKey, 0);

      spr.setOrigin(0.5);
      spr.setDepth(layer.depthOffset);
      spr.setScale(def.scale ?? 1);

      this.layers[layer.id] = spr;
      this.container.add(spr);
    }

    this.play("idle", "down");
  }

  private findFirstActionWithLayer(layerId: LayerId): string | null {
    if (this.def.actions["idle"]?.files?.[layerId]) return "idle";

    for (const [action, adef] of Object.entries(this.def.actions)) {
      if (adef.files?.[layerId]) return action;
    }
    return null;
  }

  setPos(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.container.setPosition(x, y);

    // Optional: y-sort
    this.container.setDepth(Math.floor(y));
  }

  play(action: string, dir: Dir4) {
    this.action = action;
    this.dir = dir;

    for (const layer of this.def.layers) {
      const spr = this.layers[layer.id];
      if (!spr) continue;

      // If this layer doesn't exist for this action, hide it (prevents missing texture)
      const adef = this.def.actions[action];
      const hasLayerForAction = !!adef?.files?.[layer.id];

      if (!hasLayerForAction) {
        spr.setVisible(false);
        continue;
      }

      spr.setVisible(true);

      const aKey = animKey(this.def.id, layer.id, action, dir);

      // If the animation wasn't created (e.g. file missing), fall back to idle for that layer
      if (spr.scene.anims.exists(aKey)) {
        spr.anims.play(aKey, true);
      } else {
        const fallback = animKey(this.def.id, layer.id, "idle", dir);
        if (spr.scene.anims.exists(fallback)) spr.anims.play(fallback, true);
      }
    }
  }

  destroy() {
    this.container.destroy(true);
  }
}
