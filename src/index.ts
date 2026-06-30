#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { THOUGHT_TYPES } from "./types.js";
import { DECOMPOSITION_GUIDE, REVISION_GUIDE } from "./prompt.js";
import { artifactToolContent } from "./artifacts.js";
import {
  addThought,
  createSession,
  descendantsOf,
  finalize,
  getSession,
  listSessions,
  reviseStep,
  sessionFilesFor,
  sessionsDir,
} from "./store.js";

const server = new McpServer({
  name: "thought-graph",
  version: "0.1.0",
});

const typeEnum = z.enum(THOUGHT_TYPES as [string, ...string[]]);

function withArtifacts(prefix: string, files: { markdownPath: string; htmlPath: string }) {
  return { content: artifactToolContent(prefix, files) };
}

// 1) Start a session. Returns the decomposition guidance so the model is steered
//    into multi-path reasoning even if the client never surfaced the prompt.
server.tool(
  "begin_thinking",
  "Start a new Thought Graph reasoning session for a complex problem. Returns a sessionId and the protocol instructions. Call this FIRST, then build the reasoning with add_thought.",
  {
    problem: z.string().describe("The complex problem/question to reason about."),
    title: z
      .string()
      .optional()
      .describe("Short title for the session (defaults to the problem)."),
  },
  async ({ problem, title }) => {
    const { session, files } = await createSession(problem, title);
    return withArtifacts(
      `${DECOMPOSITION_GUIDE}\n\n---\n\nSession started.\n- sessionId: ${session.id}\n- root node: n1 (the problem)\n\nNow decompose the problem and record steps with add_thought, passing this sessionId.`,
      files,
    );
  },
);

// 2) Record one reasoning step.
server.tool(
  "add_thought",
  "Record one reasoning step (a graph node). Keep it to a single idea. Use `parents` to link it to the node(s) it builds on — list several to merge branches. Create sibling nodes with the same parent to explore competing paths.",
  {
    sessionId: z.string(),
    title: z.string().describe("Short label for the node (shown on the graph)."),
    content: z.string().describe("The full reasoning text for this step."),
    type: typeEnum.describe(
      "One of: decompose, subproblem, hypothesis, evidence, evaluation, conclusion (use revise_step for revisions).",
    ),
    parents: z
      .array(z.string())
      .optional()
      .describe('Ids of nodes this builds on, e.g. ["n1","n3"].'),
    branch: z
      .string()
      .optional()
      .describe('Optional branch label, e.g. "approach A".'),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Optional self-rated confidence 0..1."),
  },
  async ({ sessionId, title, content, type, parents, branch, confidence }) => {
    const session = await getSession(sessionId);
    if (!session)
      return errText(`No session "${sessionId}". Call begin_thinking first.`);
    const { node, files, warnings } = await addThought(session, {
      title,
      content,
      type: type as any,
      parents,
      branch,
      confidence,
    });
    const warn = warnings.length ? `\n\n⚠ ${warnings.join(" ")}` : "";
    return withArtifacts(
      `Added ${node.id} (${node.type}) "${node.title}"${
        node.parents.length ? ` ← ${node.parents.join(", ")}` : ""
      }.${warn}`,
      files,
    );
  },
);

// 3) Inspect current state so the model (or user) can review before revising.
server.tool(
  "get_session",
  "Return the current reasoning graph as JSON (all nodes, edges, statuses) plus on-disk artifact paths. Use this to review where things stand or recover the exact graph file path.",
  { sessionId: z.string() },
  async ({ sessionId }) => {
    const session = await getSession(sessionId);
    if (!session) return errText(`No session "${sessionId}".`);
    const files = sessionFilesFor(session);
    return withArtifacts(
      JSON.stringify({ session, artifacts: files }, null, 2),
      files,
    );
  },
);

// 4) Pinpoint a step, supersede it, and create a fresh revision node.
server.tool(
  "revise_step",
  "Pinpoint a specific step by node id, mark it superseded, and replace it with a fresh `revision` node. Returns the downstream nodes you should re-examine. Use when the user points at a step or you find a flaw.",
  {
    sessionId: z.string(),
    nodeId: z.string().describe('The node to revise, e.g. "n4".'),
    newContent: z.string().describe("The regenerated reasoning for this step."),
    newTitle: z.string().optional().describe("Optional new label."),
  },
  async ({ sessionId, nodeId, newContent, newTitle }) => {
    const session = await getSession(sessionId);
    if (!session) return errText(`No session "${sessionId}".`);
    try {
      const { revision, descendants, files } = await reviseStep(
        session,
        nodeId,
        newContent,
        newTitle,
      );
      return withArtifacts(
        `Revised ${nodeId} → new node ${revision.id}.\n\n${REVISION_GUIDE(
          nodeId,
          descendants,
        )}`,
        files,
      );
    } catch (e) {
      return errText((e as Error).message);
    }
  },
);

// 5) Finalize: record the synthesized answer.
server.tool(
  "finalize_thinking",
  "Record the final synthesized answer for the session and refresh the artifacts. Call after the graph supports a conclusion.",
  { sessionId: z.string(), answer: z.string() },
  async ({ sessionId, answer }) => {
    const session = await getSession(sessionId);
    if (!session) return errText(`No session "${sessionId}".`);
    const files = await finalize(session, answer);
    return withArtifacts(`Final answer recorded for "${session.title}".`, files);
  },
);

// 6) Housekeeping: list sessions.
server.tool(
  "list_sessions",
  "List existing Thought Graph sessions (id, title, step count) found on disk.",
  {},
  async () => {
    const sessions = await listSessions();
    const body = sessions.length
      ? sessions
          .map(
            (s) =>
              `- ${s.id.slice(0, 8)}  "${s.title}"  (${s.nodes} steps, updated ${s.updatedAt})`,
          )
          .join("\n")
      : "(none yet)";
    return {
      content: [
        { type: "text", text: `Sessions in ${sessionsDir()}:\n${body}` },
      ],
    };
  },
);

// MCP prompt for clients that expose MCP prompts (not shown in Claude Desktop).
server.prompt(
  "decompose",
  "Reason about a complex problem as an explicit, editable thought graph.",
  { problem: z.string().describe("The problem to reason about.") },
  ({ problem }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `${DECOMPOSITION_GUIDE}\n\n---\n\nProblem to solve with the Thought Graph protocol:\n\n${problem}`,
        },
      },
    ],
  }),
);

function errText(msg: string) {
  return { isError: true, content: [{ type: "text" as const, text: msg }] };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe; stdout is reserved for the MCP protocol.
  console.error(
    `thought-graph MCP server running. Sessions dir: ${sessionsDir()}`,
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
