import type {UnitContext, UnitController} from "./controller.ts";


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

  // per-unit personality
  private restBias = randFloat(0.45, 0.8);
  private radius = randFloat(140, 320);
  private walkSpeedMul = randFloat(0.85, 1.15);

  update(ctx: UnitContext) {
    const { self, nowMs } = ctx;

    // If we haven't planned yet, do it immediately
    if (nowMs >= this.nextThinkAt) {
      if (this.state === "idle") {
        if (Math.random() < this.restBias) {
          self.intentStop();
          self.play("idle", self.dir);
          this.nextThinkAt = nowMs + randInt(600, 1400);
          return;
        }

        // pick new target around town center (provided by UnitSystem)
        const sceneAny = self.container.scene as any;
        const units = sceneAny.__units as { worldCenterX: number; worldCenterY: number } | undefined;

        const cx = units?.worldCenterX ?? self.x;
        const cy = units?.worldCenterY ?? self.y;

        this.target = {
          x: cx + randFloat(-this.radius, this.radius),
          y: cy + randFloat(-this.radius, this.radius),
        };

        this.state = "walk";
        this.nextThinkAt = nowMs + randInt(700, 1600);
      } else {
        // walking: keep same target for a bit, then maybe reconsider
        this.nextThinkAt = nowMs + randInt(700, 1600);
      }
    }

    if (this.state === "walk") {
      // move toward target
      self.intentMoveTo(this.target.x, this.target.y, self.stats.walkSpeed * this.walkSpeedMul);

      // choose a walk animation if available
      self.play(self.def.visuals.actions["walk"] ? "walk" : "idle", self.dir);

      // arrival check
      const dx = this.target.x - self.x;
      const dy = this.target.y - self.y;
      if (Math.hypot(dx, dy) < 18) {
        this.state = "idle";
        self.intentStop();
        self.play("idle", self.dir);
        this.nextThinkAt = nowMs + randInt(400, 1200);
      }
    }
  }
}
