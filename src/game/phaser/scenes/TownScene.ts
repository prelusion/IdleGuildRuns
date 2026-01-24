import Phaser from "phaser";

import { TILESETS, makeKey, makeUrl } from "../../assets/tilesets";
import town from "./maps/town.json";
import type {PlacedTile, SceneMap} from "./maps/scenes.ts";
import {MOBS} from "../mobs/mobDefs";

import { preloadMob, createMobAnimations } from "../mobs/mobLoader";
import {MobEntity} from "../entities/mobEntity.ts";
import {WanderAggroAI} from "../ai/mobAI.ts";
import {TypeMobs} from "../mobs/mobTypes.ts";

export type BuildingId = "nether_1";

export type TownSceneCallbacks = {
  onBuildingClicked?: (id: BuildingId) => void;
};

export class TownScene extends Phaser.Scene {
  private readonly TILE = 128;
  private readonly MAP_W = 40;
  private readonly MAP_H = 40;

  private groundLayer?: Phaser.GameObjects.Container;
  private objectLayer?: Phaser.GameObjects.Container;

  private currentMap?: SceneMap;


  private fitCameraToMap() {
    const cam = this.cameras.main;

    const mapPxW = this.MAP_W * this.TILE;
    const mapPxH = this.MAP_H * this.TILE;

    // The canvas size (your square viewport)
    const viewW = cam.width;
    const viewH = cam.height;

    // Zoom so the whole map fits, or clamp to a max zoom-in (1 = native pixels)
    const zoomToFit = Math.min(viewW / mapPxW, viewH / mapPxH);

    // For pixel art, you often want discrete zoom steps; but start simple:

    cam.setZoom(zoomToFit);
    cam.setBounds(0, 0, mapPxW, mapPxH);

// Anchor the view so the map starts at the top instead of centered
    cam.setScroll(0, 0);

    const canvas = this.game.canvas as HTMLCanvasElement | undefined;
    if (canvas) canvas.dataset.zoom = String(zoomToFit);

  }


  constructor() {
    super("TownScene");
  }

  // public setCallbacks(cb: TownSceneCallbacks) {
  //   this.onBuildingClicked = cb.onBuildingClicked;
  // }

  preload() {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error("FILE_LOAD_ERROR:", file.key, file.src);
    });

    preloadMob(this, MOBS[TypeMobs.GHOST + "1"]);
    preloadMob(this, MOBS[TypeMobs.BEHOLDER + "1"]);
    preloadMob(this, MOBS[TypeMobs.LIZARDMAN + "1"]);
    preloadMob(this, MOBS[TypeMobs.SLIME + "5"]);
    preloadMob(this, MOBS[TypeMobs.SLIME + "4"]);
    preloadMob(this, MOBS[TypeMobs.SLIME + "6"]);

    for (const ts of TILESETS) {
      for (let x = 0; x <= ts.xMax; x++) {
        for (let y = 0; y <= ts.yMax; y++) {
          const key = makeKey(ts.id, x, y);
          const url = makeUrl(ts.baseUrl, x, y);
          this.load.image(key, url);
        }
      }
    }
  }


  public setSceneMap(map: SceneMap) {
    this.currentMap = map;
    this.renderFromMap();
    this.fitCameraToMap();
  }

  public placeTile(tx: number, ty: number, placed: PlacedTile | null, layer: "ground" | "objects") {
    if (!this.currentMap) return;

    if (tx < 0 || ty < 0 || tx >= this.currentMap.width || ty >= this.currentMap.height) return;

    const next: SceneMap = {
      ...this.currentMap,
      ground: this.currentMap.ground.map((r) => r.slice()),
      objects: this.currentMap.objects.map((r) => r.slice()),
    };

    if (layer === "ground") next.ground[ty][tx] = placed;
    else next.objects[ty][tx] = placed;

    this.currentMap = next;
    this.renderFromMap();
  }

  private renderFromMap() {
    if (!this.currentMap) return;

    // Create layers once
    if (!this.groundLayer) this.groundLayer = this.add.container(0, 0);
    if (!this.objectLayer) this.objectLayer = this.add.container(0, 0);

    this.groundLayer.removeAll(true);
    this.objectLayer.removeAll(true);

    const TILE = this.currentMap.tileSize;

    const drawLayer = (
      container: Phaser.GameObjects.Container,
      layer: (PlacedTile | null)[][]
    ) => {
      for (let y = 0; y < layer.length; y++) {
        for (let x = 0; x < layer[y].length; x++) {
          const cell = layer[y][x];
          if (!cell) continue;

          const cx = x * TILE + TILE / 2;
          const cy = y * TILE + TILE / 2;

          const img = this.add.image(cx, cy, cell.key).setOrigin(0.5);

          // Scale image to fit grid cell
          const tex = this.textures.get(cell.key);
          const frame = tex.getSourceImage() as HTMLImageElement;

          const scaleX = this.currentMap!.tileSize / frame.width;
          const scaleY = this.currentMap!.tileSize / frame.height;

          // Use uniform scale so pixels don’t distort
          const scale = Math.min(scaleX, scaleY);
          img.setScale(scale);

          img.setAngle(cell.rotation);
          container.add(img);
        }
      }
    };

    drawLayer(this.groundLayer, this.currentMap.ground);
    drawLayer(this.objectLayer, this.currentMap.objects);

    // Ensure objects render on top
    this.groundLayer.setDepth(0);
    this.objectLayer.setDepth(10);
  }


  public onViewportResized() {
    this.fitCameraToMap();
  }


  create() {
    for (const key of this.textures.getTextureKeys()) {
      if (key === "__DEFAULT") continue;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    createMobAnimations(this, MOBS[TypeMobs.GHOST + "1"]);
    createMobAnimations(this, MOBS[TypeMobs.BEHOLDER + "1"]);
    createMobAnimations(this, MOBS[TypeMobs.LIZARDMAN + "1"]);
    createMobAnimations(this, MOBS[TypeMobs.SLIME + "5"]);
    createMobAnimations(this, MOBS[TypeMobs.SLIME + "4"]);
    createMobAnimations(this, MOBS[TypeMobs.SLIME + "6"]);


    const GHOST1 = new MobEntity(this, MOBS[TypeMobs.GHOST + "1"], 600, 600);
    const BEHOLDER1 = new MobEntity(this, MOBS[TypeMobs.BEHOLDER + "1"], 800, 800);
    const LIZARDMAN1 = new MobEntity(this, MOBS[TypeMobs.LIZARDMAN + "1"], 1000, 1000);
    const SLIME5 = new MobEntity(this, MOBS[TypeMobs.SLIME + "5"], 400, 400);
    const SLIME4 = new MobEntity(this, MOBS[TypeMobs.SLIME + "4"], 200, 200);
    const SLIME6 = new MobEntity(this, MOBS[TypeMobs.SLIME + "6"], 1200, 1200);

    const mobControllers  = [
      { mob: GHOST1, ai: new WanderAggroAI(this.time.now) },
      { mob: BEHOLDER1, ai: new WanderAggroAI(this.time.now) },
      { mob: LIZARDMAN1, ai: new WanderAggroAI(this.time.now) },
      { mob: SLIME5, ai: new WanderAggroAI(this.time.now) },
      { mob: SLIME4, ai: new WanderAggroAI(this.time.now) },
      { mob: SLIME6, ai: new WanderAggroAI(this.time.now) },
    ];

    const playerCollider = { x: 2500, y: 2500, radius: 128 };

    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      const nowMs = this.time.now;

      for (const c of mobControllers) {
        // neighbors = all other mobs (simple O(n^2), fine for dozens)
        const neighbors = mobControllers
          .filter((o) => o.mob !== c.mob)
          .map((o) => ({ x: o.mob.x, y: o.mob.y, radius: o.mob.radius }));

        c.ai.update(c.mob, {
          nowMs,
          dtMs: dt,
          playerPos: playerCollider, // or null if no player
          neighbors,
        });
      }
    });



    this.groundLayer = this.add.container(0, 0);
    this.objectLayer = this.add.container(0, 0);
    this.groundLayer.setDepth(0);
    this.objectLayer.setDepth(10);


    this.setSceneMap(town as SceneMap);

    this.fitCameraToMap();
  }
}

