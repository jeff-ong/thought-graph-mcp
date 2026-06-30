import path from "node:path";
import { pathToFileURL } from "node:url";
import type { SessionFiles } from "./types.js";

/** Stable file:// URL for opening the graph in Claude Desktop's in-app browser. */
export function htmlFileUrl(htmlPath: string): string {
  return pathToFileURL(htmlPath).href;
}

/** Tool-response block with paths the model must copy verbatim for the user. */
export function filesBlock(
  files: Pick<SessionFiles, "markdownPath" | "htmlPath">,
): string {
  const fileUrl = htmlFileUrl(files.htmlPath);

  return `\n\nArtifacts updated:
- Markdown log: ${files.markdownPath}
- Interactive graph: ${files.htmlPath}
- **Click to open graph:** [Open interactive graph](${fileUrl})`;
}

type ToolContentBlock =
  | { type: "text"; text: string }
  | {
      type: "resource_link";
      uri: string;
      name: string;
      title?: string;
      mimeType?: string;
      annotations?: { audience?: ("user" | "assistant")[] };
    };

/** Text plus an MCP resource_link Claude Desktop can surface as a clickable attachment. */
export function artifactToolContent(
  prefixText: string,
  files: Pick<SessionFiles, "markdownPath" | "htmlPath">,
): ToolContentBlock[] {
  const fileUrl = htmlFileUrl(files.htmlPath);

  return [
    { type: "text", text: prefixText + filesBlock(files) },
    {
      type: "resource_link",
      uri: fileUrl,
      name: path.basename(files.htmlPath),
      title: "Open interactive graph",
      mimeType: "text/html",
      annotations: { audience: ["user"] },
    },
  ];
}
