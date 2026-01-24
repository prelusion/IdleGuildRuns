import Phaser from "phaser";
import type { SceneMap, PlacedTile } from "../../../state/store";
import { TILESETS, makeKey, makeUrl } from "../../assets/tilesets";
import town from "./maps/town.json";

export type BuildingId = "nether_1";

export type HellCallbacks = {
  onBuildingClicked?: (id: BuildingId) => void;
};

export class Hell extends Phaser.Scene {
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
    super("Hell");
  }

  // public setCallbacks(cb: HellCallbacks) {
  //   this.onBuildingClicked = cb.onBuildingClicked;
  // }

  preload() {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error("FILE_LOAD_ERROR:", file.key, file.src);
    });

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
    // Apply NEAREST filter to all loaded textures (crisp)
    for (const key of this.textures.getTextureKeys()) {
      if (key === "__DEFAULT") continue;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.groundLayer = this.add.container(0, 0);
    this.objectLayer = this.add.container(0, 0);
    this.groundLayer.setDepth(0);
    this.objectLayer.setDepth(10);


    this.setSceneMap(town as SceneMap);

    this.fitCameraToMap();
  }
}

