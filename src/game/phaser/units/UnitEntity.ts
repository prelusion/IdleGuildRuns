import Phaser from "phaser";
import type {Dir4, LayerId} from "../mobs/mobTypes";
import { animKey, textureKey } from "../mobs/mobLoader";
import {dirFromDelta} from "./controller.ts";
import type {UnitDef, UnitStats} from "./UnitTypes.ts";

type MoveIntent = { tx: number; ty: number; speed: number } | null;

export function safePlay(self: UnitEntity, action: string, dir: Dir4) {
  if (self.action === action && self.dir === dir) return;
  self.play(action, dir);
}

export class UnitEntity {
  readonly def: UnitDef;
  readonly stats: UnitStats;

  readonly container: Phaser.GameObjects.Container;
  readonly layers: Record<string, Phaser.GameObjects.Sprite> = {};
  private hitZone: Phaser.GameObjects.Zone;

  public hitIntent?: { targetId: string; damage: number };
  public memberId?: string;

  x: number;
  y: number;

  dir: Dir4 = "down";
  action: string = "idle";

  // collision radius
  radius: number;

  id: string = `u_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  sceneCenterX = 0;
  sceneCenterY = 0;

  // internal
  private flashUntilMs = 0;

  private moveIntent: MoveIntent = null

  constructor(scene: Phaser.Scene, def: UnitDef, x: number, y: number) {
    this.def = def;
    this.radius = def.radius;

    this.stats = {
      ...def.baseStats,
      hp: def.baseStats.maxHp,
    };

    this.x = x;
    this.y = y;

    this.container = scene.add.container(x, y);

    const size = Math.max(24, def.radius * 2);
    this.hitZone = scene.add.zone(0, 0, size, size);
    this.hitZone.setOrigin(0.5);
    this.hitZone.setInteractive({ useHandCursor: true });

    this.hitZone.on("pointerdown", () => {
      const memberId = this.memberId as string | undefined;
      if (!memberId) return;
      scene.events.emit("unit:selected", memberId);
    });

    this.container.add(this.hitZone);




    // create sprites per layer, but do NOT assume "idle" exists for every layer
    for (const layer of def.visuals.layers) {
      const initAction = this.findFirstActionWithLayer(layer.id);
      if (!initAction) continue;

      const tKey = textureKey(def.visuals.id, layer.id, initAction);
      const spr = scene.add.sprite(0, 0, tKey, 0);
      spr.setOrigin(0.5);
      spr.setDepth(layer.depthOffset);
      spr.setScale(def.visuals.scale ?? 1);

      this.layers[layer.id] = spr;
      this.container.add(spr);
    }

    this.play("idle", "down");
  }

  private findFirstActionWithLayer(layerId: LayerId): string | null {
    if (this.def.visuals.actions["idle"]?.files?.[layerId]) return "idle";
    for (const [action, adef] of Object.entries(this.def.visuals.actions)) {
      if (adef.files?.[layerId]) return action;
    }
    return null;
  }

  setPos(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.container.setPosition(x, y);
    this.container.setDepth(Math.floor(y)); // y-sort-ish
  }

  play(action: string, dir: Dir4) {
    this.action = action;
    this.dir = dir;

    for (const layer of this.def.visuals.layers) {
      const spr = this.layers[layer.id];
      if (!spr) continue;

      const adef = this.def.visuals.actions[action];
      const hasLayerForAction = !!adef?.files?.[layer.id];

      if (!hasLayerForAction) {
        spr.setVisible(false);
        continue;
      }
      spr.setVisible(true);

      const aKey = animKey(this.def.visuals.id, layer.id, action, dir);
      if (spr.scene.anims.exists(aKey)) {
        spr.anims.play(aKey, true);
      } else {
        const fallback = animKey(this.def.visuals.id, layer.id, "idle", dir);
        if (spr.scene.anims.exists(fallback)) spr.anims.play(fallback, true);
      }
    }
  }

  /** brief red flash for "damage taken" */
  flashDamage(nowMs: number, durationMs = 90) {
    this.flashUntilMs = Math.max(this.flashUntilMs, nowMs + durationMs);
    for (const spr of Object.values(this.layers)) spr.setTint(0xff4444);
  }

  updateVisualEffects(nowMs: number) {
    if (this.flashUntilMs !== 0 && nowMs >= this.flashUntilMs) {
      this.flashUntilMs = 0;
      for (const spr of Object.values(this.layers)) spr.clearTint();
    }
  }

  takeDamage(amount: number, nowMs: number) {
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.flashDamage(nowMs);
  }

  get isDead() {
    return this.stats.hp <= 0;
  }

  destroy() {
    this.container.destroy(true);
  }

  getAnimDurationMs(action: string, dir: Dir4): number {
    let best = 0;

    for (const layer of this.def.visuals.layers) {
      const adef = this.def.visuals.actions[action];
      if (!adef?.files?.[layer.id]) continue;

      const key = animKey(this.def.visuals.id, layer.id, action, dir);
      const anim = this.container.scene.anims.get(key);
      if (!anim) continue;

      const dur = anim.duration as number | undefined;
      if (dur && dur > best) best = dur;
    }

    return best;
  }

  intentMoveTo(tx: number, ty: number, speed: number) {
    this.moveIntent = { tx, ty, speed };
  }

  /** Stop movement */
  intentStop() {
    this.moveIntent = null;
  }

  /** Optional: read-only helper */
  get hasMoveIntent() {
    return this.moveIntent !== null;
  }


  applyIntent(dtMs: number) {
    if (!this.moveIntent) return;

    const beforeX = this.x;
    const beforeY = this.y;

    const { tx, ty, speed } = this.moveIntent;
    const dx = tx - this.x;
    const dy = ty - this.y;

    const d = Math.hypot(dx, dy);
    if (d < 0.5) {
      this.moveIntent = null;
      return;
    }

    const vx = (dx / d) * speed;
    const vy = (dy / d) * speed;

    this.setPos(this.x + (vx * dtMs) / 1000, this.y + (vy * dtMs) / 1000);

    //  Update facing only if we actually moved a bit
    const mx = this.x - beforeX;
    const my = this.y - beforeY;
    const moved = Math.hypot(mx, my);

    if (moved > 0.2) {
      // use actual movement direction, not dx/dy to target
      this.dir = dirFromDelta(mx, my);
    }
  }
}
