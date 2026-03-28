/**
 * Markdown to PDF converter with Mermaid diagram support
 * Uses Playwright (Chromium) to render Mermaid diagrams and generate PDF
 * All resources loaded locally (no CDN dependency)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
import { marked } from 'marked';

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node md-to-pdf.mjs <input.md> [output.pdf]');
  process.exit(1);
}

const outputFile = process.argv[3] || inputFile.replace(/\.md$/, '.pdf');
const mdContent = readFileSync(resolve(inputFile), 'utf-8');

// Load mermaid.js from local node_modules
const mermaidJs = readFileSync(
  resolve('node_modules/mermaid/dist/mermaid.min.js'),
  'utf-8'
);

// Convert markdown to HTML, keeping mermaid code blocks as-is
const renderer = new marked.Renderer();
renderer.code = function ({ text, lang }) {
  if (lang === 'mermaid') {
    return `<pre class="mermaid">${text}</pre>`;
  }
  return `<pre><code class="language-${lang || ''}">${text}</code></pre>`;
};

marked.setOptions({ renderer });
const htmlBody = marked.parse(mdContent);

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }

  body {
    font-family: sans-serif;
    font-size: 11pt;
    line-height: 1.8;
    color: #1a1a2e;
    margin: 0;
    padding: 40px 50px;
    background: #fff;
  }

  h1 {
    font-size: 24pt;
    font-weight: 700;
    color: #16213e;
    border-bottom: 3px solid #667eea;
    padding-bottom: 12px;
    margin-top: 0;
    margin-bottom: 30px;
    text-align: center;
  }

  h2 {
    font-size: 16pt;
    font-weight: 700;
    color: #16213e;
    border-left: 5px solid #667eea;
    padding-left: 14px;
    margin-top: 36px;
    margin-bottom: 16px;
    page-break-after: avoid;
  }

  h3 {
    font-size: 13pt;
    font-weight: 600;
    color: #2d3748;
    margin-top: 24px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }

  h4 {
    font-size: 11pt;
    font-weight: 600;
    color: #4a5568;
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }

  p { margin: 8px 0; }

  strong { color: #16213e; }

  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 30px 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }

  thead {
    background: #667eea;
    color: #fff;
  }

  th {
    padding: 10px 14px;
    text-align: left;
    font-weight: 500;
    white-space: nowrap;
  }

  td {
    padding: 9px 14px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }

  tr:nth-child(even) { background: #f7f8fc; }

  .mermaid {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 20px auto;
    padding: 16px;
    background: #f8f9ff;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    page-break-inside: avoid;
    overflow: hidden;
    max-height: 500px;
  }

  .mermaid svg {
    max-width: 100%;
    max-height: 460px;
    height: auto;
  }

  pre:not(.mermaid) {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px 16px;
    font-size: 9pt;
    overflow-x: auto;
  }

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 9.5pt;
  }

  h2 { page-break-before: auto; }
  table, .mermaid, pre { page-break-inside: avoid; }
</style>
</head>
<body>
${htmlBody}
<script>${mermaidJs}</script>
<script>
  mermaid.initialize({
    startOnLoad: true,
    theme: 'base',
    themeVariables: {
      primaryColor: '#667eea',
      primaryTextColor: '#fff',
      primaryBorderColor: '#5a67d8',
      lineColor: '#718096',
      secondaryColor: '#764ba2',
      tertiaryColor: '#4ecdc4',
      fontSize: '13px'
    },
    flowchart: { htmlLabels: true, curve: 'basis' },
    sequence: { mirrorActors: false }
  });
</script>
</body>
</html>`;

console.log('Launching browser...');
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();

// Use domcontentloaded since no external resources
await page.setContent(html, { waitUntil: 'domcontentloaded' });

// Wait for Mermaid to finish rendering
await page.waitForFunction(() => {
  const diagrams = document.querySelectorAll('.mermaid');
  if (diagrams.length === 0) return true;
  return Array.from(diagrams).every(
    d => d.querySelector('svg') || d.getAttribute('data-processed') === 'true'
  );
}, { timeout: 30000 }).catch(() => {
  console.warn('Warning: Some Mermaid diagrams may not have rendered.');
});

// Wait a bit for rendering to stabilize
await page.waitForTimeout(3000);

const diagramCount = await page.evaluate(() => {
  return {
    total: document.querySelectorAll('.mermaid').length,
    rendered: document.querySelectorAll('.mermaid svg').length,
  };
});
console.log(`Mermaid diagrams: ${diagramCount.rendered}/${diagramCount.total} rendered`);

console.log('Generating PDF...');
await page.pdf({
  path: resolve(outputFile),
  format: 'A4',
  margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;text-align:center;font-size:9px;color:#999;font-family:sans-serif;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});

await browser.close();
console.log(`PDF saved to: ${resolve(outputFile)}`);
