import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GRAPH_CLIENT_JS, GRAPH_CSS, packagedGraphDir, syncGraphDir } from "./graph-assets.js";
import {
  packagedVendorDir,
  syncVendorDir,
  VENDOR_SCRIPTS,
} from "./vendor.js";

/** Shared static assets under the session root. */
export const ASSETS_DIR_NAME = "assets";
export const VENDOR_SUBDIR = "vendor";
export const GRAPH_SUBDIR = "graph";
export const SESSIONS_SUBDIR = "sessions";

const ASSET_VERSION_FILE = ".asset-version";

/** `~/thought-graph-sessions/assets/vendor` */
export function sessionVendorDir(sessionRoot: string): string {
  return path.join(sessionRoot, ASSETS_DIR_NAME, VENDOR_SUBDIR);
}

/** `~/thought-graph-sessions/assets/graph` */
export function sessionGraphDir(sessionRoot: string): string {
  return path.join(sessionRoot, ASSETS_DIR_NAME, GRAPH_SUBDIR);
}

/** `~/thought-graph-sessions/sessions` */
export function sessionsSubdir(sessionRoot: string): string {
  return path.join(sessionRoot, SESSIONS_SUBDIR);
}

/** Relative URL prefixes from a file inside `sessions/`. */
export function sessionAssetHrefPrefixes(): {
  vendorPrefix: string;
  graphPrefix: string;
} {
  return {
    vendorPrefix: `../${ASSETS_DIR_NAME}/${VENDOR_SUBDIR}/`,
    graphPrefix: `../${ASSETS_DIR_NAME}/${GRAPH_SUBDIR}/`,
  };
}

async function copyPackagedAssets(
  vendorDest: string,
  graphDest: string,
): Promise<void> {
  await mkdir(vendorDest, { recursive: true });
  await mkdir(graphDest, { recursive: true });
  for (const name of VENDOR_SCRIPTS) {
    await copyFile(
      path.join(packagedVendorDir(), name),
      path.join(vendorDest, name),
    );
  }
  const graphSrc = packagedGraphDir();
  for (const name of [GRAPH_CSS, GRAPH_CLIENT_JS] as const) {
    await copyFile(path.join(graphSrc, name), path.join(graphDest, name));
  }
}

/**
 * Copy static graph assets into `sessionRoot/assets/` once (or when the package
 * version changes). Source is the shipped npm package, not regenerated per session.
 */
export async function ensureSessionAssets(
  sessionRoot: string,
  packageVersion: string,
): Promise<void> {
  const vendorDir = sessionVendorDir(sessionRoot);
  const graphDir = sessionGraphDir(sessionRoot);
  const versionPath = path.join(sessionRoot, ASSETS_DIR_NAME, ASSET_VERSION_FILE);

  try {
    const installed = (await readFile(versionPath, "utf8")).trim();
    if (
      installed === packageVersion &&
      existsSync(path.join(vendorDir, VENDOR_SCRIPTS[0])) &&
      existsSync(path.join(graphDir, "graph.css"))
    ) {
      return;
    }
  } catch {
    /* first install or incomplete copy */
  }

  try {
    await copyPackagedAssets(vendorDir, graphDir);
  } catch {
    // Dev / unpublished: fall back to syncing from node_modules + templates.
    await syncVendorDir(vendorDir);
    await syncGraphDir(graphDir);
  }

  await mkdir(path.dirname(versionPath), { recursive: true });
  await writeFile(versionPath, `${packageVersion}\n`, "utf8");
}

/** Scan paths that may contain legacy session JSON (root or sessions/). */
export function sessionJsonSearchDirs(sessionRoot: string): string[] {
  return [sessionsSubdir(sessionRoot), sessionRoot];
}
