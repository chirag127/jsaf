// ============================================================
//  AI Career Blog — runtime: KaTeX auto-render + Mermaid init
//  Pinned CDN versions so the site never breaks silently.
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  // --- KaTeX auto-render (if the CDN scripts loaded) ---
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$",  right: "$",  display: false },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  }

  // --- Mermaid: run when the ESM module is ready ---
  window.addEventListener("load", function () {
    if (window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: true,
        theme: "neutral",            // print-safe black-and-white shapes
        fontFamily: "Arial, Helvetica, sans-serif",
        securityLevel: "loose"
      });
      // ensure late-injected diagrams render
      window.mermaid.run();
    }
  });

  // --- PDF export helper (button on each post, .no-print) ---
  var btn = document.getElementById("export-pdf");
  if (btn) {
    btn.addEventListener("click", function () {
      // wait for any JS-rendered content (mermaid / katex) before print
      var done = function () { window.print(); };
      if (window.mermaid && window.mermaid.run) {
        window.mermaid.run().then(done, done);
      } else {
        done();
      }
    });
  }
});
