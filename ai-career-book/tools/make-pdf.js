// CDP PDF driver (portable, no libraries).
// Serves the print book over http://127.0.0.1, drives Chrome over the DevTools
// Protocol, waits for mermaid to finish, then writes book.pdf.
//
// Requires only Node >= 18 (built-in fetch + WebSocket) and a local Chrome/Chromium.
// Point CHROME_BIN at a browser if auto-detection fails.
//
// Run: node tools/make-pdf.js        (after node tools/build-print.js)
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const work = path.join(root, '.agnes', 'work');
const outPdf = path.join(root, 'book.pdf');
const HTML_FILE = 'The-Stuck-to-Shipper-print.html';
const HTTP_PORT = 8471;
const CDP_PORT = 9381;

function findChrome() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('No Chrome/Chromium found. Set CHROME_BIN to your browser path.');
}

async function fetchJson(url, opts) { const r = await fetch(url, opts); return r.json(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png'
};

function startHttpServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent((req.url || '/').split('?')[0]);
        if (p === '/') p = '/' + HTML_FILE;
        const fp = path.join(root, p.replace(/^\/+/, ''));
        if (!fp.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
        fs.readFile(fp, (err, data) => {
          if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found ' + p); return; }
          const ext = path.extname(fp).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
          res.end(data);
        });
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    server.on('error', reject);
    server.listen(HTTP_PORT, '127.0.0.1', () => { server.on('error', () => {}); resolve(server); });
  });
}

async function main() {
  const chrome = findChrome();
  const pageHtml = path.join(root, HTML_FILE);
  if (!fs.existsSync(pageHtml)) throw new Error(HTML_FILE + ' missing - run `node tools/build-print.js` first');
  fs.mkdirSync(work, { recursive: true });

  const server = await startHttpServer();
  console.log('http server up on ' + HTTP_PORT);

  const udd = path.join(os.tmpdir(), 'agn-cdp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7));
  fs.mkdirSync(udd, { recursive: true });
  const pageUrl = `http://127.0.0.1:${HTTP_PORT}/${HTML_FILE}`;

  const proc = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-color-profile=srgb', `--user-data-dir=${udd}`,
    `--remote-debugging-port=${CDP_PORT}`
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let chromeErr = '';
  proc.stderr.on('data', d => { chromeErr += d.toString(); });

  let up = false;
  for (let i = 0; i < 80; i++) {
    await sleep(500);
    try { await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/version`); up = true; break; } catch (e) {}
  }
  if (!up) { proc.kill(); server.close(); throw new Error('devtools endpoint not up: ' + chromeErr.slice(0, 300)); }

  const ver = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
  const bws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { bws.onopen = res; bws.onerror = () => rej(new Error('browser ws fail')); });

  let bidc = 0; const bpending = new Map();
  const pageEvents = [];
  let pidc = 0; const ppending = new Map();
  let sessionId = null;
  let loadFired = false;
  const consoleMsgs = [];

  const bsend = (method, params) => {
    const id = ++bidc;
    return new Promise((resolve, reject) => {
      bpending.set(id, { resolve, reject });
      bws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (bpending.has(id)) { bpending.delete(id); reject(new Error('timeout ' + method)); } }, 180000);
    });
  };
  bws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && bpending.has(msg.id)) {
      const { resolve, reject } = bpending.get(msg.id); bpending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
      return;
    }
    if (msg.id && ppending.has(msg.id) && msg.sessionId === sessionId) {
      const { resolve, reject } = ppending.get(msg.id); ppending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
      return;
    }
    if (msg.sessionId === sessionId) {
      if (msg.method === 'Page.loadEventFired') { loadFired = true; pageEvents.push('load'); }
      else if (msg.method === 'Runtime.consoleAPICalled') consoleMsgs.push(msg.params.args.map(a => a.value != null ? String(a.value) : (a.description || '')).join(' '));
      else if (msg.method === 'Runtime.exceptionThrown') consoleMsgs.push('EXCEPTION: ' + JSON.stringify((msg.params.exceptionDetails.exception || {}).description || msg.params.exceptionDetails.text || '').slice(0, 500));
      else if (msg.method === 'Page.javascriptDialogOpening') consoleMsgs.push('DIALOG: ' + msg.params.message);
    }
  };
  const psend = (method, params) => {
    const id = ++pidc;
    return new Promise((resolve, reject) => {
      ppending.set(id, { resolve, reject });
      bws.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => { if (ppending.has(id)) { ppending.delete(id); reject(new Error('timeout ' + method)); } }, 180000);
    });
  };

  const created = await bsend('Target.createTarget', { url: pageUrl });
  const targetId = created.targetId;
  await bsend('Target.setDiscoverTargets', { discover: true });
  const att = await bsend('Target.attachToTarget', { targetId, flatten: true });
  sessionId = att.sessionId;

  await psend('Page.enable');
  await psend('Runtime.enable');
  await psend('Log.enable');

  const expr = `JSON.stringify({
    href: location.href, title: document.title, readyState: document.readyState,
    bookReady: document.body ? document.body.getAttribute('data-book-ready') : 'no-body',
    preCount: document.querySelectorAll('pre.mermaid').length,
    preWithSvg: document.querySelectorAll('pre.mermaid svg, pre.mermaid > div svg').length,
    svgTotal: document.querySelectorAll('svg').length,
    katex: document.querySelectorAll('.katex').length,
    textLen: document.body ? document.body.textContent.length : 0,
    mermaidLoaded: typeof window.mermaid,
    katexLoaded: typeof window.renderMathInElement
  })`;

  const t0 = Date.now();
  let state = null;
  while (Date.now() - t0 < 150000) {
    try {
      const r = await psend('Runtime.evaluate', { expression: expr, returnByValue: true });
      state = JSON.parse(r.result.value);
      if ((state.preWithSvg >= 11) || (state.bookReady === 'true')) break;
      if (state.bookReady === 'false' && state.preCount > 0 && Date.now() - t0 > 30000) break;
    } catch (e) {}
    await sleep(1500);
  }

  // forced re-render last resort
  if (state && state.preWithSvg < 11 && state.preCount > 0) {
    try {
      await psend('Runtime.evaluate', {
        expression: `(async function(){
          if (window.mermaid) {
            window.mermaid.initialize({ startOnLoad:false, theme:'neutral', fontFamily:'Arial, Helvetica, sans-serif', securityLevel:'loose' });
            await window.mermaid.run({ querySelector: 'pre.mermaid' });
          }
          if (window.renderMathInElement) window.renderMathInElement(document.body, { delimiters: [{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}], throwOnError:false });
          return document.querySelectorAll('pre.mermaid svg, pre.mermaid > div svg').length + ' svgs';
        })()`,
        awaitPromise: true, returnByValue: true, timeout: 120000
      });
      await sleep(2500);
      try { const r2 = await psend('Runtime.evaluate', { expression: expr, returnByValue: true }); state = JSON.parse(r2.result.value); } catch (e) {}
    } catch (e) { console.log('forced rerun failed:', String(e.message || e).slice(0, 400)); }
  }

  const probe = { version: 'make-pdf', loadFired, state, consoleMsgs: consoleMsgs.slice(0, 30), chromeErr: chromeErr.slice(0, 300) };

  if (state && state.textLen > 5000 && state.preWithSvg >= 11) {
    try {
      const r = await psend('Page.printToPDF', {
        printBackground: true,
        paperWidth: 8.27, paperHeight: 11.69,
        marginTop: 0.6, marginBottom: 0.6, marginLeft: 0.55, marginRight: 0.55,
        displayHeaderFooter: false
      });
      fs.writeFileSync(outPdf, Buffer.from(r.data, 'base64'));
      probe.pdf = { ok: true, bytes: fs.statSync(outPdf).size, path: outPdf };
    } catch (e) { probe.pdf = { ok: false, error: String(e.message || e).slice(0, 500) }; }
  } else {
    probe.pdf = { ok: false, error: 'preconditions not met: textLen=' + (state && state.textLen) + ' svgs=' + (state && state.preWithSvg) + ' href=' + (state && state.href) };
  }

  fs.writeFileSync(path.join(work, 'make-pdf-result.json'), JSON.stringify(probe, null, 2));
  console.log(JSON.stringify(probe, null, 2));

  try { await bsend('Target.closeTarget', { targetId }); } catch (e) {}
  bws.close();
  proc.kill();
  server.close();
  try { fs.rmSync(udd, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {}
  process.exit(probe.pdf && probe.pdf.ok ? 0 : 1);
}

main().catch(e => { console.log('FATAL:', String(e && e.stack || e)); process.exit(1); });
