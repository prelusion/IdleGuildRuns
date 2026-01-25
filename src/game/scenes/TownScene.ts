import Phaser from "phaser";
import town from "../phaser/scenes/maps/town.json";
import type { SceneMap } from "../phaser/scenes/maps/scenes";
import { MapSceneBase } from "./MapSceneBase";

import { UnitSystem } from "../phaser/units/UnitSystem";
import { buildUnitCatalog } from "../phaser/units/UnitProperties";
import { AdventurerController, WorkerController } from "../phaser/units/controller";

import { useGameStore } from "../../state/store";
import {preloadMob} from "../phaser/mobs/mobLoader.ts";
import {MOBS} from "../phaser/mobs/mobVisuals.ts";
import {TypeMobs} from "../phaser/mobs/mobTypes.ts";
import {TownRallyController} from "../phaser/units/TownRallyController.ts";

const UNIT_DEFS = buildUnitCatalog();

export class TownScene extends MapSceneBase {
  private units!: UnitSystem;

  constructor() {
    super("TownScene");
  }


  preload() {
    this.preloadTilesets();

    preloadMob(this, MOBS[TypeMobs.LIZARDMAN + "1"]);
    preloadMob(this, MOBS[TypeMobs.GHOST + "1"]);
  }

  create() {
    this.applyNearestFilters();

    // Map first
    this.setSceneMap(town as SceneMap);
    this.fitCameraToMap();

    // Units
    this.units = new UnitSystem(this);
    (this as any).__units = this.units; // used by TownRallyController convenience

    // Set bounds for UnitSystem (prevents cam.bounds undefined issues)
    const map = this.currentMap!;
    this.units.setWorldBounds({
      x: 0,
      y: 0,
      width: map.width * map.tileSize,
      height: map.height * map.tileSize,
    });

    this.spawnGuildMembersForTown();

    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      this.units.update(this.time.now, dt);
    });
  }

  private spawnGuildMembersForTown() {
    const gs = useGameStore.getState();
    const members = Object.values(gs.guildMembers).filter(
      (m) => m.sceneId === "town" && m.hp > 0
    );

    // Prefer UnitSystem computed center if you have it
    const cx = this.units.worldCenterX || 1000;
    const cy = this.units.worldCenterY || 1000;

    let i = 0;
    for (const m of members) {
      const def = UNIT_DEFS[m.unitDefId];
      if (!def) continue;

      const ox = (i % 5) * 48;
      const oy = Math.floor(i / 5) * 48;

      // Town: rally/wander controller (no combat wrapper)
      this.units.add(def, cx + ox, cy + oy, new TownRallyController());
      i++;
    }

    this.units.assignIds();
  }

}
