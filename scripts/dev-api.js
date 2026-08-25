/**
 * Local dev API — `vercel dev` ke bina bhi /api/ticks chalane ke liye.
 *
 *   npm run dev:api      (port 3001)
 *   npm run dev          (Vite 5173, /api ko 3001 par proxy karta hai)
 *
 * Vercel par ye file kabhi nahi chalti — wahan api/ticks.js seedhe serverless
 * function ban jata hai. Logic dono jagah ek hi hai.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

/* .env padho (chhota loader — dotenv dependency se bachne ke liye) */
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "file:local.db";

const { default: ticks } = await import("../api/ticks.js");

const PORT = Number(process.env.DEV_API_PORT || 3001);

http
  .createServer(async (req, res) => {
    if (!req.url.startsWith("/api/ticks")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: "not-found" }));
      return;
    }
    /* Vercel-style helpers */
    res.status = (c) => {
      res.statusCode = c;
      return res;
    };
    res.json = (o) => {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(o));
      return res;
    };
    try {
      await ticks(req, res);
    } catch (e) {
      res.status(500).json({ ok: false, reason: "handler-crash", error: String(e) });
    }
  })
  .listen(PORT, () => {
    console.log(`  dev API   : http://localhost:${PORT}/api/ticks`);
    console.log(`  DATABASE_URL = ${process.env.DATABASE_URL}`);
  });
