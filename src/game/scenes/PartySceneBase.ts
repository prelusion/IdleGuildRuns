import Phaser from "phaser";
import type { SceneId } from "../../state/gameTypes";
import { useGameStore } from "../../state/store";
import { MapSceneBase } from "./MapSceneBase";
import type { UnitSystem } from "../phaser/units/UnitSystem";
import type { UnitEntity } from "../phaser/units/UnitEntity";
import { buildUnitCatalog } from "../phaser/units/UnitProperties";
import type { UnitDef } from "../phaser/units/UnitTypes";
import { AdventurerController, WorkerController } from "../phaser/units/controller";

const UNIT_DEFS: Record<string, UnitDef> = buildUnitCatalog();

export abstract class PartySceneBase extends MapSceneBase {
  protected units!: UnitSystem;

  protected partyUnits = new Map<string, UnitEntity>(); // memberId -> unit
  private unsubGuild?: () => void;

  /** each child scene must set this */
  protected abstract sceneId: SceneId;

  /** optional spawn point per scene */
  protected getPartySpawn() {
    return { x: 100, y: 100, cols: 4, spacing: 48 };
  }

  /** Call after units is created */
  protected enablePartyHotload() {
    this.syncPartyMembersForScene();
    this.enableSelection();

    // Click empty space -> clear selection + clear highlights
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (_p: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length === 0) {
          useGameStore.getState().clearSelectedMember();
          for (const [, u] of this.partyUnits) {
            for (const spr of Object.values(u.layers)) spr.clearTint();
          }
        }
      }
    );

    this.unsubGuild = useGameStore.subscribe(
      (s) => s.guildMembers,
      () => this.syncPartyMembersForScene()
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubGuild?.();
      this.unsubGuild = undefined;
      this.partyUnits.clear();
      this.input.off(Phaser.Input.Events.POINTER_DOWN);
    });
  }

  protected syncPartyMembersForScene() {
    const gs = useGameStore.getState();
    const members = Object.values(gs.guildMembers).filter(
      (m) => m.sceneId === this.sceneId && m.hp > 0
    );

    const shouldIds = new Set(members.map((m) => m.id));

    // remove units that no longer belong here
    for (const [memberId, unit] of this.partyUnits) {
      if (!shouldIds.has(memberId)) {
        this.units.remove(unit);
        this.partyUnits.delete(memberId);
      }
    }

    // add missing members
    const { x, y, cols, spacing } = this.getPartySpawn();
    let i = 0;

    for (const m of members) {
      if (this.partyUnits.has(m.id)) continue;

      const def = UNIT_DEFS[m.unitDefId];
      if (!def) continue;

      const ox = (i % cols) * spacing;
      const oy = Math.floor(i / cols) * spacing;

      const controller =
        m.role === "worker" ? new WorkerController() : new AdventurerController();

      const unit = this.units.add(def, x + ox, y + oy, controller);
      unit.memberId = m.id;

      this.partyUnits.set(m.id, unit);
      i++;
    }

    this.units.assignIds();
  }

  protected enableSelection() {
    this.events.on("unit:selected", (memberId: string) => {
      useGameStore.getState().setSelectedMemberId(memberId);
      this.highlightMember(memberId);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off("unit:selected");
    });
  }

  protected highlightMember(memberId: string) {
    // clear old highlight
    for (const [, u] of this.partyUnits) {
      for (const spr of Object.values(u.layers)) spr.clearTint();
    }

    const unit = this.partyUnits.get(memberId);
    if (!unit) return;

    for (const spr of Object.values(unit.layers)) {
      spr.setTint(0xffff00);
    }
  }
}
