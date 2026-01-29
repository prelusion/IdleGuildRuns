// WanderWhenIdleController.ts
import type { UnitController, UnitContext } from "./controller";
import { dirFromDelta } from "./controller";
import {safePlay} from "./UnitEntity.ts";

function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class WanderWhenIdleController implements UnitController {
  private base: UnitController;

  private nextThinkAt = 0;
  private state: "idle" | "walk" = "idle";
  private target = { x: 0, y: 0 };

  private restBias = randFloat(0.45, 0.75);
  private radius = randFloat(120, 260);

  private stuckUntilMs = 0;
  private lastDist = Infinity;

  constructor(base: UnitController) {
    this.base = base;
  }


  update(ctx: UnitContext) {
    const { self, nowMs } = ctx;

    // Let combat do its thing first
    this.base.update(ctx);

    // If combat set an attack or chase-like action, don't override it
    if (self.action.includes("attack") || self.action.startsWith("run")) return;

    // If we’re already moving due to combat chase, don't override
    if (self.hasMoveIntent) return;

    // Wander logic only when idle (no combat target)
    if (nowMs >= this.nextThinkAt) {
      if (this.state === "idle") {
        if (Math.random() < this.restBias) {
          self.intentStop();
          safePlay(self, "idle", self.dir)
          this.nextThinkAt = nowMs + randInt(500, 1400);
          return;
        }

        this.target = {
          x: self.x + randFloat(-this.radius, this.radius),
          y: self.y + randFloat(-this.radius, this.radius),
        };

        this.state = "walk";
        this.nextThinkAt = nowMs + randInt(700, 1600);
      } else {
        this.nextThinkAt = nowMs + randInt(700, 1600);
      }
    }

    if (this.state === "walk") {
      const dx = this.target.x - self.x;
      const dy = this.target.y - self.y;
      const dist = Math.hypot(dx, dy);

      self.intentMoveTo(this.target.x, this.target.y, self.stats.walkSpeed);

      //  face the intended direction ONLY if dist is meaningful
      const faceDir = dist > 2 ? dirFromDelta(dx, dy) : self.dir;
      safePlay(self, self.def.visuals.actions["walk"] ? "walk" : "idle", faceDir);

      //  Arrival (use a slightly larger threshold than 18 if collisions exist)
      const ARRIVE = 22;
      if (dist < ARRIVE) {
        this.state = "idle";
        self.intentStop();
        safePlay(self, "idle", self.dir);
        this.nextThinkAt = nowMs + randInt(400, 1200);
        this.stuckUntilMs = 0;
        this.lastDist = Infinity;
        return;
      }

      //  Stuck detection: if dist isn't improving for a while, re-pick target
      if (dist < this.lastDist - 0.5) {
        this.lastDist = dist;
        this.stuckUntilMs = nowMs + 800; // give it 0.8s to keep improving
      } else if (this.stuckUntilMs !== 0 && nowMs > this.stuckUntilMs) {
        // stuck: abandon target
        this.state = "idle";
        self.intentStop();
        safePlay(self, "idle", self.dir);
        this.nextThinkAt = nowMs + randInt(150, 450); // re-think soon
        this.stuckUntilMs = 0;
        this.lastDist = Infinity;
        return;
      } else if (this.stuckUntilMs === 0) {
        // initialize stuck window on first walk frame
        this.stuckUntilMs = nowMs + 800;
        this.lastDist = dist;
      }
    }
  }
}
