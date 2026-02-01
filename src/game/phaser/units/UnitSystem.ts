import type Phaser from "phaser";
import type { UnitDef } from "./UnitTypes";
import type { UnitController, UnitSnapshot } from "./controller";
import { UnitEntity } from "./UnitEntity";

type HitIntent = { targetId: string; damage: number };
type WorldBounds = { x: number; y: number; width: number; height: number };

export class UnitSystem {
  private scene: Phaser.Scene;

  private units: UnitEntity[] = [];
  private controllers = new Map<string, UnitController>();

  private onUnitDied?: (u: UnitEntity) => void;

  private deathNotified = new Set<string>();

  private worldBounds: WorldBounds | null = null;
  public worldCenterX = 0;
  public worldCenterY = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public setOnUnitDied(cb: (u: UnitEntity) => void) {
    this.onUnitDied = cb;
  }

  public setWorldBounds(bounds: WorldBounds) {
    this.worldBounds = bounds;
    this.worldCenterX = bounds.x + bounds.width / 2;
    this.worldCenterY = bounds.y + bounds.height / 2;
  }

  public getUnits(): readonly UnitEntity[] {
    return this.units;
  }

  public add(def: UnitDef, x: number, y: number, controller: UnitController) {
    const u = new UnitEntity(this.scene, def, x, y);
    this.units.push(u);
    this.controllers.set(u.id, controller);
    return u;
  }

  public assignIds() {
    const seen = new Set<string>();
    for (const u of this.units) {
      // UnitEntity always sets id, but keep your safety behavior
      if (!u.id) u.id = `u_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
      while (seen.has(u.id)) {
        u.id = `u_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
      }
      seen.add(u.id);
    }
  }

  public remove(u: UnitEntity) {
    this.controllers.delete(u.id);
    this.deathNotified.delete(u.id);
    this.units = this.units.filter((x) => x !== u);
    u.destroy();
  }

  public update(nowMs: number, dtMs: number) {
    this.updateWorldCenterSafe();

    const snaps: UnitSnapshot[] = this.units.map((u) => ({
      id: u.id,
      x: u.x,
      y: u.y,
      radius: u.radius,
      team: u.def.team,
      kind: u.def.kind,
      hp: u.stats.hp,
    }));

    // Precompute others per unit (avoid re-filtering snaps N times)
    const othersById = new Map<string, UnitSnapshot[]>();
    for (const s of snaps) {
      othersById.set(
        s.id,
        snaps.filter((o) => o.id !== s.id)
      );
    }

    // 1) Controllers update
    for (const u of this.units) {
      if (u.isDead) continue;

      const c = this.controllers.get(u.id);
      if (!c) continue;

      c.update({
        nowMs,
        dtMs,
        self: u,
        others: othersById.get(u.id) ?? [],
      });
    }

    // 2) Apply hit intents
    for (const u of this.units) {
      const intent = u.hitIntent as HitIntent | undefined;
      if (!intent) continue;
      delete u.hitIntent;

      const target = this.units.find((t) => t.id === intent.targetId);
      if (!target || target.isDead) continue;

      target.takeDamage(intent.damage, nowMs);

      if (target.isDead && !this.deathNotified.has(target.id)) {
        this.deathNotified.add(target.id);
        this.onUnitDied?.(target);
      }
    }

    // 3) Movement + collisions (only affects intent-driven controllers)
    this.applyMovementAndCollisions(dtMs);

    // 4) Visual effects
    for (const u of this.units) u.updateVisualEffects(nowMs);

    // 5) Remove dead enemies completely
    this.purgeDeadEnemies();
  }

  private purgeDeadEnemies() {
    const deadEnemies = this.units.filter((u) => u.isDead && u.def.team === "enemy");
    for (const u of deadEnemies) this.remove(u);
  }

  private updateWorldCenterSafe() {
    const cam = this.scene.cameras.main;
    const view = cam.worldView;

    const b: WorldBounds | null =
      view.width > 0 && view.height > 0
        ? { x: view.x, y: view.y, width: view.width, height: view.height }
        : this.worldBounds;

    if (!b || b.width <= 0 || b.height <= 0) return;

    this.worldCenterX = b.x + b.width / 2;
    this.worldCenterY = b.y + b.height / 2;

    for (const u of this.units) {
      u.sceneCenterX = this.worldCenterX;
      u.sceneCenterY = this.worldCenterY;
    }
  }

  private applyMovementAndCollisions(dtMs: number) {
    // Apply intent movement first
    for (const unit of this.units) {
      if (unit.isDead) continue;
      unit.applyIntent(dtMs);
    }

    // Resolve overlaps
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < this.units.length; i++) {
        for (let j = i + 1; j < this.units.length; j++) {
          const a = this.units[i];
          const b = this.units[j];
          if (a.isDead || b.isDead) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const min = a.radius + b.radius;

          if (dist < 0.0001 || dist >= min) continue;

          const nx = dx / dist;
          const ny = dy / dist;
          const push = (min - dist) * 0.5;

          a.setPos(a.x - nx * push, a.y - ny * push);
          b.setPos(b.x + nx * push, b.y + ny * push);
        }
      }
    }
  }
}
