import type { Dir4 } from "../mobs/mobTypes";
import { safePlay } from "./UnitEntity";
import type { UnitEntity } from "./UnitEntity";

export type UnitSnapshot = {
  id: string;
  x: number;
  y: number;
  radius: number;
  team: "enemy" | "ally";
  kind: "mob" | "boss" | "adventurer" | "worker";
  hp: number;
};

export type UnitContext = {
  nowMs: number;
  dtMs: number;
  self: UnitEntity;
  others: UnitSnapshot[];
};

export interface UnitController {
  update(ctx: UnitContext): void;
}

export function dirFromDelta(dx: number, dy: number): Dir4 {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

type Vec2 = { x: number; y: number };
type Neighbor = { x: number; y: number; radius: number };

function normalize(v: Vec2): Vec2 {
  const m = Math.hypot(v.x, v.y);
  return m > 0.0001 ? { x: v.x / m, y: v.y / m } : { x: 0, y: 0 };
}

function clampMag(v: Vec2, max: number): Vec2 {
  const m = Math.hypot(v.x, v.y);
  if (m <= max || m < 0.0001) return v;
  const k = max / m;
  return { x: v.x * k, y: v.y * k };
}

function desiredVelocity(self: UnitEntity, tx: number, ty: number, speed: number): Vec2 {
  const dx = tx - self.x;
  const dy = ty - self.y;
  const d = normalize({ x: dx, y: dy });
  return { x: d.x * speed, y: d.y * speed };
}

export function pickAction(self: UnitEntity, preferred: string[]): string {
  const actions = self.def.visuals.actions;
  for (const a of preferred) {
    if (actions[a]) return a;
  }

  const token = preferred[0];
  const key = Object.keys(actions).find((k) => k.startsWith(token));
  return key ?? "idle";
}

function separationVelocity(self: UnitEntity, neighbors: Neighbor[], range: number, strength: number): Vec2 {
  let ax = 0;
  let ay = 0;

  for (const n of neighbors) {
    const dx = self.x - n.x;
    const dy = self.y - n.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.0001) continue;

    const minDist = self.radius + n.radius;
    const influenceDist = Math.max(minDist, range);

    if (dist < influenceDist) {
      const overlap = Math.max(0, minDist - dist);
      const nearFactor = 1 - dist / influenceDist;
      const k = strength * (nearFactor + overlap * 0.2);
      ax += (dx / dist) * k;
      ay += (dy / dist) * k;
    }
  }

  return { x: ax, y: ay };
}

function tangentialAroundPoint(self: UnitEntity, px: number, py: number, strength: number, bias: number): Vec2 {
  const dx = px - self.x;
  const dy = py - self.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.0001) return { x: 0, y: 0 };

  const nx = dx / dist;
  const ny = dy / dist;
  const sign = bias >= 0 ? 1 : -1;

  // Perpendicular to (nx, ny)
  return { x: sign * ny * strength, y: sign * -nx * strength };
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function findTarget(self: UnitEntity, others: UnitSnapshot[]): UnitSnapshot | null {
  let best: UnitSnapshot | null = null;
  let bestD = Infinity;

  for (const o of others) {
    if (o.hp <= 0) continue;
    if (o.team === self.def.team) continue;

    const d = Math.hypot(o.x - self.x, o.y - self.y);
    if (d <= self.stats.aggroRange && d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

function pickAttackAction(self: UnitEntity): string {
  const actions = self.def.visuals.actions;

  // Preserve your original priority order exactly
  if (actions["attack"]) return "attack";
  if (actions["attack2"]) return "attack2";
  if (actions["attack3"]) return "attack3";
  if (actions["walk_attack"]) return "walk_attack";
  if (actions["run_attack"]) return "run_attack";
  return "idle";
}

export class CombatController implements UnitController {
  protected state: "idle" | "chase" | "attack" = "idle";
  protected targetId: string | null = null;

  protected nextAttackAt = 0;
  protected pendingHitAt = 0;
  protected pendingHitTargetId: string | null = null;

  protected attackAnimUntil = 0;
  protected lastAttackDir: Dir4 = "down";
  protected attackAction: string = "attack";

  protected orbitBias = Math.random() < 0.5 ? -1 : 1;

  update(ctx: UnitContext) {
    const { self, nowMs, dtMs, others } = ctx;

    if (self.isDead) return;

    // Resolve pending hit
    if (this.pendingHitAt !== 0 && nowMs >= this.pendingHitAt) {
      const t = others.find((o) => o.id === this.pendingHitTargetId);
      if (t && t.hp > 0) {
        self.hitIntent = { targetId: t.id, damage: self.stats.damage };
      }
      this.pendingHitAt = 0;
      this.pendingHitTargetId = null;
    }

    // Acquire/refresh target
    let target: UnitSnapshot | null = null;
    if (this.targetId) target = others.find((o) => o.id === this.targetId) ?? null;
    if (!target || target.hp <= 0) {
      target = findTarget(self, others);
      this.targetId = target?.id ?? null;
    }

    if (!target) {
      this.state = "idle";
      safePlay(self, "idle", self.dir);
      return;
    }

    const dx = target.x - self.x;
    const dy = target.y - self.y;
    const dist = Math.hypot(dx, dy);

    const canAttack = dist <= self.stats.attackRange + target.radius;

    if (canAttack) {
      this.state = "attack";

      const dir = dirFromDelta(dx, dy);
      this.lastAttackDir = dir;

      // If inside attack animation window, keep playing
      if (nowMs < this.attackAnimUntil) {
        safePlay(self, this.attackAction, this.lastAttackDir);
        return;
      }

      // Start a new attack only if cooldown ready
      if (nowMs >= this.nextAttackAt) {
        this.attackAction = pickAttackAction(self);
        safePlay(self, this.attackAction, this.lastAttackDir);

        const animDuration = self.getAnimDurationMs(this.attackAction, this.lastAttackDir);
        const fallback = Math.max(350, self.stats.attackWindupMs);
        const lockMs = animDuration > 0 ? animDuration : fallback;
        this.attackAnimUntil = nowMs + lockMs;

        // Schedule hit at windup
        this.pendingHitAt = nowMs + self.stats.attackWindupMs;
        this.pendingHitTargetId = target.id;

        // Cooldown gate
        this.nextAttackAt = nowMs + self.stats.attackCooldownMs;

        return;
      }

      // Cooldown not ready: face target
      safePlay(self, "idle", this.lastAttackDir);
      return;
    }

    // Chase with separation + orbit
    this.state = "chase";

    const desired = desiredVelocity(self, target.x, target.y, self.stats.runSpeed);
    const neighbors: Neighbor[] = others.map((o) => ({ x: o.x, y: o.y, radius: o.radius }));
    const sep = separationVelocity(self, neighbors, 140, 260);

    const orbitStrength = dist < 240 ? 220 : dist < 420 ? 120 : 0;
    const orbit =
      orbitStrength > 0
        ? tangentialAroundPoint(self, target.x, target.y, orbitStrength, this.orbitBias)
        : { x: 0, y: 0 };

    const vel = clampMag(
      { x: desired.x + sep.x + orbit.x, y: desired.y + sep.y + orbit.y },
      self.stats.runSpeed
    );

    self.setPos(self.x + (vel.x * dtMs) / 1000, self.y + (vel.y * dtMs) / 1000);

    if (Math.abs(vel.x) + Math.abs(vel.y) > 0.5) {
      const runAction = pickAction(self, ["run", "walk"]);
      safePlay(self, runAction, dirFromDelta(vel.x, vel.y));
    }
  }
}

export class AdventurerController extends CombatController {}

export class WorkerController implements UnitController {
  private nextThinkAt = 0;
  private wanderTarget = { x: 0, y: 0 };

  update(ctx: UnitContext) {
    const { self, nowMs, dtMs, others } = ctx;
    if (self.isDead) return;

    const threat = findTarget(self, others);
    if (threat) {
      const dx = self.x - threat.x;
      const dy = self.y - threat.y;
      const dir = normalize({ x: dx, y: dy });
      const desired = { x: dir.x * self.stats.runSpeed, y: dir.y * self.stats.runSpeed };

      const neighbors: Neighbor[] = others.map((o) => ({ x: o.x, y: o.y, radius: o.radius }));
      const sep = separationVelocity(self, neighbors, 140, 280);

      const vel = clampMag({ x: desired.x + sep.x, y: desired.y + sep.y }, self.stats.runSpeed);

      self.setPos(self.x + (vel.x * dtMs) / 1000, self.y + (vel.y * dtMs) / 1000);
      safePlay(self, "run", dirFromDelta(vel.x, vel.y));
      return;
    }

    // No threat: idle/wander
    if (nowMs >= this.nextThinkAt) {
      if (Math.random() < 0.6) {
        safePlay(self, "idle", self.dir);
        this.nextThinkAt = nowMs + randInt(500, 1400);
      } else {
        this.wanderTarget = { x: self.x + randInt(-220, 220), y: self.y + randInt(-220, 220) };
        safePlay(
          self,
          "walk",
          dirFromDelta(this.wanderTarget.x - self.x, this.wanderTarget.y - self.y)
        );
        this.nextThinkAt = nowMs + randInt(600, 1400);
      }
    }

    const desired = desiredVelocity(self, this.wanderTarget.x, this.wanderTarget.y, self.stats.walkSpeed);
    const neighbors: Neighbor[] = others.map((o) => ({ x: o.x, y: o.y, radius: o.radius }));
    const sep = separationVelocity(self, neighbors, 140, 220);
    const vel = clampMag({ x: desired.x + sep.x, y: desired.y + sep.y }, self.stats.walkSpeed);

    self.setPos(self.x + (vel.x * dtMs) / 1000, self.y + (vel.y * dtMs) / 1000);
    if (Math.abs(vel.x) + Math.abs(vel.y) > 0.5) {
      safePlay(self, "walk", dirFromDelta(vel.x, vel.y));
    }
  }
}

export class EnemyController extends CombatController {}
export class BossController extends CombatController {}
