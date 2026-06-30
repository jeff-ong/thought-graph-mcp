import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Session,
  SessionFiles,
  ThoughtNode,
  ThoughtType,
} from "./types.js";
import { renderMarkdown } from "./markdown.js";
import { renderHtml } from "./graph.js";
import { clearAssetCache } from "./assets.js";
import {
  ensureSessionAssets,
  sessionJsonSearchDirs,
  sessionsSubdir,
} from "./session-layout.js";

const require = createRequire(import.meta.url);
const packageVersion: string = require("../package.json").version;

/**
 * Where session artifacts are written. Override with THOUGHT_GRAPH_DIR.
 *
 * Always returns an ABSOLUTE path that does not depend on the server's working
 * directory (which is unpredictable for an MCP host). A leading `~` is expanded,
 * and a relative value is resolved against the home directory — not the cwd — so
 * artifacts land in a stable, portable location on every machine.
 */
export function sessionsDir(): string {
  let dir = process.env.THOUGHT_GRAPH_DIR?.trim() || "";
  if (!dir) return path.join(os.homedir(), "thought-graph-sessions");
  if (dir === "~" || dir.startsWith("~/")) {
    dir = path.join(os.homedir(), dir.slice(1));
  }
  return path.isAbsolute(dir) ? dir : path.resolve(os.homedir(), dir);
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "session"
  );
}

/** On-disk paths for a session's JSON, Markdown, and HTML artifacts. */
export function sessionFilesFor(session: Session): SessionFiles {
  const base = path.join(
    sessionsSubdir(sessionsDir()),
    `${slugify(session.title)}-${session.id.slice(0, 8)}`,
  );
  return {
    jsonPath: `${base}.json`,
    markdownPath: `${base}.md`,
    htmlPath: `${base}.html`,
  };
}

/** In-memory cache so we don't re-read JSON on every tool call. */
const cache = new Map<string, Session>();

export async function createSession(
  problem: string,
  title?: string,
): Promise<{ session: Session; files: SessionFiles }> {
  const now = new Date().toISOString();
  const session: Session = {
    id: randomUUID(),
    title: title?.trim() || problem.slice(0, 60),
    problem,
    nodes: [],
    createdAt: now,
    updatedAt: now,
  };
  // Seed the root node from the problem statement.
  session.nodes.push({
    id: "n1",
    title: "Problem",
    content: problem,
    type: "root",
    parents: [],
    status: "active",
    createdAt: now,
  });
  cache.set(session.id, session);
  const files = await persist(session);
  return { session, files };
}

export async function getSession(id: string): Promise<Session | undefined> {
  if (cache.has(id)) return cache.get(id);
  // Fall back to scanning disk so sessions survive a server restart.
  const root = sessionsDir();
  for (const dir of sessionJsonSearchDirs(root)) {
    try {
      const entries = await fs.readdir(dir);
      for (const e of entries) {
        if (!e.endsWith(".json")) continue;
        try {
          const raw = await fs.readFile(path.join(dir, e), "utf8");
          const s = JSON.parse(raw) as Session;
          if (s.id === id) {
            cache.set(s.id, s);
            return s;
          }
        } catch {
          /* ignore malformed file */
        }
      }
    } catch {
      /* dir may not exist yet */
    }
  }
  return undefined;
}

function nextNodeId(session: Session): string {
  let max = 0;
  for (const n of session.nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `n${max + 1}`;
}

export interface AddThoughtInput {
  title: string;
  content: string;
  type: ThoughtType;
  parents?: string[];
  branch?: string;
  confidence?: number;
}

export async function addThought(
  session: Session,
  input: AddThoughtInput,
): Promise<{ node: ThoughtNode; files: SessionFiles; warnings: string[] }> {
  const warnings: string[] = [];
  const parents = input.parents ?? [];
  for (const p of parents) {
    if (!session.nodes.some((n) => n.id === p)) {
      warnings.push(`Unknown parent id "${p}" — node will still be created.`);
    }
  }
  const node: ThoughtNode = {
    id: nextNodeId(session),
    title: input.title.trim(),
    content: input.content.trim(),
    type: input.type,
    parents,
    status: "active",
    branch: input.branch,
    confidence: input.confidence,
    createdAt: new Date().toISOString(),
  };
  session.nodes.push(node);
  const files = await persist(session);
  return { node, files, warnings };
}

/** Direct children of a node (nodes that list it as a parent). */
export function childrenOf(session: Session, id: string): string[] {
  return session.nodes.filter((n) => n.parents.includes(id)).map((n) => n.id);
}

/** All descendants of a node (transitive children), excluding superseded ones. */
export function descendantsOf(session: Session, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [...childrenOf(session, id)];
  while (queue.length) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    queue.push(...childrenOf(session, cur));
  }
  return out;
}

export async function reviseStep(
  session: Session,
  nodeId: string,
  newContent: string,
  newTitle?: string,
): Promise<{
  revision: ThoughtNode;
  superseded: ThoughtNode;
  descendants: string[];
  files: SessionFiles;
}> {
  const target = session.nodes.find((n) => n.id === nodeId);
  if (!target) throw new Error(`No node with id "${nodeId}" in this session.`);

  const descendants = descendantsOf(session, nodeId);
  target.status = "superseded";

  const revision: ThoughtNode = {
    id: nextNodeId(session),
    title: (newTitle ?? target.title).trim(),
    content: newContent.trim(),
    type: "revision",
    parents: [...target.parents],
    status: "active",
    revisionOf: target.id,
    branch: target.branch,
    createdAt: new Date().toISOString(),
  };
  session.nodes.push(revision);
  const files = await persist(session);
  return { revision, superseded: target, descendants, files };
}

export async function finalize(
  session: Session,
  answer: string,
): Promise<SessionFiles> {
  session.finalAnswer = answer.trim();
  return persist(session);
}

export async function listSessions(): Promise<
  { id: string; title: string; nodes: number; updatedAt: string }[]
> {
  const root = sessionsDir();
  const out: { id: string; title: string; nodes: number; updatedAt: string }[] =
    [];
  const seen = new Set<string>();
  for (const dir of sessionJsonSearchDirs(root)) {
    try {
      for (const e of await fs.readdir(dir)) {
        if (!e.endsWith(".json")) continue;
        try {
          const s = JSON.parse(
            await fs.readFile(path.join(dir, e), "utf8"),
          ) as Session;
          if (seen.has(s.id)) continue;
          seen.add(s.id);
          out.push({
            id: s.id,
            title: s.title,
            nodes: s.nodes.length,
            updatedAt: s.updatedAt,
          });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* dir missing */
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Write JSON + Markdown + HTML for a session and return their paths. */
async function persist(session: Session): Promise<SessionFiles> {
  session.updatedAt = new Date().toISOString();
  cache.set(session.id, session);
  const root = sessionsDir();
  await ensureSessionAssets(root, packageVersion);
  clearAssetCache();
  const files = sessionFilesFor(session);
  await fs.mkdir(path.dirname(files.jsonPath), { recursive: true });
  await Promise.all([
    fs.writeFile(files.jsonPath, JSON.stringify(session, null, 2), "utf8"),
    fs.writeFile(files.markdownPath, renderMarkdown(session, files), "utf8"),
    fs.writeFile(
      files.htmlPath,
      renderHtml(session, { assetSourceRoot: root }),
      "utf8",
    ),
  ]);
  return files;
}
