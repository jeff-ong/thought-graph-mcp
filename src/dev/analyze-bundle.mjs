import { rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import webpack from "webpack";
import { summarizeBundleStats } from "./bundle-summary.mjs";

const require = createRequire(import.meta.url);
const { generateReport } = require("webpack-bundle-analyzer/lib/viewer.js");

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const outDir = path.join(projectRoot, "docs/bundle-analysis");
const distDir = path.join(outDir, "dist");
const configUrl = pathToFileURL(
  path.join(projectRoot, "webpack.analyze.cjs"),
).href;

const statsJsonOptions = {
  all: false,
  assets: true,
  chunks: true,
  modules: true,
  nestedModules: true,
  chunkModules: true,
};

/** Webpack 5 omits asset.chunks unless stats use `all: true`; the analyzer requires it. */
function enrichAssetChunks(stats) {
  const chunkIdsByFile = new Map();
  for (const chunk of stats.chunks ?? []) {
    for (const file of chunk.files ?? []) {
      const ids = chunkIdsByFile.get(file) ?? [];
      ids.push(chunk.id);
      chunkIdsByFile.set(file, ids);
    }
  }
  for (const asset of stats.assets ?? []) {
    if (!asset.chunks?.length) {
      asset.chunks = chunkIdsByFile.get(asset.name) ?? [];
    }
  }
  return stats;
}

const configs = (await import(configUrl)).default;

await mkdir(outDir, { recursive: true });
await rm(distDir, { recursive: true, force: true });

const stats = await new Promise((resolve, reject) => {
  webpack(configs, (err, multiStats) => {
    if (err) return reject(err);
    if (multiStats?.hasErrors()) {
      const details = multiStats.toString({ colors: false, errors: true });
      return reject(new Error(details));
    }
    resolve(multiStats);
  });
});

const children = stats.stats.map((child) =>
  enrichAssetChunks(child.toJson(statsJsonOptions)),
);

const merged = { children };

const statsPath = path.join(outDir, "stats.json");
await writeFile(statsPath, JSON.stringify(merged));
await generateReport(merged, {
  reportFilename: path.join(outDir, "treemap.html"),
  openBrowser: false,
  defaultSizes: "gzip",
  reportTitle:
    "thought-graph-mcp — npx install footprint: MCP server + graph runtime (gzip)",
});

const summary = await summarizeBundleStats(merged, distDir);
const summaryPath = path.join(outDir, "summary.json");
await writeFile(summaryPath, JSON.stringify(summary, null, 2));

console.log(`Wrote ${path.join(outDir, "treemap.html")}`);
console.log(`Wrote ${summaryPath} (${summary.totalGzipLabel} gzip total)`);
