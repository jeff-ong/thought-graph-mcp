import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const outDir = path.join(projectRoot, "docs/bundle-analysis");
const reportHtml = path.join(outDir, "treemap.html");
const reportPng = path.join(outDir, "treemap.png");
const summaryPath = path.join(outDir, "summary.json");

const summary = JSON.parse(await readFile(summaryPath, "utf8"));

function captionHtml(data) {
  const rows = data.regions
    .map(
      (r) =>
        `<tr>
          <td><code>${r.label}</code></td>
          <td>${r.gzipLabel}</td>
          <td>${r.sharePct}%</td>
        </tr>`,
    )
    .join("");

  return `
    <div id="bundle-size-caption">
      <h1>npx install footprint (gzip)</h1>
      <table>
        <thead>
          <tr><th>Bundle</th><th>gzip</th><th>share</th></tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total">
            <td><strong>Total (production deps)</strong></td>
            <td><strong>${data.totalGzipLabel}</strong></td>
            <td>100%</td>
          </tr>
        </tbody>
      </table>
      <p class="hint">Treemap below · open treemap.html to drill into packages</p>
    </div>
  `;
}

const captionCss = `
  #bundle-size-caption {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 20px 24px 12px;
    color: #1a1a1a;
    background: #fafafa;
    border-bottom: 1px solid #e0e0e0;
  }
  #bundle-size-caption h1 {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
  }
  #bundle-size-caption table {
    border-collapse: collapse;
    font-size: 14px;
  }
  #bundle-size-caption th,
  #bundle-size-caption td {
    padding: 6px 20px 6px 0;
    text-align: left;
  }
  #bundle-size-caption th {
    color: #666;
    font-weight: 500;
  }
  #bundle-size-caption tr.total td {
    padding-top: 10px;
    border-top: 1px solid #ddd;
  }
  #bundle-size-caption .hint {
    margin: 10px 0 0;
    font-size: 12px;
    color: #888;
  }
  body { margin: 0; background: #fafafa; }
  #app { min-height: 520px; }
`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 980 },
  });
  await page.goto(`file://${reportHtml}`, { waitUntil: "load" });
  await page.addStyleTag({ content: captionCss });
  await page.evaluate((html) => {
    document.body.insertAdjacentHTML("afterbegin", html);
  }, captionHtml(summary));
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#app canvas");
      return canvas instanceof HTMLCanvasElement && canvas.width > 100;
    },
    { timeout: 60_000 },
  );
  await page.waitForTimeout(750);
  await page.locator("body").screenshot({ path: reportPng });
  console.log(`Wrote ${reportPng}`);
} finally {
  await browser.close();
}
