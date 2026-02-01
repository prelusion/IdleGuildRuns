import town from "../phaser/scenes/maps/town.json";
import type { SceneMap } from "../phaser/scenes/maps/scenes";

import { PartySceneBase } from "./PartySceneBase";
import { UnitSystem } from "../phaser/units/UnitSystem";

import { preloadMob, createMobAnimations } from "../phaser/mobs/mobLoader";
import { MOBS } from "../phaser/mobs/mobVisuals";
import { TypeMobs } from "../phaser/mobs/mobTypes";
import { TownRallyController } from "../phaser/units/TownRallyController";
import { buildUnitCatalog } from "../phaser/units/UnitProperties";
import type { UnitDef } from "../phaser/units/UnitTypes";
import { useGameStore } from "../../state/store";

const UNIT_DEFS: Record<string, UnitDef> = buildUnitCatalog();

const MOB_KEYS = [TypeMobs.LIZARDMAN + "1", TypeMobs.GHOST + "1"] as const;

export class TownScene extends PartySceneBase {
  protected sceneId = "town" as const;

  constructor() {
    super("TownScene");
  }

  preload() {
    this.preloadMapsLibrary();
    for (const key of MOB_KEYS) preloadMob(this, MOBS[key]);
  }

  protected override getPartySpawn() {
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

      const def = UNIT_DEFS[m.unitDefId];
      if (!def) continue;

      const ox = (i % cols) * spacing;
      const oy = Math.floor(i / cols) * spacing;

      const unit = this.units.add(def, x + ox, y + oy, new TownRallyController());
      unit.memberId = m.id;

      this.partyUnits.set(m.id, unit);
      i++;
    }

    this.units.assignIds();
  }

  create() {
    this.applyNearestFilters();

    for (const key of MOB_KEYS) createMobAnimations(this, MOBS[key]);

    // MapSceneBase.setSceneMap already calls fitCameraToMap()
    this.setSceneMap(town as SceneMap);

    this.units = new UnitSystem(this);
    const map = this.currentMap!;
    this.units.setWorldBounds({
      x: 0,
      y: 0,
      width: map.width * map.tileSize,
      height: map.height * map.tileSize,
    });

    // Hot load town members in/out
    this.enablePartyHotload();
  }

  update(_t: number, dt: number) {
    this.units?.update(this.time.now, dt);
  }

  public override setSceneMap(map: SceneMap) {
    super.setSceneMap(map);

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
