import Phaser from "phaser";
import type { SceneMap } from "../phaser/scenes/maps/scenes";
import type { SceneId } from "../../state/gameTypes";

import { PartySceneBase } from "./PartySceneBase";
import { UnitSystem } from "../phaser/units/UnitSystem";
import { useGameStore } from "../../state/store";
import { getOpenWorldScene } from "../phaser/scenes/maps/sceneCatalog";

import { preloadMob, createMobAnimations } from "../phaser/mobs/mobLoader";
import { MOBS } from "../phaser/mobs/mobVisuals";
import { TypeMobs } from "../phaser/mobs/mobTypes";
import { WanderWhenIdleController } from "../phaser/units/WanderWhenIdleController";
import { EnemyController } from "../phaser/units/controller";
import { buildUnitCatalog } from "../phaser/units/UnitProperties";
import type { UnitDef } from "../phaser/units/UnitTypes";

const UNIT_DEFS: Record<string, UnitDef> = buildUnitCatalog();

const MOB_KEYS = [
  TypeMobs.LIZARDMAN + "1",
  TypeMobs.GHOST + "1",
  TypeMobs.SLIME + "4",
  TypeMobs.SLIME + "5",
  TypeMobs.SLIME + "6",
  TypeMobs.SLIMEBOSS + "1",
] as const;

export class OpenWorldScene extends PartySceneBase {
  protected sceneId: SceneId = "plains/autumn_1";

  private maxEnemies = 10;
  private spawnEveryMs = 500;
  private nextSpawnAt = 0;

  constructor() {
    super("OpenWorldScene");
  }

  preload() {
    this.preloadMapsLibrary();
    for (const key of MOB_KEYS) preloadMob(this, MOBS[key]);
  }

  protected override getPartySpawn() {
    return { x: 1000, y: 1000, cols: 5, spacing: 48 };
  }

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

      const unit = this.units.add(
        def,
        x + ox,
        y + oy,
        new WanderWhenIdleController(new EnemyController())
      );
      unit.memberId = m.id;

      this.partyUnits.set(m.id, unit);
      i++;
    }

    this.units.assignIds();
  }

  create(data: { sceneId?: SceneId }) {
    this.applyNearestFilters();
    for (const key of MOB_KEYS) createMobAnimations(this, MOBS[key]);

    // accept sceneId from Phaser start data (or fallback to store)
    const fallback = useGameStore.getState().selectedSceneId;
    this.sceneId = data.sceneId ?? fallback;

    const def = getOpenWorldScene(this.sceneId);
    if (!def) {
      console.warn(`[OpenWorldScene] Unknown sceneId "${this.sceneId}".`);
      return;
    }

    // MapSceneBase.setSceneMap already calls fitCameraToMap()
    this.setSceneMap(def.map);

    this.units = new UnitSystem(this);
    const map = this.currentMap!;
    this.units.setWorldBounds({
      x: 0,
      y: 0,
      width: map.width * map.tileSize,
      height: map.height * map.tileSize,
    });

    this.units.setOnUnitDied((u) => {
      this.units.remove(u);
    });

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
