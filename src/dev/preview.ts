import { watch } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearAssetCache } from "../assets.js";
import { clearTemplateCache, renderHtml } from "../graph.js";
import { syncGraphDir, GRAPH_DIR_NAME } from "../graph-assets.js";
import { syncVendorDir, VENDOR_DIR_NAME } from "../vendor.js";
import { exampleSession } from "./example-session.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const outPath = path.join(projectRoot, "dev", "preview.html");
const templateDir = path.join(projectRoot, "src", "templates");
const distDir = path.join(projectRoot, "dist");

async function writePreview(): Promise<void> {
  clearTemplateCache();
  clearAssetCache();
  // Ensure dist has packaged assets for inline-packaged preview.
  await syncVendorDir(path.join(distDir, VENDOR_DIR_NAME));
  await syncGraphDir(path.join(distDir, GRAPH_DIR_NAME));
  const html = renderHtml(exampleSession);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf8");
  console.log(`Wrote ${outPath}`);
}

const watchMode = process.argv.includes("--watch");

await writePreview();

if (watchMode) {
  console.log(`Watching ${templateDir} — edit CSS/JS/HBS and refresh the browser`);
  watch(templateDir, { recursive: true }, () => {
    writePreview().catch((err) => console.error(err));
  });
}
