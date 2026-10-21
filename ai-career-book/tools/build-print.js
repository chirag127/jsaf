// Build ONE combined print book at the PROJECT ROOT so file:// works reliably.
// Portable: resolves paths relative to this file's location (ai-career-book/).
// Run: node tools/build-print.js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "The-Stuck-to-Shipper-print.html");

const posts = fs.readdirSync(path.join(root, "posts"))
  .filter((f) => f.endsWith(".html"))
  .sort();

function article(html) {
  const m = html.match(/<article>([\s\S]*?)<\/article>/);
  if (!m) throw new Error("no <article>");
  return m[1].trim();
}

let body = "";
let mm = 0;
for (const f of posts) {
  const art = article(fs.readFileSync(path.join(root, "posts", f), "utf8"));
  mm += (art.match(/class="mermaid"/g) || []).length;
  body += '<section class="print-article">\n' + art + "\n</section>\n";
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Stuck to Shipper - full book (single PDF)</title>
<link rel="stylesheet" href="./css/main.css">
<style>
/* Single-PDF combined-book overrides */
@media print {
  section.print-article { break-before: page; }
  pre.mermaid { white-space: normal; text-align: center; }
  pre.mermaid > div, pre.mermaid svg, .mermaid svg {
    max-width: 100%; height: auto; display: block; margin: 0 auto;
    background: #ffffff;
  }
}
</style>
<!-- Blocking local UMD scripts: mermaid + katex present at DOMContentLoaded -->
<script src="./lib/mermaid.min.js"></script>
<script src="./lib/katex.min.js"></script>
<script src="./lib/katex-auto-render.min.js"></script>
</head>
<body class="print-book">
<main>
<section class="print-article book-titlepage">
  <h1>The Stuck to Shipper</h1>
  <p class="lead">Career Playbook for an AI Era - complete book, all 12 articles. Print edition.</p>
</section>
${body}
</main>
<script>
document.addEventListener("DOMContentLoaded", function () {
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$",  right: "$",  display: false }
      ],
      throwOnError: false
    });
  }
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      fontFamily: "Arial, Helvetica, sans-serif",
      securityLevel: "loose"
    });
    window.mermaid.run().then(function () {
      document.body.setAttribute("data-book-ready", "true");
    }, function (e) {
      console.error("mermaid fail", e);
      document.body.setAttribute("data-book-ready", "false");
    });
  }
});
</script>
</body>
</html>
`;

fs.writeFileSync(out, html);
console.log(JSON.stringify({ out, articles: posts.length, mermaidBlocks: mm, kb: Math.round(Buffer.byteLength(html)/1024) }));
