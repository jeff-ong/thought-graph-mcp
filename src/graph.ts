import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import type { Session } from "./types.js";
import {
  type AssetDelivery,
  resolvePackagedAssets,
  sessionAssetSource,
} from "./assets.js";

const templateDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "templates",
);

export interface RenderHtmlOptions {
  /**
   * `inline-packaged` (default): embed static CSS/JS — works in Claude Desktop
   * in-app browser. `relative`: link to asset paths (examples / GitHub Pages).
   */
  assetDelivery?: AssetDelivery;
  /** Used when assetDelivery is `relative`. */
  vendorHrefPrefix?: string;
  graphHrefPrefix?: string;
  /** Read inline assets from this tree (session folder's assets/). */
  assetSourceRoot?: string;
}

let compiledTemplate: Handlebars.TemplateDelegate | null = null;

/** Drop cached template so the next render reads graph.hbs from disk (dev preview). */
export function clearTemplateCache(): void {
  compiledTemplate = null;
}

function resolveTemplateDir(): string {
  if (process.env.THOUGHT_GRAPH_DEV === "1") {
    return path.join(process.cwd(), "src", "templates");
  }
  return templateDir;
}

function loadTemplate(): Handlebars.TemplateDelegate {
  if (compiledTemplate) return compiledTemplate;

  const main = readFileSync(path.join(resolveTemplateDir(), "graph.hbs"), "utf8");
  compiledTemplate = Handlebars.compile(main);
  return compiledTemplate;
}

export function renderHtml(
  session: Session,
  options: RenderHtmlOptions = {},
): string {
  const delivery = options.assetDelivery ?? "inline-packaged";
  const source = options.assetSourceRoot
    ? sessionAssetSource(options.assetSourceRoot)
    : undefined;

  const assets = resolvePackagedAssets(delivery, {
    source,
    relative:
      delivery === "relative"
        ? {
            vendorPrefix: options.vendorHrefPrefix ?? "_vendor/",
            graphPrefix: options.graphHrefPrefix ?? "_graph/",
          }
        : undefined,
  });

  return loadTemplate()({
    title: session.title,
    nodeCount: session.nodes.length,
    shortSessionId: session.id.slice(0, 8),
    sessionJson: JSON.stringify(session),
    vendorLibs: assets.vendorLibs,
    graphStyles: assets.graphStyles,
    graphClientScript: assets.graphClientScript,
    finalAnswer: session.finalAnswer ?? null,
  });
}
