import town from "../phaser/scenes/maps/town.json";
import type { SceneMap } from "../phaser/scenes/maps/scenes";

import { PartySceneBase } from "./PartySceneBase";
import { UnitSystem } from "../phaser/units/UnitSystem";

import { preloadMob, createMobAnimations } from "../phaser/mobs/mobLoader";
import { MOBS } from "../phaser/mobs/mobVisuals";
import { TypeMobs } from "../phaser/mobs/mobTypes";
import { TownRallyController } from "../phaser/units/TownRallyController";
import { buildUnitCatalog } from "../phaser/units/UnitProperties";
import {useGameStore} from "../../state/store.ts";

const UNIT_DEFS = buildUnitCatalog();

export class TownScene extends PartySceneBase {
  protected sceneId = "town" as const;

  constructor() {
    super("TownScene");
  }

  preload() {
    this.preloadTilesets();
    this.preloadMapsLibraryForMap(town as SceneMap);

    preloadMob(this, MOBS[TypeMobs.LIZARDMAN + "1"]);
    preloadMob(this, MOBS[TypeMobs.GHOST + "1"]);
  }

  protected override getPartySpawn() {
    // you can tweak this per-map if you want
    // (UnitSystem also computes worldCenterX/Y but it's set after bounds)
    return { x: 1000, y: 1000, cols: 5, spacing: 48 };
  }

  /** Town wants a different controller than combat scenes */
  protected override syncPartyMembersForScene() {
    const gs = useGameStore.getState();
    const members = Object.values(gs.guildMembers).filter(
      (m) => m.sceneId === this.sceneId && m.hp > 0
    );

    const shouldIds = new Set(members.map((m) => m.id));

    for (const [memberId, unit] of this.partyUnits) {
      if (!shouldIds.has(memberId)) {
        this.units.remove(unit);
        this.partyUnits.delete(memberId);
      }
    }

    const { x, y, cols, spacing } = this.getPartySpawn();
    let i = 0;

    for (const m of members) {
      if (this.partyUnits.has(m.id)) continue;

      const def = (UNIT_DEFS as any)[m.unitDefId];
      if (!def) continue;

      const ox = (i % cols) * spacing;
      const oy = Math.floor(i / cols) * spacing;

      //  Town controller
      const unit = this.units.add(def, x + ox, y + oy, new TownRallyController());
      (unit as any).memberId = m.id;

      this.partyUnits.set(m.id, unit);
      i++;
    }

    this.units.assignIds();
  }

  create() {
    this.applyNearestFilters();

    createMobAnimations(this, MOBS[TypeMobs.LIZARDMAN + "1"]);
    createMobAnimations(this, MOBS[TypeMobs.GHOST + "1"]);

    this.setSceneMap(town as SceneMap);
    this.fitCameraToMap();

    this.units = new UnitSystem(this);
    const map = this.currentMap!;
    this.units.setWorldBounds({
      x: 0,
      y: 0,
      width: map.width * map.tileSize,
      height: map.height * map.tileSize,
    });

    //  Hotload town members in/out
    this.enablePartyHotload();
  }

  update(_t: number, dt: number) {
    this.units?.update(this.time.now, dt);
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