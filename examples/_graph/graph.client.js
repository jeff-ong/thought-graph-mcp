const TYPE_COLORS = {
  root: "#5b9cff", decompose: "#9a8bff", subproblem: "#37c7a0",
  hypothesis: "#f2b134", evidence: "#69b7e8", evaluation: "#f07a47",
  revision: "#e87bb0", conclusion: "#74cf6f"
};
const TYPE_LABELS = {
  root: "Problem", decompose: "Decompose", subproblem: "Sub-problem",
  hypothesis: "Hypothesis", evidence: "Evidence", evaluation: "Evaluation",
  revision: "Revision", conclusion: "Conclusion"
};

// Card geometry — the cytoscape node is an invisible box of this size so dagre
// lays it out and edges attach to its border; the HTML card is drawn on top.
const CARD_W = 250;
const CARD_H = 146;

function hexToRgb(h) {
  h = h.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// Pick dark or white badge text for best contrast on the accent color.
function badgeTextOn(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? "#10131a" : "#ffffff";
}

try { if (window.cytoscapeDagre) cytoscape.use(window.cytoscapeDagre); } catch (e) {}

// ---- Legend (click toggles type visibility; hover highlights matching) ------
const legend = document.getElementById("legend");
const hiddenTypes = new Set();
const sessionTypes = new Set(SESSION.nodes.map((n) => n.type));

function allCards() {
  return document.querySelectorAll(".gnode");
}
function clearHighlight() {
  cy.elements().removeClass("faded hl");
  allCards().forEach((el) => el.classList.remove("is-faded", "is-hl"));
}
// Card (DOM) highlighting only — canvas fading is handled by the callers, so we
// must NOT re-fade cy elements here or the highlighted path edges get dimmed.
// The selected card (active in the side panel) stays visible even during hover.
function highlightIds(idSet) {
  allCards().forEach((el) => {
    const on = idSet.has(el.dataset.gid);
    const selected = el.classList.contains("is-selected");
    el.classList.toggle("is-faded", !on && !selected);
    el.classList.toggle("is-hl", on);
  });
}
function highlightType(type) {
  const matching = cy.nodes(`[type = "${type}"]`);
  matching.union(matching.connectedEdges()).removeClass("faded").addClass("hl");
  cy.elements().not(matching.union(matching.connectedEdges())).addClass("faded");
  highlightIds(new Set(matching.map((n) => n.id())));
}
function applyTypeFilter() {
  cy.batch(() => {
    cy.nodes().forEach((node) =>
      node.toggleClass("hidden-type", hiddenTypes.has(node.data("type"))));
    cy.edges().forEach((edge) =>
      edge.toggleClass("hidden-type",
        hiddenTypes.has(edge.source().data("type")) ||
        hiddenTypes.has(edge.target().data("type"))));
  });
  allCards().forEach((el) =>
    el.classList.toggle("is-hidden", hiddenTypes.has(el.dataset.gtype)));
}

Object.keys(TYPE_LABELS)
  .filter((t) => sessionTypes.has(t))
  .forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.type = t;
    btn.title = "Click to show/hide · hover to highlight";
    btn.innerHTML =
      '<i style="background:' + TYPE_COLORS[t] + '"></i>' + TYPE_LABELS[t];
    btn.addEventListener("click", () => {
      if (hiddenTypes.has(t)) hiddenTypes.delete(t);
      else hiddenTypes.add(t);
      btn.classList.toggle("off", hiddenTypes.has(t));
      applyTypeFilter();
      clearHighlight();
    });
    btn.addEventListener("mouseenter", () => {
      if (!hiddenTypes.has(t)) highlightType(t);
    });
    btn.addEventListener("mouseleave", clearHighlight);
    legend.appendChild(btn);
  });

// ---- Build elements ---------------------------------------------------------
const elements = [];
for (const n of SESSION.nodes) {
  const accent = TYPE_COLORS[n.type] || "#888";
  elements.push({ data: {
    id: n.id,
    type: n.type,
    status: n.status,
    accent,
    badgeText: badgeTextOn(accent),
    typeLabel: (TYPE_LABELS[n.type] || n.type).toUpperCase(),
    pct: typeof n.confidence === "number" ? Math.round(n.confidence * 100) + "%" : "",
    titleText: n.title,
    bodyText: n.content,
    superseded: n.status === "superseded",
    node: n
  }});
  for (const p of n.parents)
    elements.push({ data: { id: p + "->" + n.id, source: p, target: n.id } });
}

const LAYOUT = {
  name: window.cytoscapeDagre ? "dagre" : "breadthfirst",
  rankDir: "TB", nodeSep: 34, rankSep: 66, edgeSep: 14,
  directed: true, padding: 36, spacingFactor: 1.0, animate: false
};

const cy = cytoscape({
  container: document.getElementById("cy"),
  elements,
  style: [
    // The node itself is an invisible, sized box — the HTML card is the visual.
    { selector: "node", style: {
      "width": CARD_W, "height": CARD_H,
      "background-opacity": 0, "border-width": 0,
      "label": "", "shape": "round-rectangle" } },
    { selector: "edge", style: {
      "width": 2, "line-color": "#3a4150",
      "target-arrow-color": "#4a5365", "target-arrow-shape": "triangle",
      "arrow-scale": 1.1,
      "curve-style": "taxi", "taxi-direction": "downward", "taxi-turn": "30%",
      "taxi-turn-min-distance": 12 } },
    // { selector: ".faded", style: { "opacity": 0.12 } },
    { selector: "edge.hl", style: {
      "line-color": "#ffffff", "target-arrow-color": "#ffffff",
      "width": 3.5, "opacity": 1, "z-index": 9 } },
    { selector: "edge.selected-edge", style: {
      "line-color": "#22D2D5", "target-arrow-color": "#22D2D5",
      "width": 3, "opacity": 1, "z-index": 8 } },
    { selector: ".hidden-type", style: { "display": "none" } }
  ],
  layout: LAYOUT,
  wheelSensitivity: 0.2, minZoom: 0.25, maxZoom: 2.5
});

// ---- HTML card overlays (matches the node mockup) ---------------------------
function cardTpl(d) {
  const sup = d.superseded ? " is-superseded" : "";
  const pct = d.pct ? '<span class="gnode__pct">' + d.pct + "</span>" : "";
  return (
    '<div class="gnode' + sup + '" data-gid="' + d.id + '" data-gtype="' + d.type +
      '" style="--accent:' + d.accent + ";--badge-text:" + d.badgeText + '">' +
      '<div class="gnode__head">' +
        '<span class="gnode__badge">' + d.id.toUpperCase() + "</span>" +
        '<span class="gnode__type">' + d.typeLabel + "</span>" +
        pct +
      "</div>" +
      '<div class="gnode__title">' + escapeHtml(d.titleText) + "</div>" +
      '<div class="gnode__body">' + escapeHtml(d.bodyText) + "</div>" +
    "</div>"
  );
}
cy.nodeHtmlLabel([{
  query: "node",
  halign: "center", valign: "center",
  halignBox: "center", valignBox: "center",
  tpl: cardTpl
}]);

// ---- Toolbar ----------------------------------------------------------------
document.getElementById("btnFit").onclick = () => cy.animate({ fit: { padding: 40 }, duration: 250 });
document.getElementById("btnRelayout").onclick = () => cy.layout(LAYOUT).run();

document.getElementById("btnDownload").onclick = async () => {
  const btn = document.getElementById("btnDownload");
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "…";
  try {
    const canvas = await html2canvas(document.querySelector(".graphwrap"), {
      backgroundColor: "#0e1016",
      scale: 2,
      logging: false,
      onclone: (doc) => {
        const toolbar = doc.querySelector(".toolbar");
        if (toolbar) toolbar.style.display = "none";
      }
    });
    const a = document.createElement("a");
    a.download = "thought-graph-" + SESSION.id.slice(0, 8) + ".jpg";
    a.href = canvas.toDataURL("image/jpeg", 0.92);
    a.click();
  } catch (err) {
    console.error(err);
    alert("Could not export image.");
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
};

const app = document.getElementById("app");
const btnTogglePanel = document.getElementById("btnTogglePanel");
btnTogglePanel.onclick = () => {
  const collapsed = app.classList.toggle("panel-collapsed");
  btnTogglePanel.classList.toggle("is-collapsed", collapsed);
  btnTogglePanel.title = collapsed ? "Show step details" : "Hide step details";
  btnTogglePanel.setAttribute("aria-expanded", String(!collapsed));
  requestAnimationFrame(() => {
    cy.resize();
    cy.animate({ fit: { padding: 40 }, duration: 250 });
  });
};

// ---- Hover highlight + selection (events come through the canvas) -----------
cy.on("mouseover", "node", (e) => {
  const nb = e.target.closedNeighborhood();
  cy.elements().addClass("faded");
  nb.removeClass("faded").addClass("hl");
  highlightIds(new Set(nb.nodes().map((n) => n.id())));
});
cy.on("mouseout", "node", clearHighlight);

const detail = document.getElementById("detail");

function selectCard(id) {
  allCards().forEach((el) =>
    el.classList.toggle("is-selected", !!id && el.dataset.gid === id));
  cy.edges().removeClass("selected-edge");
  if (id) cy.getElementById(id).connectedEdges().addClass("selected-edge");
}
function showNode(n) {
  const color = TYPE_COLORS[n.type] || "#888";
  let html = "";
  html += '<span class="tag" style="background:' + color + ';color:' + badgeTextOn(color) + '">' + (TYPE_LABELS[n.type] || n.type) + '</span> ';
  html += '<span class="nid">' + n.id + '</span>';
  html += '<h3 style="margin:10px 0 0;font-size:16px;font-weight:600">' + escapeHtml(n.title) + '</h3>';
  if (n.status === "superseded")
    html += '<div class="field" style="color:#e0a84a">⚠ Superseded by a later revision.</div>';
  if (typeof n.confidence === "number") {
    html += '<div class="field">Confidence ' + Math.round(n.confidence * 100) + '%</div>';
    html += '<div class="conf-track"><div class="conf-fill" style="width:' +
      Math.round(n.confidence * 100) + '%;background:' + color + '"></div></div>';
  }
  if (n.branch) html += '<div class="field">Branch: ' + escapeHtml(n.branch) + '</div>';
  if (n.parents && n.parents.length) html += '<div class="field">Depends on: ' + n.parents.join(", ") + '</div>';
  if (n.revisionOf) html += '<div class="field">Revises: ' + n.revisionOf + '</div>';
  html += '<div class="content">' + escapeHtml(n.content) + '</div>';
  html += '<button class="copy" id="copyBtn">Copy "revise ' + n.id + '" instruction</button>';
  html += '<div class="hint">To regenerate this step, tell your assistant:<br>' +
          '<code>revise step ' + n.id + ' of session ' + SESSION.id.slice(0,8) + ' — &lt;why&gt;</code></div>';
  detail.innerHTML = html;
  const btn = document.getElementById("copyBtn");
  if (btn) btn.onclick = () => {
    navigator.clipboard.writeText('revise step ' + n.id + ' of session ' + SESSION.id + ' — ');
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = 'Copy "revise ' + n.id + '" instruction', 1200);
  };
}

cy.on("tap", "node", (evt) => {
  selectCard(evt.target.id());
  showNode(evt.target.data("node"));
});

cy.on("tap", (evt) => {
  if (evt.target !== cy) return;
  selectCard(null);
  detail.innerHTML =
    '<p style="color:var(--muted)">Click any node to inspect that reasoning step. Hover a node to highlight its connections.</p>';
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text, { breaks: true, gfm: true }));
}

// ---- Final answer (markdown, below step details) --------------------------
if (SESSION.finalAnswer) {
  const f = document.createElement("details");
  f.className = "final";
  f.open = false;
  f.innerHTML =
    '<summary class="final__summary">' +
      '<span class="final__label">✅ Final answer</span>' +
      '<span class="final__chevron" aria-hidden="true"></span>' +
    "</summary>" +
    "<div class='content md'></div>";
  f.querySelector(".content").innerHTML = renderMarkdown(SESSION.finalAnswer);
  document.getElementById("side").append(f);
}
