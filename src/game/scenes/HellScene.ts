import Phaser from "phaser";
import hell from "../phaser/scenes/maps/hell.json";
import type { SceneMap } from "../phaser/scenes/maps/scenes";
import { MapSceneBase } from "./MapSceneBase";

import { UnitSystem } from "../phaser/units/UnitSystem";
import { buildUnitCatalog } from "../phaser/units/UnitProperties";
import { AdventurerController, EnemyController, WorkerController } from "../phaser/units/controller";

import { useGameStore } from "../../state/store";

// If your mobs need preloading + animations, keep those in HellScene preload/create.
// If Hell already loads visuals elsewhere, you can remove these imports.
import { MOBS } from "../phaser/mobs/mobVisuals";
import { TypeMobs } from "../phaser/mobs/mobTypes";
import { preloadMob, createMobAnimations } from "../phaser/mobs/mobLoader";

const UNIT_DEFS = buildUnitCatalog();

export class HellScene extends MapSceneBase {
  private units!: UnitSystem;

  private maxEnemies = 50;
  private spawnEveryMs = 500;
  private nextSpawnAt = 0;

  constructor() {
    super("HellScene");
  }

  preload() {
    this.preloadTilesets();

    // Preload only what Hell uses (add more as needed)
    preloadMob(this, MOBS[TypeMobs.SLIME + "4"]);
    preloadMob(this, MOBS[TypeMobs.SLIME + "5"]);
    preloadMob(this, MOBS[TypeMobs.SLIME + "6"]);
    preloadMob(this, MOBS[TypeMobs.SLIMEBOSS + "1"]);
    preloadMob(this, MOBS[TypeMobs.LIZARDMAN + "1"]);
    preloadMob(this, MOBS[TypeMobs.GHOST + "1"]);
  }

  create() {
    this.applyNearestFilters();

    // Map first (this must happen before UnitSystem update)
    this.setSceneMap(hell as SceneMap);
    this.fitCameraToMap();

    // Animations
    createMobAnimations(this, MOBS[TypeMobs.SLIME + "4"]);
    createMobAnimations(this, MOBS[TypeMobs.SLIME + "5"]);
    createMobAnimations(this, MOBS[TypeMobs.SLIME + "6"]);
    createMobAnimations(this, MOBS[TypeMobs.SLIMEBOSS + "1"]);
    createMobAnimations(this, MOBS[TypeMobs.LIZARDMAN + "1"]);
    createMobAnimations(this, MOBS[TypeMobs.GHOST + "1"]);

    // Units
    this.units = new UnitSystem(this);

    // Set bounds so UnitSystem never reads undefined cam.bounds
    const map = this.currentMap!;
    this.units.setWorldBounds({
      x: 0,
      y: 0,
      width: map.width * map.tileSize,
      height: map.height * map.tileSize,
    });

    // Despawn enemies on death (gold later)
    this.units.setOnUnitDied((u) => {
      if (u.def.team === "enemy") {
        // optional: award gold here
        // useGameStore.getState().addGold(1);
        // Note: UnitSystem will also purge dead enemies,
        // but removing here makes it immediate.
        this.units.remove(u);
      }
    });

    // Spawn allies assigned to hell
    this.spawnPartyMembersForHell();

    // Optional: boss (only if you want)
    // this.units.add(UNIT_DEFS.slime_boss1, 650, 520, new BossController());

    this.units.assignIds();

    // Spawn loop
    this.nextSpawnAt = this.time.now + 400;

    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      const now = this.time.now;

      this.units.update(now, dt);

      if (now >= this.nextSpawnAt) {
        this.nextSpawnAt = now + this.spawnEveryMs;
        this.spawnEnemiesIfNeeded();
      }
    });
  }

  private spawnPartyMembersForHell() {
    const gs = useGameStore.getState();
    const members = Object.values(gs.guildMembers).filter((m) => m.sceneId === "hell" && m.hp > 0);

    let i = 0;
    for (const m of members) {
      const def = UNIT_DEFS[m.unitDefId];
      if (!def) continue;

      const ox = (i % 4) * 48;
      const oy = Math.floor(i / 4) * 48;

      const controller =
        m.role === "worker" ? new WorkerController() : new AdventurerController();

      // ✅ always start at 100,100 cluster
      this.units.add(def, 100 + ox, 100 + oy, controller);
      i++;
    }
  }

  private spawnEnemiesIfNeeded() {
    const aliveEnemies = this.units.getUnits().filter((u) => u.def.team === "enemy" && !u.isDead).length;
    if (!this.currentMap) return;
    if (aliveEnemies >= this.maxEnemies) return;

    const mapPxW = this.currentMap.width * this.currentMap.tileSize;
    const mapPxH = this.currentMap.height * this.currentMap.tileSize;

    const x = Phaser.Math.Between(200, Math.max(200, mapPxW - 200));
    const y = Phaser.Math.Between(200, Math.max(200, mapPxH - 200));

    const pick = Phaser.Math.Between(0, 2);
    const def = pick === 0 ? UNIT_DEFS.slime4 : pick === 1 ? UNIT_DEFS.slime5 : UNIT_DEFS.slime6;

    this.units.add(def, x, y, new EnemyController());
    this.units.assignIds();
  }

  public override setSceneMap(map: SceneMap) {
    super.setSceneMap(map);
    this.fitCameraToMap();

    // Keep UnitSystem bounds in sync if map changes in editor
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
