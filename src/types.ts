// Shared data model for the thought graph.

/** The kind of reasoning a node represents. Drives color + grouping in the graph. */
export type ThoughtType =
  | "root" // the original problem statement
  | "decompose" // breaking the problem into sub-problems
  | "subproblem" // a single sub-problem to solve
  | "hypothesis" // a candidate idea / approach to explore
  | "evidence" // a fact, observation, or computation supporting a path
  | "evaluation" // weighing options / checking a hypothesis
  | "revision" // a regenerated replacement for an earlier node
  | "conclusion"; // a synthesized partial or final answer

export const THOUGHT_TYPES: ThoughtType[] = [
  "root",
  "decompose",
  "subproblem",
  "hypothesis",
  "evidence",
  "evaluation",
  "revision",
  "conclusion",
];

/** Lifecycle status of a node. Superseded nodes stay in the graph but are dimmed. */
export type ThoughtStatus = "active" | "superseded";

export interface ThoughtNode {
  id: string; // e.g. "n3"
  title: string; // short label shown on the graph node
  content: string; // the full reasoning text
  type: ThoughtType;
  parents: string[]; // ids of nodes this one builds on (DAG, supports branching + merging)
  status: ThoughtStatus;
  /** If this node was created by revising another node, the id of the original. */
  revisionOf?: string;
  /** Optional label to distinguish parallel branches, e.g. "approach A". */
  branch?: string;
  confidence?: number; // optional 0..1 self-rated confidence
  createdAt: string; // ISO timestamp
}

export interface Session {
  id: string;
  title: string;
  problem: string; // the original complex question
  nodes: ThoughtNode[];
  finalAnswer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionFiles {
  jsonPath: string;
  markdownPath: string;
  htmlPath: string;
}
