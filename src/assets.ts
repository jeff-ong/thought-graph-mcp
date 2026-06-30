import { readFileSync } from "node:fs";
import path from "node:path";
import {
  GRAPH_CLIENT_JS,
  GRAPH_CSS,
  packagedGraphDir,
} from "./graph-assets.js";
import {
  sessionGraphDir,
  sessionVendorDir,
} from "./session-layout.js";
import {
  packagedVendorDir,
  VENDOR_SCRIPTS,
  type VendorScript,
} from "./vendor.js";

/** How static CSS/JS reaches the browser. */
export type AssetDelivery = "inline-packaged" | "relative";

export interface AssetSource {
  vendorDir: string;
  graphDir: string;
}

const bundleCache = new Map<string, string>();

function readCached(filePath: string): string {
  if (!bundleCache.has(filePath)) {
    bundleCache.set(filePath, readFileSync(filePath, "utf8"));
  }
  return bundleCache.get(filePath)!;
}

function hrefPrefix(prefix: string): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

export interface ResolvedAssets {
  vendorLibs: string;
  graphStyles: string;
  graphClientScript: string;
}

function defaultAssetSource(): AssetSource {
  return {
    vendorDir: packagedVendorDir(),
    graphDir: packagedGraphDir(),
  };
}

/** Load static vendor/graph files for HTML output. */
export function resolvePackagedAssets(
  delivery: AssetDelivery,
  options?: {
    relative?: { vendorPrefix: string; graphPrefix: string };
    /** When set, read static files from the session folder's assets/ tree. */
    source?: AssetSource;
  },
): ResolvedAssets {
  const { vendorDir, graphDir } = options?.source ?? defaultAssetSource();

  if (delivery === "relative") {
    const vendorPrefix = hrefPrefix(options?.relative?.vendorPrefix ?? "_vendor/");
    const graphPrefix = hrefPrefix(options?.relative?.graphPrefix ?? "_graph/");
    return {
      vendorLibs: VENDOR_SCRIPTS.map(
        (name) => `<script src="${vendorPrefix}${name}"></script>`,
      ).join("\n"),
      graphStyles: `<link rel="stylesheet" href="${graphPrefix}${GRAPH_CSS}" />`,
      graphClientScript: `<script src="${graphPrefix}${GRAPH_CLIENT_JS}"></script>`,
    };
  }

  // Embed static files (Claude Desktop in-app browser cannot load sibling file:// assets).
  const vendorLibs = VENDOR_SCRIPTS.map((name: VendorScript) => {
    const content = readCached(path.join(vendorDir, name));
    return `<script>${content}</script>`;
  }).join("\n");

  const css = readCached(path.join(graphDir, GRAPH_CSS));
  const clientJs = readCached(path.join(graphDir, GRAPH_CLIENT_JS));

  return {
    vendorLibs,
    graphStyles: `<style>\n${css}\n</style>`,
    graphClientScript: `<script>\n${clientJs}\n</script>`,
  };
}

/** Asset paths under a session root (`~/thought-graph-sessions`). */
export function sessionAssetSource(sessionRoot: string): AssetSource {
  return {
    vendorDir: sessionVendorDir(sessionRoot),
    graphDir: sessionGraphDir(sessionRoot),
  };
}

/** Drop cached file reads (dev preview or after asset sync). */
export function clearAssetCache(): void {
  bundleCache.clear();
}
