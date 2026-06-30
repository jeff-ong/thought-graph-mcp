/**
 * Webpack entry mirroring the graph HTML runtime (_vendor + _graph).
 * Used only for bundle analysis — not shipped to users.
 */
import cytoscape from "cytoscape";
import dagre from "dagre";
import cytoscapeDagre from "cytoscape-dagre";
import cytoscapeNodeHtmlLabel from "cytoscape-node-html-label";
import { marked } from "marked";
import DOMPurify from "dompurify";
import html2canvas from "html2canvas";

import "../../templates/graph.css";
import graphClient from "../../templates/graph.client.js";

cytoscape.use(cytoscapeDagre);
cytoscapeNodeHtmlLabel(cytoscape);

void dagre;
void marked;
void DOMPurify;
void html2canvas;
void graphClient;
