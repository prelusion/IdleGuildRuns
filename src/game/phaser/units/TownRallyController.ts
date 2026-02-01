import type { UnitContext, UnitController } from "./controller";
import { dirFromDelta, pickAction } from "./controller";
import { safePlay } from "./UnitEntity";

function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class TownRallyController implements UnitController {
  private state: "idle" | "walk" = "idle";
  private nextThinkAt = 0;
  private target = { x: 0, y: 0 };

  private restBias = randFloat(0.45, 0.8);
  private radius = randFloat(140, 320);
  private walkSpeedMul = randFloat(0.85, 1.15);

  update(ctx: UnitContext) {
    const { self, nowMs } = ctx;

    if (nowMs >= this.nextThinkAt) {
      if (this.state === "idle") {
        if (Math.random() < this.restBias) {
          self.intentStop();
          safePlay(self, "idle", self.dir);
          this.nextThinkAt = nowMs + randInt(600, 1400);
          return;
        }

        const cx = self.sceneCenterX || self.x;
        const cy = self.sceneCenterY || self.y;

        this.target = {
          x: cx + randFloat(-this.radius, this.radius),
          y: cy + randFloat(-this.radius, this.radius),
        };

        this.state = "walk";
        this.nextThinkAt = nowMs + randInt(700, 1600);
      } else {
        this.nextThinkAt = nowMs + randInt(700, 1600);
      }
    }

    if (this.state === "walk") {
      self.intentMoveTo(this.target.x, this.target.y, self.stats.walkSpeed * this.walkSpeedMul);

      const dx = this.target.x - self.x;
      const dy = this.target.y - self.y;
      const dir = dirFromDelta(dx, dy);

      const moveAction = pickAction(self, ["walk", "run"]);
      safePlay(self, moveAction, dir);

      if (Math.hypot(dx, dy) < 18) {
        this.state = "idle";
        self.intentStop();
        safePlay(self, "idle", self.dir);
        this.nextThinkAt = nowMs + randInt(400, 1200);
      }
    }
  }
}
