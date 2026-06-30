const path = require("node:path");

const outDir = path.resolve(__dirname, "docs/bundle-analysis/dist");

/** @type {import('webpack').Configuration[]} */
module.exports = [
  {
    name: "mcp-server",
    mode: "production",
    target: "node",
    entry: path.resolve(__dirname, "src/dev/webpack/mcp-server-entry.js"),
    output: {
      path: path.join(outDir, "mcp-server"),
      filename: "mcp-server.js",
      clean: false,
    },
    performance: { hints: false },
  },
  {
    name: "graph-runtime",
    mode: "production",
    target: "web",
    entry: path.resolve(__dirname, "src/dev/webpack/graph-viewer-entry.js"),
    output: {
      path: path.join(outDir, "graph-runtime"),
      filename: "graph-runtime.js",
      clean: false,
    },
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /graph\.client\.js$/,
          type: "asset/source",
        },
      ],
    },
    performance: { hints: false },
  },
];
