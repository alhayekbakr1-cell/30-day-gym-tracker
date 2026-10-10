import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve("dist/client");
const assets = [];
async function walk(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
    else if (/\.(js|css|woff2?|ttf|webp|png|svg)$/.test(entry.name) && !["/service-worker.js"].includes(relative)) assets.push(relative);
  }
}
await walk(root);
assets.sort();
const template = await readFile("scripts/service-worker-template.js", "utf8");
const digest = createHash("sha256").update(template);
for (const asset of assets) digest.update(asset).update(await readFile(path.join(root, asset.slice(1))));
const version = digest.digest("hex").slice(0, 16);
const worker = template.replace('/*OFFLINE_POLICY*/ { version: "test", assets: [] }', JSON.stringify({ version, assets }));
await writeFile(path.join(root, "service-worker.js"), worker);
console.log(`Prepared versioned offline shell with ${assets.length} safe static assets.`);
