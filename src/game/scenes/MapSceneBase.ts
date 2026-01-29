import Phaser from "phaser";
import type { PlacedTile, SceneMap } from "../phaser/scenes/maps/scenes";
import { TILESETS, makeKey, makeUrl } from "../assets/tilesets";

export abstract class MapSceneBase extends Phaser.Scene {
  protected currentMap?: SceneMap;

  protected groundLayer?: Phaser.GameObjects.Container;
  protected objectLayer?: Phaser.GameObjects.Container;

  /** Call in preload() of subclasses if they use tilesets */
  protected preloadTilesets() {
    for (const ts of TILESETS) {
      for (let x = 0; x <= ts.xMax; x++) {
        for (let y = 0; y <= ts.yMax; y++) {
          const key = makeKey(ts.id, x, y);
          const url = makeUrl(ts.baseUrl, x, y);

          if (this.textures.exists(key)) continue;
          this.load.image(key, url);
        }
      }
    }
  }

  /** Generic: applies pixel-art crisp filtering for everything loaded */
  protected applyNearestFilters() {
    for (const key of this.textures.getTextureKeys()) {
      if (key === "__DEFAULT") continue;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  /** Use actual map dimensions, not constants */
  protected fitCameraToMap() {
    const cam = this.cameras.main;
    const map = this.currentMap;
    if (!map) return;

    const mapPxW = map.width * map.tileSize;
    const mapPxH = map.height * map.tileSize;

    const viewW = cam.width;
    const viewH = cam.height;

    const zoomToFit = Math.min(viewW / mapPxW, viewH / mapPxH);
    cam.setZoom(zoomToFit);

    cam.setBounds(0, 0, mapPxW, mapPxH);
    cam.setScroll(0, 0);

    const canvas = this.game.canvas as HTMLCanvasElement | undefined;
    if (canvas) canvas.dataset.zoom = String(zoomToFit);
  }

  public onViewportResized() {
    this.fitCameraToMap();
  }

  public setSceneMap(map: SceneMap) {
    this.currentMap = map;

    // This prevents “zombie containers” after scene stop/start swaps.
    if (this.groundLayer) {
      this.groundLayer.destroy(true);
      this.groundLayer = undefined;
    }
    if (this.objectLayer) {
      this.objectLayer.destroy(true);
      this.objectLayer = undefined;
    }

    this.renderFromMap();
    this.fitCameraToMap();
  }

  public placeTile(
    tx: number,
    ty: number,
    placed: PlacedTile | null,
    layer: "ground" | "objects"
  ) {
    if (!this.currentMap) return;

    if (tx < 0 || ty < 0 || tx >= this.currentMap.width || ty >= this.currentMap.height)
      return;

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

  protected ensureLayers() {
    if (!this.groundLayer) this.groundLayer = this.add.container(0, 0);
    if (!this.objectLayer) this.objectLayer = this.add.container(0, 0);

    this.groundLayer.setDepth(0);
    this.objectLayer.setDepth(10);
  }

  protected renderFromMap() {
    if (!this.currentMap) return;

    this.ensureLayers();

    // Clear existing tiles
    this.groundLayer!.removeAll(true);
    this.objectLayer!.removeAll(true);

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

          // Scale image to fit cell (handles “small sprites”)
          const tex = this.textures.get(cell.key);
          const src = tex.getSourceImage() as HTMLImageElement | undefined;
          if (src?.width && src?.height) {
            const scaleX = TILE / src.width;
            const scaleY = TILE / src.height;
            img.setScale(Math.min(scaleX, scaleY));
          }

          img.setAngle(cell.rotation);
          container.add(img);
        }
      }
    };

    drawLayer(this.groundLayer!, this.currentMap.ground);
    drawLayer(this.objectLayer!, this.currentMap.objects);
  }
}
