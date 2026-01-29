import Phaser from "phaser";
import hell from "../phaser/scenes/maps/hell.json";
import type { SceneMap } from "../phaser/scenes/maps/scenes";

import { PartySceneBase } from "./PartySceneBase";
import { UnitSystem } from "../phaser/units/UnitSystem";

import { MOBS } from "../phaser/mobs/mobVisuals";
import { TypeMobs } from "../phaser/mobs/mobTypes";
import { preloadMob, createMobAnimations } from "../phaser/mobs/mobLoader";
import { buildUnitCatalog } from "../phaser/units/UnitProperties";
import { EnemyController } from "../phaser/units/controller";
import { WanderWhenIdleController } from "../phaser/units/WanderWhenIdleController";
import town from "../phaser/scenes/maps/town.json";

const UNIT_DEFS = buildUnitCatalog();

export class HellScene extends PartySceneBase {
  protected sceneId = "hell" as const;

  private maxEnemies = 10;
  private spawnEveryMs = 500;
  private nextSpawnAt = 0;

  constructor() {
    super("HellScene");
  }

  preload() {
    console.log("PRELOAD HELL SCENE")
    this.preloadTilesets();
    this.preloadMapsLibraryForMap(hell as SceneMap);

    preloadMob(this, MOBS[TypeMobs.SLIME + "4"]);
    preloadMob(this, MOBS[TypeMobs.SLIME + "5"]);
    preloadMob(this, MOBS[TypeMobs.SLIME + "6"]);
    preloadMob(this, MOBS[TypeMobs.SLIMEBOSS + "1"]);
    preloadMob(this, MOBS[TypeMobs.LIZARDMAN + "1"]);
    preloadMob(this, MOBS[TypeMobs.GHOST + "1"]);
  }

  protected override getPartySpawn() {
    return { x: 100, y: 100, cols: 4, spacing: 48 };
  }

  create() {
    this.applyNearestFilters();

    this.setSceneMap(hell as SceneMap);
    this.fitCameraToMap();

    createMobAnimations(this, MOBS[TypeMobs.SLIME + "4"]);
    createMobAnimations(this, MOBS[TypeMobs.SLIME + "5"]);
    createMobAnimations(this, MOBS[TypeMobs.SLIME + "6"]);
    createMobAnimations(this, MOBS[TypeMobs.SLIMEBOSS + "1"]);
    createMobAnimations(this, MOBS[TypeMobs.LIZARDMAN + "1"]);
    createMobAnimations(this, MOBS[TypeMobs.GHOST + "1"]);

    this.units = new UnitSystem(this);

    const map = this.currentMap!;
    this.units.setWorldBounds({
      x: 0,
      y: 0,
      width: map.width * map.tileSize,
      height: map.height * map.tileSize,
    });

    this.units.setOnUnitDied((u) => {
      if (u.def.team === "enemy") this.units.remove(u);
    });

    //  Hotload party members for hell
    this.enablePartyHotload();

    this.units.assignIds();

    this.nextSpawnAt = this.time.now + 400;
  }

  update(_t: number, dt: number) {
    const now = this.time.now;

    this.units?.update(now, dt);

    if (now >= this.nextSpawnAt) {
      this.nextSpawnAt = now + this.spawnEveryMs;
      this.spawnEnemiesIfNeeded();
    }
  }

  private spawnEnemiesIfNeeded() {
    const aliveEnemies = this.units
      .getUnits()
      .filter((u) => u.def.team === "enemy" && !u.isDead).length;

    if (!this.currentMap) return;
    if (aliveEnemies >= this.maxEnemies) return;

    const mapPxW = this.currentMap.width * this.currentMap.tileSize;
    const mapPxH = this.currentMap.height * this.currentMap.tileSize;

    const x = Phaser.Math.Between(200, Math.max(200, mapPxW - 200));
    const y = Phaser.Math.Between(200, Math.max(200, mapPxH - 200));

    const pick = Phaser.Math.Between(0, 2);
    const def =
      pick === 0 ? UNIT_DEFS.slime4 : pick === 1 ? UNIT_DEFS.slime5 : UNIT_DEFS.slime6;

    this.units.add(def, x, y, new WanderWhenIdleController(new EnemyController()));
    this.units.assignIds();
  }

  public override setSceneMap(map: SceneMap) {
    super.setSceneMap(map);
    this.fitCameraToMap();

    if (this.units) {
      this.units.setWorldBounds({
        x: 0,
        y: 0,
        width: map.width * map.tileSize,
        height: map.height * map.tileSize,
      });
    }
  }
}