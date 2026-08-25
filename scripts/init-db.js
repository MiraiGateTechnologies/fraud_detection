/** Table bana deta hai aur ginti dikhata hai. `npm run db:init` */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const { ensureSchema, getClient, dbMode } = await import("../api/_db.js");
await ensureSchema();
const db = getClient();
const r = await db.execute("SELECT COUNT(*) AS n FROM ticks");
console.log("  mode   :", dbMode());
console.log("  url    :", process.env.DATABASE_URL);
console.log("  ticks  :", r.rows[0].n);
console.log("  OK — table ready.");
