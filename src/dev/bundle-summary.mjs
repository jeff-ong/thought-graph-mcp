import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function walkModules(modules, out) {
  for (const mod of modules ?? []) {
    if (mod.modules?.length) {
      walkModules(mod.modules, out);
      continue;
    }
    if (!mod.name || !mod.size) continue;
    const short = mod.name
      .replace(/^\.\//, "")
      .replace(/^.*node_modules\//, "")
      .replace(/\+ \d+ modules$/, "")
      .trim();
    if (!short || short.startsWith("(webpack)")) continue;
    out.push({ name: short, size: mod.size });
  }
}

export function topPackages(child, limit = 6) {
  const mods = [];
  walkModules(child.modules, mods);
  const byName = new Map();
  for (const { name, size } of mods) {
    const root = name.split("/")[0].startsWith("@")
      ? name.split("/").slice(0, 2).join("/")
      : name.split("/")[0];
    byName.set(root, (byName.get(root) ?? 0) + size);
  }
  return [...byName.entries()]
    .map(([name, size]) => ({ name, size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, limit);
}

export async function summarizeBundleStats(merged, distDir) {
  const children = merged.children ?? [];
  const regions = [];

  for (const child of children) {
    const asset = child.assets?.find((a) => a.name?.endsWith(".js"));
    const assetPath = asset
      ? `${distDir}/${child.name}/${asset.name}`
      : null;
    let minified = asset?.size ?? child.chunks?.[0]?.size ?? 0;
    let gzip = 0;
    if (assetPath) {
      try {
        const buf = await readFile(assetPath);
        minified = buf.length;
        gzip = gzipSync(buf).length;
      } catch {
        gzip = Math.round(minified * 0.32);
      }
    }

    regions.push({
      id: child.name,
      label: asset?.name ?? `${child.name}.js`,
      minified,
      gzip,
      topPackages: topPackages(child),
    });
  }

  const totalGzip = regions.reduce((n, r) => n + r.gzip, 0);
  for (const region of regions) {
    region.sharePct = totalGzip ? Math.round((region.gzip / totalGzip) * 100) : 0;
  }

  return {
    generatedAt: new Date().toISOString(),
    measure: "gzip",
    totalGzip,
    totalGzipLabel: formatBytes(totalGzip),
    regions: regions.map((r) => ({
      ...r,
      minifiedLabel: formatBytes(r.minified),
      gzipLabel: formatBytes(r.gzip),
      topPackages: r.topPackages.map((p) => ({
        name: p.name,
        size: p.size,
        label: formatBytes(p.size),
      })),
    })),
  };
}
