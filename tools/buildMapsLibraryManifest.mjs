import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("public/assets/maps_library");
const OUT = path.resolve("public/assets/maps_library.manifest.json");

const IMG_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

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
    if (lower.includes("/_meta/")) return true;
    if (lower.includes("preview_")) return true;
    if (lower.includes("/sheets/")) return true; // keep if you want; you can remove this line
    return false;
}

function classify(relParts) {
    // relParts = [pack, category, sub, ...rest, file]
    const [, cat = "unknown", sub = "misc"] = relParts;
    return { category: cat, subcategory: sub };
}

const files = walk(ROOT)
    .filter((abs) => IMG_EXTS.has(path.extname(abs).toLowerCase()))
    .map((abs) => {
        const rel = normSlashes(path.relative(ROOT, abs));
        return { abs, rel };
    })
    .filter(({ rel }) => !isMetaOrJunk(rel));

const sprites = files.map(({ rel }) => {
    const relParts = rel.split("/");
    const pack = relParts[0] ?? "unknown";
    const file = relParts.at(-1) ?? "unknown.png";
    const noExt = rel.replace(/\.[^/.]+$/, "");

    const { category, subcategory } = classify(relParts);

    const key = noExt;

    // URL served by Vite from /public
    const url = `/assets/maps_library/${rel}`;

    return { key, url, pack, category, subcategory, file };
});

const packs = {};
for (const s of sprites) {
    packs[s.pack] ??= {};
    packs[s.pack][s.category] ??= {};
    packs[s.pack][s.category][s.subcategory] ??= [];
    packs[s.pack][s.category][s.subcategory].push(s.key);
}

// stable ordering (helps diffs)
for (const p of Object.keys(packs)) {
    for (const c of Object.keys(packs[p])) {
        for (const sc of Object.keys(packs[p][c])) {
            packs[p][c][sc].sort();
        }
    }
}

const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    root: "/assets/maps_library",
    sprites,
    packs,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), "utf-8");
console.log(`Wrote ${sprites.length} sprites -> ${OUT}`);
