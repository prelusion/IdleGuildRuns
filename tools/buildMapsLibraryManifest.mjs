// tools/buildMapsLibraryManifest.mjs
import fs from "node:fs";
import path from "node:path";

/**
 * Scans /public/assets/maps_library and generates:
 *   /public/assets/maps_library.manifest.json
 *
 * Manifest includes:
 * - sprites[]: { key, url, pack, category, subcategory, file, kind, scale, anchor }
 * - packs index: packs[pack][kind][category][subcategory] -> string[] of keys
 */

const ROOT = path.resolve("public/assets/maps_library");
const OUT = path.resolve("public/assets/maps_library.manifest.json");

const IMG_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

// ------------------------
// Helpers
// ------------------------
function walk(dir) {
    const out = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walk(p));
        else out.push(p);
    }
    return out;
}

function normSlashes(p) {
    return p.replaceAll("\\", "/");
}

function isMetaOrJunk(rel) {
    const lower = rel.toLowerCase();

    // ignore meta folders
    if (lower.includes("/_meta/")) return true;

    // ignore previews + sheets (optional)
    if (lower.includes("preview_")) return true;
    if (lower.includes("/sheets/")) return true;

    return false;
}

/**
 * Determines "category" and "subcategory" from a path like:
 *  pack/category/subcategory/.../file.png
 * If missing, falls back to "unknown"/"misc".
 */
function classify(relParts) {
    const [, cat = "unknown", sub = "misc"] = relParts;
    return { category: cat, subcategory: sub };
}

/**
 * tile vs object classifier. You can tweak these hints whenever.
 */
function classifyKind({ category, subcategory, relPath }) {
    const s = `${category}/${subcategory}/${relPath}`.toLowerCase();

    const tileHints = [
        "terrain",
        "tiles",
        "ground",
        "land",
        "road",
        "river",
        "wall",
        "bricks",
        "floor",
    ];

    return tileHints.some((h) => s.includes(h)) ? "tile" : "object";
}

/**
 * Default draw properties.
 * - scale: how "big" it should render vs its native pixels
 * - anchor: where it "sits" relative to its position (trees/buildings want bottom origin)
 *
 * NOTE: you can make these as detailed as you want.
 */
function classifyDrawProps({ category, subcategory, file, kind, relPath }) {
    const s = `${category}/${subcategory}/${file}/${relPath}`.toLowerCase();

    // Tiles: keep 1:1 and centered
    if (kind === "tile") {
        return { scale: { x: 1, y: 1 }, anchor: { x: 0.5, y: 0.5 } };
    }

    // Objects: bottom-anchored by default
    // (so "x,y" is where it touches ground)
    const base = { anchor: { x: 0.5, y: 1 } };

    // Buildings / structures: bigger
    if (s.includes("building") || s.includes("house") || s.includes("castle") || s.includes("tower")) {
        return { ...base, scale: { x: 3.0, y: 3.0 } };
    }

    // Trees: medium-large
    if (s.includes("tree") || s.includes("palm")) {
        return { ...base, scale: { x: 1.6, y: 1.6 } };
    }

    // Rocks / stones: a bit bigger
    if (s.includes("rock") || s.includes("stone") || s.includes("boulder")) {
        return { ...base, scale: { x: 1.3, y: 1.3 } };
    }

    // Plants / bushes: slightly bigger than base
    if (s.includes("plant") || s.includes("bush") || s.includes("flower") || s.includes("grass")) {
        return { ...base, scale: { x: 1.1, y: 1.1 } };
    }

    // Default object scale
    return { ...base, scale: { x: 1.2, y: 1.2 } };
}

function pushPackIndex(packs, { pack, kind, category, subcategory, key }) {
    packs[pack] ??= { tile: {}, object: {} };
    packs[pack][kind] ??= {};
    packs[pack][kind][category] ??= {};
    packs[pack][kind][category][subcategory] ??= [];
    packs[pack][kind][category][subcategory].push(key);
}

// ------------------------
// Main
// ------------------------
if (!fs.existsSync(ROOT)) {
    console.error(`ERROR: ROOT not found: ${ROOT}`);
    process.exit(1);
}

const files = walk(ROOT)
    .filter((abs) => IMG_EXTS.has(path.extname(abs).toLowerCase()))
    .map((abs) => {
        const rel = normSlashes(path.relative(ROOT, abs));
        return { abs, rel };
    })
    .filter(({ rel }) => !isMetaOrJunk(rel));

const packs = {};
const sprites = [];

for (const { rel } of files) {
    const relParts = rel.split("/");
    const pack = relParts[0] ?? "unknown";
    const file = relParts.at(-1) ?? "unknown.png";

    // key is rel path without extension
    const key = rel.replace(/\.[^/.]+$/, "");

    // url served by Vite from /public
    const url = `/assets/maps_library/${rel}`;

    const { category, subcategory } = classify(relParts);
    const kind = classifyKind({ category, subcategory, relPath: rel });

    const { scale, anchor } = classifyDrawProps({
        category,
        subcategory,
        file,
        kind,
        relPath: rel,
    });

    sprites.push({
        key,
        url,
        pack,
        category,
        subcategory,
        file,
        kind,
        scale,
        anchor,
    });

    pushPackIndex(packs, { pack, kind, category, subcategory, key });
}

// stable ordering (helps diffs + deterministic UI)
sprites.sort((a, b) => a.key.localeCompare(b.key));

for (const p of Object.keys(packs)) {
    for (const kind of Object.keys(packs[p])) {
        for (const cat of Object.keys(packs[p][kind])) {
            for (const sub of Object.keys(packs[p][kind][cat])) {
                packs[p][kind][cat][sub].sort();
            }
        }
    }
}

const manifest = {
    version: 2, // bump because we added fields
    generatedAt: new Date().toISOString(),
    root: "/assets/maps_library",
    sprites,
    packs,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), "utf-8");
console.log(`Wrote ${sprites.length} sprites -> ${OUT}`);
