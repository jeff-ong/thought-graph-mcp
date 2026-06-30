import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncGraphDir, GRAPH_DIR_NAME } from "../graph-assets.js";
import { syncVendorDir, VENDOR_DIR_NAME } from "../vendor.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const distDir = path.join(projectRoot, "dist");
await syncVendorDir(path.join(distDir, VENDOR_DIR_NAME));
await syncGraphDir(path.join(distDir, GRAPH_DIR_NAME));
console.log(`Synced assets → dist/${VENDOR_DIR_NAME}/ and dist/${GRAPH_DIR_NAME}/`);
