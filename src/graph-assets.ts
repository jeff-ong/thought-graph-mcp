import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Thought-graph UI assets (CSS + client script), separate from npm vendor libs. */
export const GRAPH_DIR_NAME = "_graph";

export const GRAPH_CSS = "graph.css";
export const GRAPH_CLIENT_JS = "graph.client.js";

/** Directory shipped beside compiled JS (dist/_graph). */
export function packagedGraphDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), GRAPH_DIR_NAME);
}

function templateSourceDir(): string {
  if (process.env.THOUGHT_GRAPH_DEV === "1") {
    return path.join(process.cwd(), "src", "templates");
  }
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "templates");
}

function graphAssetSources(): Array<{ destName: string; srcPath: string }> {
  const srcDir = templateSourceDir();
  return [
    { destName: GRAPH_CSS, srcPath: path.join(srcDir, GRAPH_CSS) },
    { destName: GRAPH_CLIENT_JS, srcPath: path.join(srcDir, GRAPH_CLIENT_JS) },
  ];
}

/** Copy graph.css and graph.client.js into destDir (build / examples only). */
export async function syncGraphDir(destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  for (const { destName, srcPath } of graphAssetSources()) {
    if (!existsSync(srcPath)) {
      throw new Error(`Could not locate graph asset "${destName}" at ${srcPath}.`);
    }
    await copyFile(srcPath, path.join(destDir, destName));
  }
}
