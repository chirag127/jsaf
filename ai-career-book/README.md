# Stuck to Shipper — an AI-era career field manual

A 12-article blog + book for one reader: an Indian IT professional in a TCS SAP
CPQ support role, moving into AI careers by 2027.

- **Blog site** — plain static HTML, hosted on GitHub Pages. No build step, no
  framework, no tracking. KaTeX (math) and Mermaid (diagrams) load from pinned
  CDNs and render in the browser.
- **`book.md`** — the full book, a clean concatenation of all 12 articles. It is
  the single source of truth for the text; the HTML posts mirror it.
- **Print / PDF** — every post has a "Save as PDF" button. Print CSS is
  print-safe: A4 page geometry, no dark-mode leak, tables never split a row,
  diagram and code blocks keep to one page.

## What's here

```
index.html           home page + reading order
404.html             custom not-found
posts/               one file per article (01..12)
css/main.css         screen + dark + print styling
js/app.js            KaTeX auto-render + Mermaid init + PDF export helper
book.md              the whole book as one Markdown file
```

## Run it locally

No server needed. Open `index.html` directly in a browser. The KaTeX and
Mermaid CDNs load over HTTPS.

For clean relative-link behavior that matches GitHub Pages, serve the folder:

```
npx serve .
# or: python -m http.server 8080
```

## Deploy to GitHub Pages

The folder is a ready-to-push static site. Two options.

**Option A — user/organization site** (`you.github.io`)
1. Create a repo named exactly `you.github.io`.
2. Push the contents of this folder to the repo's default branch.
3. GitHub Pages serves `index.html` at the root. Done.

**Option B — project site** (`you.github.io/repo-name/`)
1. Create any repo, push this folder to a branch (e.g. `gh-pages` or `main`).
2. Repo → Settings → Pages → Build and deployment → Source: *Deploy from a
   branch* → pick the branch and `/ (root)`.
3. The site publishes at `you.github.io/repo-name/`.

Because every link is **relative** (`./posts/…`, `../css/…`), the same folder
works as either a user site or a project site. No path rewrites needed.

### Custom domain (optional)

Add a `CNAME` file with the domain. Point DNS and let GitHub handle HTTPS.
Configure `www` even if you also use the apex.

## Converting to PDF

Each article has a "Save as PDF" button (`js/app.js`). It calls `window.print()`
after Mermaid has rendered, so diagrams appear in the PDF. The print stylesheet
forces a light theme, so a dark-mode preference never leaks into the output.

To export the whole book as one PDF, print `book.md` from a Markdown viewer, or
open the site and print each article in turn.

## TTS-friendliness

The prose is written for text-to-speech: one idea per sentence, short
sentences, plain words, headings that stand alone when spoken, no dense
parentheticals. Any screen reader or TTS engine can navigate the 12 posts as 12
chapters.

## Accuracy note

Salary figures are indicative ranges from public aggregators, as of October
2026. Legal content is informational, not legal advice. Verify both before
acting.
