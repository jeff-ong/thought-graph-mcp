import type { Session } from "../types.js";

/** Rich sample graph for UI development — branches, merges, superseded nodes, final answer. */
export const exampleSession: Session = {
  id: "00000000-aaaa-bbbb-cccc-devpreview",
  title: "Should we migrate to PostgreSQL?",
  problem:
    "Our SQLite-backed app is hitting write-contention limits at ~200 concurrent users. Should we migrate to PostgreSQL, and if so, what's the rollout plan?",
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-01T12:30:00.000Z",
  finalAnswer:
    "**Yes** — migrate to PostgreSQL using a blue/green cutover over a weekend.\n\n" +
    "**Rollout plan:**\n\n" +
    "1. **Phase 1** (week 1–2): dual-write behind a feature flag, validate row counts nightly\n" +
    "2. **Phase 2** (week 3): read replica on PG, shadow-read comparison in staging\n" +
    "3. **Phase 3** (weekend): flip reads, monitor p99 latency and error budget\n\n" +
    "**Rollback:** keep SQLite read-only snapshot for 7 days; `feature flag` reverts writes in <5 min.",
  nodes: [
    {
      id: "n1",
      title: "Problem",
      content:
        "SQLite write lock contention at 200+ concurrent users. Need a path to scale writes without a full rewrite.",
      type: "root",
      parents: [],
      status: "active",
      createdAt: "2026-06-01T10:00:00.000Z",
    },
    {
      id: "n2",
      title: "Break down the decision",
      content:
        "Three axes: (1) does PG solve the bottleneck, (2) migration cost/risk, (3) operational ownership.",
      type: "decompose",
      parents: ["n1"],
      status: "active",
      confidence: 0.9,
      createdAt: "2026-06-01T10:05:00.000Z",
    },
    {
      id: "n3",
      title: "Bottleneck analysis",
      content: "Profile shows 78% of request time in BEGIN IMMEDIATE retries on the orders table.",
      type: "subproblem",
      parents: ["n2"],
      status: "active",
      branch: "technical",
      confidence: 0.85,
      createdAt: "2026-06-01T10:10:00.000Z",
    },
    {
      id: "n4",
      title: "Migration cost",
      content:
        "ORM is Drizzle — PG dialect supported. ~40 raw SQL queries need audit; 6 use SQLite-specific pragmas.",
      type: "subproblem",
      parents: ["n2"],
      status: "active",
      branch: "engineering",
      confidence: 0.7,
      createdAt: "2026-06-01T10:12:00.000Z",
    },
    {
      id: "n5",
      title: "PG fixes write contention",
      content:
        "Row-level locking removes the single-writer bottleneck; benchmarks show 8× write throughput on identical schema.",
      type: "hypothesis",
      parents: ["n3"],
      status: "active",
      branch: "approach A",
      confidence: 0.8,
      createdAt: "2026-06-01T10:20:00.000Z",
    },
    {
      id: "n6",
      title: "Tune SQLite first",
      content:
        "WAL mode + shorter transactions might buy 6–12 months. Cheaper but doesn't remove the ceiling.",
      type: "hypothesis",
      parents: ["n3"],
      status: "superseded",
      branch: "approach B",
      confidence: 0.55,
      createdAt: "2026-06-01T10:22:00.000Z",
    },
    {
      id: "n7",
      title: "Load test evidence",
      content:
        "k6 run @ 250 VUs: SQLite p99 write 1.2s (12% errors). PG p99 write 140ms (0% errors). Same hardware class.",
      type: "evidence",
      parents: ["n5"],
      status: "active",
      confidence: 0.92,
      createdAt: "2026-06-01T10:35:00.000Z",
    },
    {
      id: "n8",
      title: "Revised: WAL is insufficient",
      content:
        "Re-ran with WAL + busy_timeout=5000. Still 9% errors at 200 VUs. Tuning alone won't meet the Q3 target.",
      type: "revision",
      parents: ["n3"],
      status: "active",
      revisionOf: "n6",
      branch: "approach B",
      confidence: 0.75,
      createdAt: "2026-06-01T10:40:00.000Z",
    },
    {
      id: "n9",
      title: "Query audit complete",
      content: "6 pragmas mapped to PG equivalents. 2 need application-level changes (ATTACH → schemas).",
      type: "evidence",
      parents: ["n4"],
      status: "active",
      confidence: 0.88,
      createdAt: "2026-06-01T11:00:00.000Z",
    },
    {
      id: "n10",
      title: "Compare options",
      content:
        "PG wins on throughput and future headroom. SQLite tuning is lower risk short-term but doesn't meet the 500 VU goal.",
      type: "evaluation",
      parents: ["n7", "n8", "n9"],
      status: "active",
      confidence: 0.82,
      createdAt: "2026-06-01T11:30:00.000Z",
    },
    {
      id: "n11",
      title: "Recommend PG migration",
      content:
        "Proceed with PG. Use phased dual-write rollout; keep SQLite snapshot for rollback window.",
      type: "conclusion",
      parents: ["n10"],
      status: "active",
      confidence: 0.85,
      createdAt: "2026-06-01T12:00:00.000Z",
    },
  ],
};
