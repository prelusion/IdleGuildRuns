// tools/generateMaps.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "pngjs";

/**
 * Procedural map generator for maps_library packs.
 *
 * Requires:
 *   npm i -D pngjs
 *
 * Run:
 *   node tools/generateMaps.mjs --count 10 --pack winter-medieval --size 40 --tileSize 128
 *
 * Output maps:
 *   src/game/phaser/scenes/maps/generated/<pack>_<index>.json
 *
 * Generated composite tiles (to eliminate black edge boxes) (RIVERS ONLY now):
 *   public/assets/maps_library/<pack>/_generated/river/<hash>.png
 *
 * And it auto-updates:
 *   public/assets/maps_library.manifest.json
 */

const PROJECT_ROOT = process.cwd();
const PUBLIC_ROOT = path.resolve(PROJECT_ROOT, "public");
const LIB_ROOT = path.resolve(PUBLIC_ROOT, "assets/maps_library");
const MANIFEST_PATH = path.resolve(PUBLIC_ROOT, "assets/maps_library.manifest.json");
const OUT_DIR = path.resolve(PROJECT_ROOT, "src/game/phaser/scenes/maps/generated");

const argv = parseArgs(process.argv.slice(2));

const CFG = {
    count: Number(argv.count ?? 5),
    pack: String(argv.pack ?? "winter-medieval"),
    size: Number(argv.size ?? 40),
    tileSize: Number(argv.tileSize ?? 128),
    seed: String(argv.seed ?? ""),

    road: {
        enabled: argv.road === "0" ? false : true,
        wiggle: Number(argv.roadWiggle ?? 0.55),
        minLen: Number(argv.roadMinLen ?? 18),
        thickness: Number(argv.roadThickness ?? 2), // 2 looks good
    },

    river: {
        enabled: argv.river === "1" ? true : false,
        count: Number(argv.riverCount ?? 1),
        wiggle: Number(argv.riverWiggle ?? 0.6),
        minLen: Number(argv.riverMinLen ?? 22),
        thickness: Number(argv.riverThickness ?? 1),
    },

    // Black-edge cleanup settings (USED FOR RIVERS ONLY now)
    cleanup: {
        floodTolerance: Number(argv.floodTolerance ?? 34),
        minKeepAlpha: Number(argv.minKeepAlpha ?? 10),
    },

    objects: {
        enabled: argv.objects === "0" ? false : true,
        treesPer100: Number(argv.treesPer100 ?? 1.5),
        stonesPer100: Number(argv.stonesPer100 ?? 2),
        greeneryPer100: Number(argv.greeneryPer100 ?? 1),
        decorPer100: Number(argv.decorPer100 ?? 1.5),
        buildingsPer100: Number(argv.buildingsPer100 ?? 0.2),
    },
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

async function main() {
    assertExists(MANIFEST_PATH, "Missing maps library manifest. Run your buildMapsLibraryManifest first.");

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    const pack = CFG.pack;

    if (!manifest.packs?.[pack]) {
        throw new Error(
            `Pack "${pack}" not found in manifest. Available: ${Object.keys(manifest.packs ?? {}).join(", ")}`
        );
    }

    ensureDir(OUT_DIR);

    // Collect tiles
    const landCandidates = findKeysByHints(manifest, pack, "tile", ["terrain/land", "/land/"]);
    const roadCandidates = findKeysByHints(manifest, pack, "tile", ["terrain/road", "/road/"]);
    const riverCandidates = findKeysByHints(manifest, pack, "tile", ["terrain/river", "/river/"]);

    if (landCandidates.length === 0) {
        throw new Error(`No land tiles found for pack "${pack}". Ensure it has terrain/land.`);
    }

    const baseLandKey = pickBaseLand(landCandidates);

    // NOTE: roads no longer need connectivity or composite generation.
    // We still build river connectivity for nicer rivers.
    const riverLib = await buildConnectivityLibrary(manifest, pack, riverCandidates);

    // Object pools
    const objectPools = buildObjectPools(manifest, pack);

    let manifestDirty = false;

    for (let i = 0; i < CFG.count; i++) {
        const seed = CFG.seed ? `${CFG.seed}_${i}` : `${pack}_${Date.now()}_${i}`;
        const rng = makeRng(seed);

        const gen = await generateOne({
            manifest,
            pack,
            size: CFG.size,
            tileSize: CFG.tileSize,
            baseLandKey,
            roadCandidates, // <-- pass candidates so we can pick the first road tile
            riverLib,
            rng,
            objectPools,
        });

        manifestDirty = manifestDirty || gen.manifestDirty;

        const outPath = path.join(OUT_DIR, `${pack}_${i + 1}.json`);
        fs.writeFileSync(outPath, JSON.stringify(gen.map, null, 2), "utf-8");
        console.log(`Wrote: ${path.relative(PROJECT_ROOT, outPath)}`);
    }

    // Write updated manifest if we created any RIVER composite tiles
    if (manifestDirty) {
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
        console.log(`Updated manifest: ${path.relative(PROJECT_ROOT, MANIFEST_PATH)}`);
    }
}

async function generateOne({
                               manifest,
                               pack,
                               size,
                               tileSize,
                               baseLandKey,
                               roadCandidates,
                               riverLib,
                               rng,
                               objectPools,
                           }) {
    const width = size;
    const height = size;

    // Base ground: land everywhere
    const ground = Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ({ key: baseLandKey, rotation: 0 }))
    );

    // Keep grid objects empty; we’ll use objectsFree for props
    const objectsGrid = Array.from({ length: height }, () => Array.from({ length: width }, () => null));

    const blocked = Array.from({ length: height }, () => Array.from({ length: width }, () => false));

    let manifestDirty = false;

    // ROAD (CHANGED): no generated composite tiles, always stamp the FIRST road tile
    if (CFG.road.enabled && roadCandidates && roadCandidates.length) {
        const ROAD_KEY = roadCandidates[0];

        const pathCells = carvePath({
            width,
            height,
            rng,
            minLen: CFG.road.minLen,
            wiggle: CFG.road.wiggle,
        });

        const thick = expandPathThickness(pathCells, width, height, CFG.road.thickness);

        for (const { x, y } of thick) {
            ground[y][x] = { key: ROAD_KEY, rotation: 0 };
            blocked[y][x] = true;
        }
    }

    // RIVER (optional) - still uses composites to avoid edge boxes
    if (CFG.river.enabled && riverLib.keys.length) {
        const rivers = clampInt(CFG.river.count, 1, 3);
        for (let r = 0; r < rivers; r++) {
            const pathCells = carvePath({
                width,
                height,
                rng,
                minLen: CFG.river.minLen,
                wiggle: CFG.river.wiggle,
                avoid: blocked,
            });

            const thick = expandPathThickness(pathCells, width, height, CFG.river.thickness);
            const set = new Set(thick.map((p) => `${p.x},${p.y}`));

            for (const { x, y } of thick) {
                const n = set.has(`${x},${y - 1}`) ? 1 : 0;
                const e = set.has(`${x + 1},${y}`) ? 1 : 0;
                const s = set.has(`${x},${y + 1}`) ? 1 : 0;
                const w = set.has(`${x - 1},${y}`) ? 1 : 0;
                const mask = connMask({ n, e, s, w });

                const pick = pickTileForMask(riverLib, mask, rng);
                if (!pick) continue;

                const compositeKey = await ensureCompositeTile({
                    manifest,
                    pack,
                    feature: "river",
                    baseLandKey,
                    overlayKey: pick.key,
                    overlayRotation: pick.rotation,
                });

                if (compositeKey.didWrite) manifestDirty = true;

                ground[y][x] = { key: compositeKey.key, rotation: 0 };
                blocked[y][x] = true;
            }
        }
    }

    // OBJECTS (free-positioned)
    const objectsFree = [];
    if (CFG.objects.enabled) {
        const area = width * height;
        const toCount = (per100) => Math.max(0, Math.round((per100 / 100) * area));

        const nTrees = toCount(CFG.objects.treesPer100);
        const nStones = toCount(CFG.objects.stonesPer100);
        const nGreen = toCount(CFG.objects.greeneryPer100);
        const nDecor = toCount(CFG.objects.decorPer100);
        const nBuild = toCount(CFG.objects.buildingsPer100);

        const treeCells = new Set();

        const markBlockedRadius = (cx, cy, r) => {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const x = cx + dx;
                    const y = cy + dy;
                    if (!inBounds(x, y, width, height)) continue;
                    blocked[y][x] = true;
                }
            }
        };

        const placeMany = (pool, count, opts = {}) => {
            const {
                scaleJitter = 0.08,
                avoidTreeRadius = 0,
                treeReserveRadius = 0,
                isTree = false,
            } = opts;

            for (let i = 0; i < count; i++) {
                const cell = randomFreeCell(width, height, blocked, rng);
                if (!cell) return;

                const { x, y } = cell;

                // Avoid placing near trees (for non-tree objects)
                if (!isTree && avoidTreeRadius > 0) {
                    let tooClose = false;
                    for (let dy = -avoidTreeRadius; dy <= avoidTreeRadius && !tooClose; dy++) {
                        for (let dx = -avoidTreeRadius; dx <= avoidTreeRadius; dx++) {
                            const k = `${x + dx},${y + dy}`;
                            if (treeCells.has(k)) {
                                tooClose = true;
                                break;
                            }
                        }
                    }
                    if (tooClose) continue;
                }

                const meta = pickWeighted(pool, rng);
                if (!meta) return;

                const wx = x * tileSize + tileSize * (0.2 + rng() * 0.6);
                const wy = y * tileSize + tileSize * (0.65 + rng() * 0.25);

                const baseScale = meta.scale ?? { x: 1.2, y: 1.2 };
                const j = 1 + (rng() * 2 - 1) * scaleJitter;

                // Depth hint: props slightly behind trees
                const depth = isTree ? wy + tileSize * 0.75 : wy;

                objectsFree.push({
                    key: meta.key,
                    x: Math.round(wx),
                    y: Math.round(wy),
                    z: Math.round(depth),
                    rotation: 0,
                    scale: {
                        x: +(baseScale.x * j).toFixed(3),
                        y: +(baseScale.y * j).toFixed(3),
                    },
                });
                if (isTree) {
                    treeCells.add(`${x},${y}`);
                    if (treeReserveRadius > 0) markBlockedRadius(x, y, treeReserveRadius);
                    else blocked[y][x] = true;
                } else {
                    if (rng() < 0.2) blocked[y][x] = true;
                }
            }
        };

        placeMany(objectPools.trees, nTrees, { isTree: true, scaleJitter: 0.12, treeReserveRadius: 3 });
        placeMany(objectPools.stones, nStones, { scaleJitter: 0.10, avoidTreeRadius: 2 });
        placeMany(objectPools.greenery, nGreen, { scaleJitter: 0.10, avoidTreeRadius: 2 });
        placeMany(objectPools.decor, nDecor, { scaleJitter: 0.08, avoidTreeRadius: 2 });
        placeMany(objectPools.buildings, nBuild, { scaleJitter: 0.06, avoidTreeRadius: 4 });
    }

    return {
        manifestDirty,
        map: {
            scene: "GeneratedScene",
            tileSize,
            width,
            height,
            ground,
            objects: objectsGrid,
            objectsFree,
            meta: {
                pack,
                baseLandKey,
                generatedAt: new Date().toISOString(),
            },
        },
    };
}

/**
 * Creates a cleaned+composited tile and ensures it exists in:
 *   public/assets/maps_library/<pack>/_generated/<feature>/<hash>.png
 *
 * And ensures it exists in maps_library.manifest.json under kind "tile".
 *
 * NOTE: Roads no longer call this; rivers still can.
 */
async function ensureCompositeTile({ manifest, pack, feature, baseLandKey, overlayKey, overlayRotation }) {
    const baseSprite = manifest.sprites.find((s) => s.key === baseLandKey);
    const overlaySprite = manifest.sprites.find((s) => s.key === overlayKey);

    if (!baseSprite) throw new Error(`Missing baseLand sprite: ${baseLandKey}`);
    if (!overlaySprite) throw new Error(`Missing overlay sprite: ${overlayKey}`);

    const baseAbs = path.resolve(PUBLIC_ROOT, baseSprite.url.replace(/^\//, ""));
    const overlayAbs = path.resolve(PUBLIC_ROOT, overlaySprite.url.replace(/^\//, ""));

    assertExists(baseAbs, `Missing file: ${baseAbs}`);
    assertExists(overlayAbs, `Missing file: ${overlayAbs}`);

    const hash = crypto
        .createHash("sha1")
        .update(
            JSON.stringify({
                feature,
                baseLandKey,
                overlayKey,
                overlayRotation,
                floodTolerance: CFG.cleanup.floodTolerance,
            })
        )
        .digest("hex")
        .slice(0, 16);

    const relOut = `${pack}/_generated/${feature}/${hash}.png`;
    const absOut = path.resolve(LIB_ROOT, relOut);
    ensureDir(path.dirname(absOut));

    const newKey = `${pack}/_generated/${feature}/${hash}`;
    const newUrl = `/assets/maps_library/${relOut.replaceAll("\\", "/")}`;

    // If already in manifest and file exists, just reuse
    const existsInManifest = manifest.sprites.some((s) => s.key === newKey);
    if (existsInManifest && fs.existsSync(absOut)) {
        return { key: newKey, didWrite: false };
    }

    // Build composite PNG
    const basePng = readPng(baseAbs);
    const overlayPngRaw = readPng(overlayAbs);
    const overlayPngRot = rotatePng(overlayPngRaw, overlayRotation);

    // Remove corner background (often black) so it becomes transparent
    const overlayClean = floodClearCorners(overlayPngRot, CFG.cleanup.floodTolerance);

    // Alpha composite: overlay on top of base
    const composited = alphaComposite(basePng, overlayClean);

    fs.writeFileSync(absOut, PNG.sync.write(composited));

    // Add to manifest
    manifest.sprites.push({
        key: newKey,
        url: newUrl,
        pack,
        category: "generated",
        subcategory: feature,
        file: `${hash}.png`,
        kind: "tile",
    });

    // Add to packs index
    manifest.packs ??= {};
    manifest.packs[pack] ??= { tile: {}, object: {} };
    manifest.packs[pack].tile ??= {};
    manifest.packs[pack].tile.generated ??= {};
    manifest.packs[pack].tile.generated[feature] ??= [];
    manifest.packs[pack].tile.generated[feature].push(newKey);
    manifest.packs[pack].tile.generated[feature].sort();

    // Keep stable ordering
    manifest.sprites.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

    return { key: newKey, didWrite: true };
}

// ---------- PNG helpers ----------
function readPng(absPath) {
    const buf = fs.readFileSync(absPath);
    return PNG.sync.read(buf);
}

function rotatePng(png, deg) {
    const d = ((deg % 360) + 360) % 360;
    if (d === 0) return png;

    const src = png;
    let dst;

    if (d === 180) {
        dst = new PNG({ width: src.width, height: src.height });
        for (let y = 0; y < src.height; y++) {
            for (let x = 0; x < src.width; x++) {
                const si = (src.width * y + x) * 4;
                const dx = src.width - 1 - x;
                const dy = src.height - 1 - y;
                const di = (dst.width * dy + dx) * 4;
                dst.data[di] = src.data[si];
                dst.data[di + 1] = src.data[si + 1];
                dst.data[di + 2] = src.data[si + 2];
                dst.data[di + 3] = src.data[si + 3];
            }
        }
        return dst;
    }

    if (d === 90 || d === 270) {
        dst = new PNG({ width: src.height, height: src.width });
        for (let y = 0; y < src.height; y++) {
            for (let x = 0; x < src.width; x++) {
                const si = (src.width * y + x) * 4;

                let dx, dy;
                if (d === 90) {
                    dx = src.height - 1 - y;
                    dy = x;
                } else {
                    dx = y;
                    dy = src.width - 1 - x;
                }

                const di = (dst.width * dy + dx) * 4;
                dst.data[di] = src.data[si];
                dst.data[di + 1] = src.data[si + 1];
                dst.data[di + 2] = src.data[si + 2];
                dst.data[di + 3] = src.data[si + 3];
            }
        }
        return dst;
    }

    return png;
}

function floodClearCorners(png, tolerance) {
    const out = clonePng(png);
    const w = out.width;
    const h = out.height;

    const corners = [
        { x: 0, y: 0 },
        { x: w - 1, y: 0 },
        { x: 0, y: h - 1 },
        { x: w - 1, y: h - 1 },
    ];

    for (const c of corners) {
        const base = getRGBA(out, c.x, c.y);
        floodFillClear(out, c.x, c.y, base, tolerance);
    }

    return out;
}

function floodFillClear(png, sx, sy, baseRGBA, tol) {
    const w = png.width;
    const h = png.height;
    const stack = [{ x: sx, y: sy }];
    const visited = new Uint8Array(w * h);

    while (stack.length) {
        const { x, y } = stack.pop();
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const idx = y * w + x;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const cur = getRGBA(png, x, y);

        if (cur.a > CFG.cleanup.minKeepAlpha && colorDist(cur, baseRGBA) <= tol) {
            setRGBA(png, x, y, { r: cur.r, g: cur.g, b: cur.b, a: 0 });

            stack.push({ x: x + 1, y });
            stack.push({ x: x - 1, y });
            stack.push({ x, y: y + 1 });
            stack.push({ x, y: y - 1 });
        }
    }
}

function alphaComposite(base, overlay) {
    const out = clonePng(base);
    const w = Math.min(base.width, overlay.width);
    const h = Math.min(base.height, overlay.height);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const b = getRGBA(out, x, y);
            const o = getRGBA(overlay, x, y);

            const oa = o.a / 255;
            if (oa <= 0) continue;

            const ba = b.a / 255;

            const outA = oa + ba * (1 - oa);
            const outR = (o.r * oa + b.r * ba * (1 - oa)) / (outA || 1);
            const outG = (o.g * oa + b.g * ba * (1 - oa)) / (outA || 1);
            const outB = (o.b * oa + b.b * ba * (1 - oa)) / (outA || 1);

            setRGBA(out, x, y, {
                r: clampByte(outR),
                g: clampByte(outG),
                b: clampByte(outB),
                a: clampByte(outA * 255),
            });
        }
    }

    return out;
}

function clonePng(png) {
    const out = new PNG({ width: png.width, height: png.height });
    png.data.copy(out.data);
    return out;
}

function getRGBA(png, x, y) {
    const i = (png.width * y + x) * 4;
    return { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2], a: png.data[i + 3] };
}

function setRGBA(png, x, y, c) {
    const i = (png.width * y + x) * 4;
    png.data[i] = c.r;
    png.data[i + 1] = c.g;
    png.data[i + 2] = c.b;
    png.data[i + 3] = c.a;
}

function colorDist(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function clampByte(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
}

// ---------- Connectivity library (still used for rivers) ----------
async function buildConnectivityLibrary(manifest, pack, keys) {
    const byMask = new Map();
    const items = [];

    for (const key of keys) {
        const sprite = manifest.sprites.find((s) => s.key === key);
        if (!sprite) continue;

        const abs = path.resolve(PUBLIC_ROOT, sprite.url.replace(/^\//, ""));
        if (!fs.existsSync(abs)) continue;

        const png = readPng(abs);
        const m0 = edgeMaskFromAlpha(png);

        registerMask(byMask, m0, { key, rotation: 0 });
        registerMask(byMask, rotateMask(m0, 90), { key, rotation: 90 });
        registerMask(byMask, rotateMask(m0, 180), { key, rotation: 180 });
        registerMask(byMask, rotateMask(m0, 270), { key, rotation: 270 });

        items.push(key);
    }

    return { keys: items, byMask };
}

function registerMask(byMask, mask, entry) {
    if (!byMask.has(mask)) byMask.set(mask, []);
    byMask.get(mask).push(entry);
}

function edgeMaskFromAlpha(png) {
    const t = Math.max(2, Math.floor(Math.min(png.width, png.height) * 0.08));
    const alphaThresh = 30;

    const n = scanEdge(png, "N", t, alphaThresh);
    const e = scanEdge(png, "E", t, alphaThresh);
    const s = scanEdge(png, "S", t, alphaThresh);
    const w = scanEdge(png, "W", t, alphaThresh);

    return connMask({ n: n ? 1 : 0, e: e ? 1 : 0, s: s ? 1 : 0, w: w ? 1 : 0 });
}

function scanEdge(png, edge, t, alphaThresh) {
    const w = png.width;
    const h = png.height;
    const data = png.data;

    let hits = 0;
    let samples = 0;
    const step = 2;
    const minHitRatio = 0.03;

    const alphaAt = (x, y) => data[(w * y + x) * 4 + 3];

    if (edge === "N") {
        for (let y = 0; y < t; y++)
            for (let x = 0; x < w; x += step) (samples++, alphaAt(x, y) > alphaThresh && hits++);
    } else if (edge === "S") {
        for (let y = h - t; y < h; y++)
            for (let x = 0; x < w; x += step) (samples++, alphaAt(x, y) > alphaThresh && hits++);
    } else if (edge === "W") {
        for (let x = 0; x < t; x++)
            for (let y = 0; y < h; y += step) (samples++, alphaAt(x, y) > alphaThresh && hits++);
    } else if (edge === "E") {
        for (let x = w - t; x < w; x++)
            for (let y = 0; y < h; y += step) (samples++, alphaAt(x, y) > alphaThresh && hits++);
    }

    return samples ? hits / samples >= minHitRatio : false;
}

function rotateMask(mask, deg) {
    const n = (mask & 1) !== 0;
    const e = (mask & 2) !== 0;
    const s = (mask & 4) !== 0;
    const w = (mask & 8) !== 0;

    if (deg === 0) return mask;
    if (deg === 90) return connMask({ n: w ? 1 : 0, e: n ? 1 : 0, s: e ? 1 : 0, w: s ? 1 : 0 });
    if (deg === 180) return connMask({ n: s ? 1 : 0, e: w ? 1 : 0, s: n ? 1 : 0, w: e ? 1 : 0 });
    if (deg === 270) return connMask({ n: e ? 1 : 0, e: s ? 1 : 0, s: w ? 1 : 0, w: n ? 1 : 0 });
    return mask;
}

function pickTileForMask(lib, mask, rng) {
    const opts = lib.byMask.get(mask);
    if (opts && opts.length) return opts[Math.floor(rng() * opts.length)];

    for (const m of relaxMasks(mask)) {
        const o = lib.byMask.get(m);
        if (o && o.length) return o[Math.floor(rng() * o.length)];
    }
    return null;
}

function relaxMasks(mask) {
    const bits = [1, 2, 4, 8];
    const out = [];
    for (const b of bits) if (mask & b) out.push(mask & ~b);
    return out;
}

// ---------- Path carving ----------
function carvePath({ width, height, rng, minLen, wiggle, avoid }) {
    const a = randomEdgePoint(width, height, rng);
    let b = randomEdgePoint(width, height, rng);

    let tries = 0;
    while (tries++ < 50 && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < Math.min(width, height) / 2) {
        b = randomEdgePoint(width, height, rng);
    }

    const path = [];
    const visited = new Set();

    let cur = { ...a };
    path.push(cur);
    visited.add(`${cur.x},${cur.y}`);

    const maxSteps = width * height;
    while ((cur.x !== b.x || cur.y !== b.y) && path.length < maxSteps) {
        const next = stepToward(cur, b, rng, wiggle);
        if (!inBounds(next.x, next.y, width, height)) continue;

        if (avoid && avoid[next.y][next.x]) {
            if (rng() > 0.08) continue;
        }

        const k = `${next.x},${next.y}`;
        if (visited.has(k) && rng() > 0.03) continue;

        cur = next;
        path.push(cur);
        visited.add(k);

        if (cur.x === b.x && cur.y === b.y && path.length < minLen) {
            b = randomEdgePoint(width, height, rng);
        }
    }

    if (cur.x !== b.x || cur.y !== b.y) {
        for (const p of manhattanLine(cur, b)) {
            if (inBounds(p.x, p.y, width, height)) path.push(p);
        }
    }

    return squashPath(path);
}

function stepToward(cur, target, rng, wiggle) {
    const dx = target.x - cur.x;
    const dy = target.y - cur.y;

    const preferX = Math.abs(dx) >= Math.abs(dy);
    const choosePerp = rng() < wiggle;

    if (!choosePerp) {
        return preferX
            ? { x: cur.x + Math.sign(dx), y: cur.y }
            : { x: cur.x, y: cur.y + Math.sign(dy) };
    }

    return preferX
        ? { x: cur.x, y: cur.y + (rng() < 0.5 ? 1 : -1) }
        : { x: cur.x + (rng() < 0.5 ? 1 : -1), y: cur.y };
}

// ---------- Thickness ----------
function expandPathThickness(pathCells, width, height, thickness) {
    if (thickness <= 1) return pathCells;

    const out = [];
    const seen = new Set();

    for (const p of pathCells) {
        for (let oy = 0; oy < thickness; oy++) {
            for (let ox = 0; ox < thickness; ox++) {
                const x = p.x + ox;
                const y = p.y + oy;
                if (!inBounds(x, y, width, height)) continue;
                const k = `${x},${y}`;
                if (seen.has(k)) continue;
                seen.add(k);
                out.push({ x, y });
            }
        }
    }

    return out;
}

// ---------- Objects ----------
function buildObjectPools(manifest, pack) {
    const sprites = manifest.sprites.filter((s) => s.pack === pack && s.kind === "object");

    const byHint = (hints, baseScale) =>
        sprites
            .filter((s) => {
                const hay = `${s.category}/${s.subcategory}/${s.file}`.toLowerCase();
                return hints.some((h) => hay.includes(h));
            })
            .map((s) => ({
                key: s.key,
                scale: s.scale ?? baseScale,
                weight: weightForObject(s),
            }));

    // Buildings: keep ONLY building_1.(png/jpg/webp/...)
    // This works for:
    //   buildings/building-4/building_1.png
    // and excludes building_2.png ... building_12.png etc.
    const buildings = sprites
        .filter((s) => {
            const f = String(s.file ?? "").toLowerCase();
            if (!f) return false;

            const looksLikeBuilding =
                `${s.category}/${s.subcategory}/${s.key}`.toLowerCase().includes("building") ||
                f.includes("building");

            if (!looksLikeBuilding) return false;

            // only building_1.*
            return /^building[_-]?1\.(png|jpg|jpeg|webp)$/.test(f);
        })
        .map((s) => ({
            key: s.key,
            scale: s.scale ?? { x: 1.85, y: 1.85 },
            weight: 0.4,
        }));

    return {
        trees: byHint(["tree", "palm"], { x: 1.55, y: 1.55 }),
        stones: byHint(["stone", "rock", "boulder"], { x: 1.25, y: 1.25 }),
        greenery: byHint(["greenery", "plant", "bush", "flower", "grass"], { x: 1.15, y: 1.15 }),
        decor: byHint(["decor"], { x: 1.2, y: 1.2 }),
        buildings,
    };
}

function weightForObject(s) {
    const name = `${s.file}`.toLowerCase();
    if (name.includes("building")) return 0.4;
    if (name.includes("tree")) return 1.0;
    if (name.includes("stone")) return 1.1;
    if (name.includes("greenery")) return 1.2;
    if (name.includes("decor")) return 1.0;
    return 1.0;
}

// ---------- Manifest selection ----------
function findKeysByHints(manifest, pack, kind, hints) {
    const list = manifest.sprites
        .filter((s) => s.pack === pack && s.kind === kind)
        .filter((s) => hints.some((h) => s.key.toLowerCase().includes(h) || s.url.toLowerCase().includes(h)))
        .map((s) => s.key);

    return Array.from(new Set(list)).sort();
}

function pickBaseLand(landCandidates) {
    const lc = landCandidates.map((k) => k.toLowerCase());
    return (
        landCandidates[lc.findIndex((k) => k.endsWith("/terrain/land/land"))] ||
        landCandidates[lc.findIndex((k) => k.endsWith("/terrain/land/land_0"))] ||
        landCandidates[lc.findIndex((k) => k.endsWith("/terrain/land/land_1"))] ||
        landCandidates[0]
    );
}

// ---------- Small utils ----------
function connMask({ n, e, s, w }) {
    return (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
}

function randomEdgePoint(width, height, rng) {
    const side = Math.floor(rng() * 4);
    if (side === 0) return { x: Math.floor(rng() * width), y: 0 };
    if (side === 1) return { x: width - 1, y: Math.floor(rng() * height) };
    if (side === 2) return { x: Math.floor(rng() * width), y: height - 1 };
    return { x: 0, y: Math.floor(rng() * height) };
}

function manhattanLine(a, b) {
    const out = [];
    let x = a.x;
    let y = a.y;
    while (x !== b.x) (x += Math.sign(b.x - x)), out.push({ x, y });
    while (y !== b.y) (y += Math.sign(b.y - y)), out.push({ x, y });
    return out;
}

function squashPath(path) {
    const out = [];
    let last = null;
    for (const p of path) {
        if (!last || p.x !== last.x || p.y !== last.y) out.push(p);
        last = p;
    }
    return out;
}

function randomFreeCell(width, height, blocked, rng) {
    for (let tries = 0; tries < 600; tries++) {
        const x = Math.floor(rng() * width);
        const y = Math.floor(rng() * height);
        if (!blocked[y][x]) return { x, y };
    }
    return null;
}

function pickWeighted(list, rng) {
    if (!list || list.length === 0) return null;
    let total = 0;
    for (const it of list) total += it.weight ?? 1;
    let r = rng() * total;
    for (const it of list) {
        r -= it.weight ?? 1;
        if (r <= 0) return it;
    }
    return list[list.length - 1];
}

function inBounds(x, y, w, h) {
    return x >= 0 && y >= 0 && x < w && y < h;
}

function clampInt(v, a, b) {
    return Math.max(a, Math.min(b, Math.floor(v)));
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function assertExists(p, msg) {
    if (!fs.existsSync(p)) throw new Error(msg);
}

function parseArgs(args) {
    const out = {};
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (!a.startsWith("--")) continue;
        const k = a.slice(2);
        const v = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "1";
        out[k] = v;
    }
    return out;
}

// Deterministic RNG from string seed
function makeRng(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    const seed = (h >>> 0) || 1;
    return mulberry32(seed);
}

function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
