import Phaser from "phaser";
import type { PlacedTile, SceneMap } from "../phaser/scenes/maps/scenes";
import { TILESETS, makeKey, makeUrl } from "../assets/tilesets";
import { mapsLibraryUrlForKey } from "../assets/mapsLibraryManifest";

export abstract class MapSceneBase extends Phaser.Scene {
  protected currentMap?: SceneMap;

  protected groundLayer?: Phaser.GameObjects.Container;
  protected objectLayer?: Phaser.GameObjects.Container;

  // -----------------------------
  // Legacy tiles (/assets/tiles/*)
  // -----------------------------
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

  // -----------------------------
  // Maps library (/assets/maps_library/*)
  // -----------------------------

  /** Preload ONLY maps_library sprites referenced by a map json */
  protected preloadMapsLibraryForMap(map: SceneMap) {
    const keys = new Set<string>();

    const collect = (layer: (PlacedTile | null)[][]) => {
      for (const row of layer) {
        for (const cell of row) {
          if (!cell?.key) continue;
          // heuristic: maps_library keys contain "/" (e.g. "autumn/props/misc/road_5")
          if (cell.key.includes("/")) keys.add(cell.key);
        }
      }
    };

    collect(map.ground);
    collect(map.objects);

    for (const key of keys) {
      if (this.textures.exists(key)) continue;

      const url = mapsLibraryUrlForKey(key);
      if (!url) {
        console.warn("[maps_library] Missing in manifest:", key);
        continue;
      }

      this.load.image(key, url);
    }
  }

  /**
   * Lazy-load a single maps_library texture if missing.
   * This is what makes painting new sprites work without preloading everything.
   */
  protected ensureMapsLibraryTexture(key: string) {
    if (!key.includes("/")) return; // not maps_library
    if (this.textures.exists(key)) return;

    const url = mapsLibraryUrlForKey(key);
    if (!url) {
      console.warn("[maps_library] No URL for key:", key);
      return;
    }

    this.load.image(key, url);

    // If loader isn't already running, start it and rerender once complete.
    if (!this.load.isLoading()) {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.applyNearestFilters();
        this.renderFromMap();
      });
      this.load.start();
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

    // Prevent “zombie containers”
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

    // ✅ If this tile is maps_library, lazy-load it if needed
    if (placed?.key) this.ensureMapsLibraryTexture(placed.key);

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

          // ✅ Try to lazy-load maps_library sprites
          this.ensureMapsLibraryTexture(cell.key);

          // If not loaded yet, skip for now (it will appear after loader COMPLETE rerender)
          if (!this.textures.exists(cell.key)) continue;

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
