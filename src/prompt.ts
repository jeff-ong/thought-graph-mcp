// The "system prompt" guidance this server injects to steer the LLM toward
// decomposed, multi-path reasoning. MCP servers cannot silently set a host's
// system prompt, so we surface this two ways:
//   1. as an MCP *prompt* ("decompose") for clients that expose MCP prompts, and
//   2. as the return value of the `begin_thinking` tool (the path Claude Desktop uses).
 
export const GRAPH_LINK_GUIDE = `When telling the user how to open the interactive graph:

Each artifact update from \`begin_thinking\`, \`add_thought\`, \`revise_step\`, \`finalize_thinking\`, or \`get_session\` includes:
- An **Open interactive graph** resource attachment (\`file://\` URL)
- A markdown link: **[Open interactive graph](file://...)**

Rules — follow every time you reply about the graph:

1. **Copy verbatim** — paste the \`[Open interactive graph](file://...)\` markdown link from the **most recent** thought-graph tool result, character for character. Never construct a path from \`sessionId\`, title, or \`THOUGHT_GRAPH_DIR\`.

2. **After \`finalize_thinking\`** — always end with:

   ### Open graph
   [Open interactive graph](<exact file:// URL from tool output>)

3. **If the link is not in context** — call \`get_session\` with the \`sessionId\` and use the link from that result. Do not guess.

4. **Mention the attachment** — if the tool result shows an **Open interactive graph** attachment, tell the user to click it.

5. **Fallback** — if \`file://\` links do not open in the in-app browser, tell the user to run \`open ~/thought-graph-sessions/sessions\` and open the newest \`.html\` file.`;

export const DECOMPOSITION_GUIDE = `You are reasoning with the **Thought Graph** protocol. Instead of answering a complex problem in one pass, you build an explicit graph of small reasoning steps, then synthesize the answer from it.

Follow this loop:

1. **Start** — Call \`begin_thinking\` with the problem. This creates a session and a root node. Note the returned \`sessionId\`; pass it to every later call.

2. **Decompose** — Break the problem into 2-5 independent sub-problems. Record each as its own node with \`add_thought\` (type: "subproblem", parents: [root id]). Keep each node focused on ONE thing.

3. **Explore multiple paths** — For sub-problems with more than one plausible approach, record competing **hypotheses** as sibling nodes (same parent). Do not commit early; let parallel branches coexist.

4. **Support & evaluate** — Attach \`evidence\` nodes (facts, computations, observations) and \`evaluation\` nodes (weighing trade-offs, checking a hypothesis) to the relevant branch. Use \`confidence\` (0-1) to mark how sure you are.

5. **Merge** — When a step depends on several earlier nodes, list all of them in \`parents\`. This is what makes it a graph, not just a tree.

6. **Conclude** — Add \`conclusion\` nodes that synthesize a branch, then call \`finalize_thinking\` with the final answer.

Rules of thumb:
- One idea per node. Prefer many small nodes over a few large ones.
- Make dependencies explicit through \`parents\` — that is the whole point.
- Surface uncertainty as separate hypothesis branches rather than hedging inside one node.
- If you later realize a step was wrong, do NOT silently move on: call \`revise_step\` on that node. It records the correction and tells you which downstream nodes to reconsider.

After each tool call the server rewrites a Markdown log and an interactive HTML graph so the user can watch the reasoning unfold and point to any step by its node id (e.g. "n4").

${GRAPH_LINK_GUIDE}`;

export const REVISION_GUIDE = (
  nodeId: string,
  descendants: string[],
) => `Step ${nodeId} has been marked superseded and a fresh \`revision\` node now stands in its place. Reconsider its reasoning from scratch given the user's feedback.

Then re-examine every step that depended on it${
  descendants.length
    ? `: ${descendants.join(", ")}`
    : " (there were no downstream steps)"
}. For each one that no longer holds, either add an updated node (parents pointing at the new revision node) or revise it too. Finish by re-synthesizing the conclusion if it changed.`;
