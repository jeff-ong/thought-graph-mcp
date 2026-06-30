import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Shared folder name next to session HTML files and under examples/. */
export const VENDOR_DIR_NAME = "_vendor";

const require = createRequire(import.meta.url);

/** Load order matters for UMD globals (cytoscape → dagre → extensions). */
export const VENDOR_SCRIPTS = [
  "cytoscape.min.js",
  "dagre.min.js",
  "cytoscape-dagre.js",
  "cytoscape-node-html-label.js",
  "html2canvas.min.js",
  "marked.umd.js",
  "purify.min.js",
] as const;

export type VendorScript = (typeof VENDOR_SCRIPTS)[number];

interface VendorSource {
  destName: VendorScript;
  srcPath: string;
}

function resolveVendorSources(): VendorSource[] {
  const cyDir = path.dirname(require.resolve("cytoscape"));
  const dagreDir = path.dirname(require.resolve("dagre"));
  const candidates: Array<{ destName: VendorScript; paths: string[] }> = [
    {
      destName: "cytoscape.min.js",
      paths: [path.join(cyDir, "cytoscape.min.js")],
    },
    {
      destName: "dagre.min.js",
      paths: [
        path.join(dagreDir, "dist", "dagre.min.js"),
        path.join(dagreDir, "dagre.min.js"),
      ],
    },
    {
      destName: "cytoscape-dagre.js",
      paths: [require.resolve("cytoscape-dagre")],
    },
    {
      destName: "cytoscape-node-html-label.js",
      paths: [require.resolve("cytoscape-node-html-label")],
    },
    {
      destName: "html2canvas.min.js",
      paths: [
        path.join(
          path.dirname(require.resolve("html2canvas")),
          "html2canvas.min.js",
        ),
      ],
    },
    {
      destName: "marked.umd.js",
      paths: [
        path.join(path.dirname(require.resolve("marked")), "marked.umd.js"),
      ],
    },
    {
      destName: "purify.min.js",
      paths: [
        path.join(path.dirname(require.resolve("dompurify")), "purify.min.js"),
      ],
    },
  ];

  const out: VendorSource[] = [];
  for (const { destName, paths: candidatePaths } of candidates) {
    const srcPath = candidatePaths.find((p) => existsSync(p));
    if (!srcPath)
      throw new Error(`Could not locate vendored library "${destName}".`);
    out.push({ destName, srcPath });
  }
  return out;
}

/** Directory shipped beside compiled JS (dist/_vendor). */
export function packagedVendorDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), VENDOR_DIR_NAME);
}

/** Copy graph runtime libraries from node_modules into destDir (build only). */
export async function syncVendorDir(destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  for (const { destName, srcPath } of resolveVendorSources()) {
    await copyFile(srcPath, path.join(destDir, destName));
  }
}
