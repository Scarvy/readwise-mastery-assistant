// Zero-dependency local dev server for iterating on the flashcard system
// prompt. Proxies the Readwise export API and the Anthropic API (avoiding
// browser CORS issues) and serves the UI in public/.
//
// Usage:
//   add READWISE_ACCESS_TOKEN and ANTHROPIC_API_KEY to a .env file at the
//   project root, then:
//   node eval/server.js
//   open http://127.0.0.1:8787

const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  DEFAULT_SYSTEM_PROMPT,
  buildUserMessage,
  parseSuggestions,
  callAnthropic,
} = require("./lib/prompting");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const HIGHLIGHTS_PATH = path.join(DATA_DIR, "highlights.json");
const SCORES_PATH = path.join(DATA_DIR, "scores.jsonl");

const PORT = 8787;
const READWISE_EXPORT_URL = "https://readwise.io/api/v2/export/";
const MAX_EXPORT_PAGES = 5;
const MIN_HIGHLIGHT_LENGTH = 30;

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
};

const ENV_PATH = path.join(ROOT, "..", ".env");
if (fs.existsSync(ENV_PATH)) {
  process.loadEnvFile(ENV_PATH);
}

function loadConfig() {
  const { READWISE_ACCESS_TOKEN, ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = process.env;
  if (!READWISE_ACCESS_TOKEN || !ANTHROPIC_API_KEY) {
    throw new Error(
      "Missing READWISE_ACCESS_TOKEN or ANTHROPIC_API_KEY - add them to a .env file at the project root.",
    );
  }
  return {
    readwiseToken: READWISE_ACCESS_TOKEN,
    anthropicApiKey: ANTHROPIC_API_KEY,
    anthropicModel: ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSONBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJSON(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}

function serveStatic(req, res) {
  const pathname = req.url === "/" ? "/index.html" : req.url;
  const resolved = path.join(PUBLIC_DIR, pathname);
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(resolved, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved);
    res.writeHead(200, { "content-type": CONTENT_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

async function fetchHighlights(config) {
  const highlights = [];
  let pageCursor;
  let pages = 0;

  do {
    const url = new URL(READWISE_EXPORT_URL);
    if (pageCursor) url.searchParams.set("pageCursor", pageCursor);

    const response = await fetch(url, {
      headers: { Authorization: `Token ${config.readwiseToken}` },
    });

    if (!response.ok) {
      throw new Error(`Readwise export API error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    for (const book of data.results || []) {
      for (const h of book.highlights || []) {
        if (!h.text || h.text.trim().length < MIN_HIGHLIGHT_LENGTH) continue;
        highlights.push({
          id: h.id,
          text: h.text,
          note: h.note || "",
          title: book.title,
          author: book.author,
          category: book.category,
        });
      }
    }

    pageCursor = data.nextPageCursor;
    pages += 1;
  } while (pageCursor && pages < MAX_EXPORT_PAGES);

  return highlights;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/default-prompt") {
      sendJSON(res, 200, { systemPrompt: DEFAULT_SYSTEM_PROMPT });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/highlights") {
      ensureDataDir();
      const highlights = fs.existsSync(HIGHLIGHTS_PATH)
        ? JSON.parse(fs.readFileSync(HIGHLIGHTS_PATH, "utf8"))
        : [];
      sendJSON(res, 200, { highlights });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/highlights/refresh") {
      const config = loadConfig();
      const highlights = await fetchHighlights(config);
      ensureDataDir();
      fs.writeFileSync(HIGHLIGHTS_PATH, JSON.stringify(highlights, null, 2));
      sendJSON(res, 200, { highlights });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      const config = loadConfig();
      const { highlight, systemPrompt } = await readJSONBody(req);
      const userContent = buildUserMessage({
        highlightText: highlight.text,
        noteText: highlight.note,
        sourceTitle: highlight.title,
        sourceAuthor: highlight.author,
      });
      const text = await callAnthropic({
        apiKey: config.anthropicApiKey,
        model: config.anthropicModel || "claude-haiku-4-5-20251001",
        systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        userContent,
      });
      sendJSON(res, 200, { suggestions: parseSuggestions(text) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/scores") {
      ensureDataDir();
      const scores = fs.existsSync(SCORES_PATH)
        ? fs
            .readFileSync(SCORES_PATH, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : [];
      sendJSON(res, 200, { scores });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/scores") {
      const body = await readJSONBody(req);
      ensureDataDir();
      const record = { ...body, savedAt: new Date().toISOString() };
      fs.appendFileSync(SCORES_PATH, JSON.stringify(record) + "\n");
      sendJSON(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    sendJSON(res, 404, { error: "not-found" });
  } catch (err) {
    sendJSON(res, 500, { error: String(err?.message || err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Prompt eval tool running at http://127.0.0.1:${PORT}`);
});
