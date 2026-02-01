import Phaser from "phaser";
import type { PlacedTile, SceneMap } from "../phaser/scenes/maps/scenes";
import { MAPS_LIBRARY_MANIFEST } from "../assets/mapsLibraryManifest";

export abstract class MapSceneBase extends Phaser.Scene {
  protected currentMap?: SceneMap;

  protected groundLayer?: Phaser.GameObjects.Container;
  protected objectLayer?: Phaser.GameObjects.Container;
  protected freeLayer?: Phaser.GameObjects.Container;

  protected preloadMapsLibrary() {
    for (const s of MAPS_LIBRARY_MANIFEST.sprites) {
      if (this.textures.exists(s.key)) continue;
      this.load.image(s.key, s.url);
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

    // Phaser canvas is an HTMLCanvasElement
    const canvas = this.game.canvas;
    canvas.dataset.zoom = String(zoomToFit);
  }

  public onViewportResized() {
    this.fitCameraToMap();
  }

  public setSceneMap(map: SceneMap) {
    this.currentMap = map;

    // destroy old containers
    this.groundLayer?.destroy(true);
    this.objectLayer?.destroy(true);
    this.freeLayer?.destroy(true);

    this.groundLayer = undefined;
    this.objectLayer = undefined;
    this.freeLayer = undefined;

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

    if (tx < 0 || ty < 0 || tx >= this.currentMap.width || ty >= this.currentMap.height) {
      return;
    }

    const next: SceneMap = {
      ...this.currentMap,
      ground: this.currentMap.ground.map((r) => r.slice()),
      objects: this.currentMap.objects.map((r) => r.slice()),
      objectsFree: (this.currentMap.objectsFree ?? []).slice(),
    };

    if (layer === "ground") next.ground[ty][tx] = placed;
    else next.objects[ty][tx] = placed;

    this.currentMap = next;
    this.renderFromMap();
  }

  protected ensureLayers() {
    if (!this.groundLayer) this.groundLayer = this.add.container(0, 0);
    if (!this.objectLayer) this.objectLayer = this.add.container(0, 0);
    if (!this.freeLayer) this.freeLayer = this.add.container(0, 0);

    this.groundLayer.setDepth(0);
    this.objectLayer.setDepth(10);
    this.freeLayer.setDepth(20); // free objects are above grid layers
  }

  protected renderFromMap() {
    if (!this.currentMap) return;

    this.ensureLayers();

    this.groundLayer!.removeAll(true);
    this.objectLayer!.removeAll(true);
    this.freeLayer!.removeAll(true);

    const TILE = this.currentMap.tileSize;

    const drawGridLayer = (
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

          const tex = this.textures.get(cell.key);
          const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;

          // Scale to tile size if we can read source dimensions
          const w = (src as HTMLImageElement | HTMLCanvasElement | undefined)?.width;
          const h = (src as HTMLImageElement | HTMLCanvasElement | undefined)?.height;

          if (w && h) {
            const scaleX = TILE / w;
            const scaleY = TILE / h;
            img.setScale(Math.min(scaleX, scaleY));
          }

          img.setAngle(cell.rotation);
          container.add(img);
        }
      }
    };

    drawGridLayer(this.groundLayer!, this.currentMap.ground);
    drawGridLayer(this.objectLayer!, this.currentMap.objects);

    // free objects (world positioned)
    const free = this.currentMap.objectsFree ?? [];
    for (const o of free) {
      const img = this.add.image(o.x, o.y, o.key).setOrigin(0.5, 1); // bottom anchored
      img.setAngle(o.rotation);

      if (o.scale) img.setScale(o.scale.x, o.scale.y);

      img.setDepth(o.z ?? o.y);

      this.freeLayer!.add(img);
    }
  }
}
