
import type { Dir4 } from "../mobs/mobTypes";
import type {MobEntity} from "../entities/mobEntity.ts";

export type MobAIContext = {
  nowMs: number;
  dtMs: number;
  playerPos: { x: number; y: number; radius: number } | null;
  neighbors: Array<{ x: number; y: number; radius: number }>;
};


export interface MobAI {
  update(mob: MobEntity, ctx: MobAIContext): void;
}

function dirFromDelta(dx: number, dy: number): Dir4 {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

export class WanderAggroAI implements MobAI {
  private state: "idle" | "walk" | "chase" | "run" | "attack" = "idle";
  private nextThinkAt: number;
  private target = { x: 0, y: 0 };

  private restBias: number;
  private radius: number;

  private walkSpeed: number;
  private runSpeed: number;
  private chaseSpeed: number;

  private aggroRange: number;
  private orbitBias: number;

  constructor(nowMs = 0) {
    this.nextThinkAt = nowMs + randInt(0, 1200);

    this.restBias = randFloat(0.45, 0.75);
    this.radius = randFloat(120, 2060);

    this.walkSpeed = randFloat(90, 150);
    this.runSpeed = this.walkSpeed * 1.9;
    this.chaseSpeed = this.walkSpeed * 3;

    this.orbitBias = Math.random() < 0.5 ? -1 : 1;
    this.aggroRange = randFloat(3800, 5600);
  }

  update(mob: MobEntity, ctx: MobAIContext) {
    const { nowMs, dtMs, playerPos } = ctx;

    // ---- CHASE LOGIC (skipped if no player) ----
    if (playerPos) {
      const dxp = playerPos.x - mob.x;
      const dyp = playerPos.y - mob.y;
      const dist = Math.hypot(dxp, dyp);

      if (dist <= 200) {
        this.state = "attack";
        this.nextThinkAt = nowMs + randInt(300, 900);
        mob.play("attack", mob.dir);
      } else if (dist <= this.aggroRange) {
        this.state = "chase";
      } else if (this.state === "chase") {
        this.state = "idle";
        this.nextThinkAt = nowMs + randInt(300, 900);
        mob.play("idle", mob.dir);
      }

      if (this.state === "attack") {
        if(!playerPos) {
          this.state = "idle"
          mob.play("idle", mob.dir);
        }
      }

      if (this.state === "chase") {
        const dir = dirFromDelta(dxp, dyp);
        mob.play("run", dir);

        const desired = desiredVelocity(mob, playerPos.x, playerPos.y, this.chaseSpeed);

        const avoidList = ctx.playerPos
          ? [...ctx.neighbors, ctx.playerPos]
          : ctx.neighbors;

        const sep = separationVelocity(mob, avoidList, 140, 260);

        const toPlayerDist = Math.hypot(playerPos.x - mob.x, playerPos.y - mob.y);
        const orbitStrength = toPlayerDist < 220 ? 180 : toPlayerDist < 400 ? 90 : 0;

        const orbit =
          orbitStrength > 0
            ? tangentialAroundPoint(mob, playerPos, orbitStrength, this.orbitBias)
            : { x: 0, y: 0 };

        const vel = clampMag(
          { x: desired.x + sep.x + orbit.x, y: desired.y + sep.y + orbit.y },
          this.chaseSpeed
        );

        mob.setPos(mob.x + (vel.x * dtMs) / 1000, mob.y + (vel.y * dtMs) / 1000);

        if (Math.abs(vel.x) + Math.abs(vel.y) > 0.5) {
          mob.play("run", dirFromDelta(vel.x, vel.y));
        }

        return;

      }

    }

    // ---- THINKING ----
    if (nowMs >= this.nextThinkAt) {
      if (this.state === "idle") {
        if (Math.random() < this.restBias) {
          mob.play("idle", mob.dir);
          this.nextThinkAt = nowMs + randInt(400, 1200);
        } else {
          // 20% run, 80% walk
          const willRun = Math.random() < 0.2;
          this.state = willRun ? "run" : "walk";

          this.target = {
            x: mob.x + randInt(-this.radius, this.radius),
            y: mob.y + randInt(-this.radius, this.radius),
          };

          const dir = dirFromDelta(this.target.x - mob.x, this.target.y - mob.y);
          mob.play(willRun ? "run" : "walk", dir);

          // keep current plan for a bit
          this.nextThinkAt = nowMs + randInt(600, 1400);
        }
      }
    }


    // ---- MOVE ----
    if (this.state === "walk" || this.state === "run") {
      const speed = this.state === "run" ? this.runSpeed : this.walkSpeed;

      // 1) Desired velocity to target
      const desired = desiredVelocity(mob, this.target.x, this.target.y, speed);

      // 2) Separation away from neighbors (+ player if present)
      const avoidList = ctx.playerPos
        ? [...ctx.neighbors, ctx.playerPos]
        : ctx.neighbors;

      const sep = separationVelocity(mob, avoidList, 140, 220);

      // 3) Combine and clamp
      const vel = clampMag({ x: desired.x + sep.x, y: desired.y + sep.y }, speed);

      // 4) Move
      mob.setPos(mob.x + (vel.x * dtMs) / 1000, mob.y + (vel.y * dtMs) / 1000);

      // 5) Face movement direction
      if (Math.abs(vel.x) + Math.abs(vel.y) > 0.5) {
        mob.play(this.state, dirFromDelta(vel.x, vel.y));
      }

      // 6) Arrival
      const dx = this.target.x - mob.x;
      const dy = this.target.y - mob.y;
      if (Math.hypot(dx, dy) < 6) {
        this.state = "idle";
        this.nextThinkAt = nowMs + randInt(300, 900);
        mob.play("idle", mob.dir);
      }
    }

  }

}


function separationVelocity(
  mob: MobEntity,
  neighbors: Array<{ x: number; y: number; radius: number }>,
  range: number,
  strength: number
): { x: number; y: number } {
  let ax = 0;
  let ay = 0;

  for (const n of neighbors) {
    // skip self if included
    if (n.x === mob.x && n.y === mob.y) continue;

    const dx = mob.x - n.x;
    const dy = mob.y - n.y;
    const dist = Math.hypot(dx, dy);

    const minDist = mob.radius + n.radius;
    const influenceDist = Math.max(minDist, range);

    if (dist > 0.0001 && dist < influenceDist) {
      // push more if overlapping, less if just near
      const overlap = Math.max(0, minDist - dist);
      const nearFactor = 1 - dist / influenceDist; // 0..1

      const k = strength * (nearFactor + overlap * 0.08);
      ax += (dx / dist) * k;
      ay += (dy / dist) * k;
    }
  }

  return { x: ax, y: ay };
}


function desiredVelocity(mob: MobEntity, tx: number, ty: number, speedPxPerSec: number): Vec2 {
  const dx = tx - mob.x;
  const dy = ty - mob.y;
  const dir = normalize({ x: dx, y: dy });
  return { x: dir.x * speedPxPerSec, y: dir.y * speedPxPerSec };
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}


// Collision helpers
type Vec2 = { x: number; y: number };

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

function tangentialAroundPoint(
  mob: MobEntity,
  point: { x: number; y: number },
  strength: number,
  clockwiseBias: number // -1..1 (random per mob is great)
): Vec2 {
  const dx = point.x - mob.x;
  const dy = point.y - mob.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.0001) return { x: 0, y: 0 };

  // unit vector from mob -> point
  const nx = dx / dist;
  const ny = dy / dist;

  // perpendicular directions (tangent)
  // left tangent: (-ny, nx) , right tangent: (ny, -nx)
  // clockwiseBias picks which side this mob prefers.
  const sign = clockwiseBias >= 0 ? 1 : -1;
  const tx = sign * ny;
  const ty = sign * -nx;

  return { x: tx * strength, y: ty * strength };
}

