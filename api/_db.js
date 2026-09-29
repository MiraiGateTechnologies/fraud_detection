/**
 * SQLite connection through the libSQL client.
 *
 * The same code runs in two places:
 *   LOCAL   DATABASE_URL=file:local.db          -> a real SQLite file on disk
 *   VERCEL  DATABASE_URL=libsql://...turso.io   -> Turso (hosted SQLite)
 *           DATABASE_AUTH_TOKEN=...
 *
 * A plain file does not work on Vercel because its filesystem is reset on every
 * request and deploy, so the ticks would be lost.
 */
import { createClient } from "@libsql/client";

let client = null;
let schemaReady = null;

/** "none" | "local-file" | "turso" */
export function dbMode() {
  const url = process.env.DATABASE_URL || "";
  if (!url) return "none";
  return url.startsWith("file:") ? "local-file" : "turso";
}

export function getClient() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  return client;
}

/** Creates the table the first time. Safe to call repeatedly. */
export function ensureSchema() {
  const db = getClient();
  if (!db) return Promise.resolve(false);
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(
        `CREATE TABLE IF NOT EXISTS ticks (
           user_id   INTEGER PRIMARY KEY,
           user_code TEXT,
           name      TEXT,
           marked_by TEXT,
           marked_at TEXT NOT NULL
         )`
      );
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_ticks_marked_at ON ticks(marked_at)`
      );
      return true;
    })().catch((e) => {
      schemaReady = null; // allow a retry next time
      throw e;
    });
  }
  return schemaReady;
}


/** Vercel provides the parsed body; this is the fallback for local/raw requests. */
export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}
