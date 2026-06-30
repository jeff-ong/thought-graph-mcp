/**
 * Production deps used by the MCP server process (Node).
 * Graph libraries are npm deps too — copied into session assets/ at runtime.
 */
import "@modelcontextprotocol/sdk/server/mcp.js";
import "@modelcontextprotocol/sdk/server/stdio.js";
import Handlebars from "handlebars";
import { z } from "zod";

void Handlebars;
void z;
