import type { Session, SessionFiles, ThoughtNode, ThoughtType } from "./types.js";
import { htmlFileUrl } from "./artifacts.js";

const TYPE_LABEL: Record<ThoughtType, string> = {
  root: "🎯 Problem",
  decompose: "🔱 Decompose",
  subproblem: "🧩 Sub-problem",
  hypothesis: "💡 Hypothesis",
  evidence: "📎 Evidence",
  evaluation: "⚖️ Evaluation",
  revision: "♻️ Revision",
  conclusion: "✅ Conclusion",
};

// Every node renders as a rounded rectangle, matching the interactive HTML graph.
// (In Mermaid, `id("label")` is the rounded-rectangle shape.)
function mermaidNode(n: ThoughtNode): string {
  const label = `${n.id}: ${escapeMermaid(n.title)}`;
  return `${n.id}("${label}")`;
}

function escapeMermaid(s: string): string {
  return s.replace(/"/g, "'").replace(/[\n\r]+/g, " ").slice(0, 60);
}

function mermaidDiagram(session: Session): string {
  const lines: string[] = ["flowchart TD"];
  for (const n of session.nodes) {
    lines.push(`  ${mermaidNode(n)}`);
    for (const p of n.parents) {
      lines.push(`  ${p} --> ${n.id}`);
    }
  }
  // Style superseded nodes as dimmed/dashed.
  const superseded = session.nodes.filter((n) => n.status === "superseded");
  if (superseded.length) {
    lines.push(
      "  classDef superseded stroke-dasharray:4 4,opacity:0.5,color:#888;",
    );
    lines.push(`  class ${superseded.map((n) => n.id).join(",")} superseded;`);
  }
  return lines.join("\n");
}

export function renderMarkdown(
  session: Session,
  files: Pick<SessionFiles, "htmlPath" | "markdownPath">,
): string {
  const out: string[] = [];
  out.push(`# 🧠 Thought Graph — ${session.title}`);
  out.push("");
  out.push(`> **Problem:** ${session.problem}`);
  out.push(">");
  out.push(`> Session \`${session.id}\` · ${session.nodes.length} steps · last updated ${session.updatedAt}`);
  out.push("");

  out.push("## Reasoning graph");
  out.push("");
  out.push("```mermaid");
  out.push(mermaidDiagram(session));
  out.push("```");
  out.push("");
  out.push("## Interactive graph");
  out.push("");
  out.push(`- **HTML file:** \`${files.htmlPath}\``);
  out.push(`- **Open in browser:** \`${htmlFileUrl(files.htmlPath)}\``);
  out.push("");

  out.push("## Steps");
  out.push("");
  for (const n of session.nodes) {
    const dim = n.status === "superseded" ? " · _superseded_" : "";
    const conf =
      typeof n.confidence === "number"
        ? ` · confidence ${(n.confidence * 100).toFixed(0)}%`
        : "";
    const branch = n.branch ? ` · branch _${n.branch}_` : "";
    const from =
      n.parents.length > 0 ? ` · from ${n.parents.join(", ")}` : "";
    const rev = n.revisionOf ? ` · revises ${n.revisionOf}` : "";
    out.push(`### \`${n.id}\` ${TYPE_LABEL[n.type]} — ${n.title}`);
    out.push(`<sub>${from}${branch}${conf}${rev}${dim}</sub>`);
    out.push("");
    out.push(n.content);
    out.push("");
  }

  if (session.finalAnswer) {
    out.push("---");
    out.push("");
    out.push("## ✅ Final answer");
    out.push("");
    out.push(session.finalAnswer);
    out.push("");
  }

  return out.join("\n");
}
