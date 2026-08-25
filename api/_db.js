/**
 * SQLite connection — libSQL client ke through.
 *
 * Ek hi code do jagah chalta hai:
 *   LOCAL   DATABASE_URL=file:local.db          -> asli SQLite file disk par
 *   VERCEL  DATABASE_URL=libsql://...turso.io   -> Turso (hosted SQLite)
 *           DATABASE_AUTH_TOKEN=...
 *
 * Vercel par seedhi file isliye nahi chalti kyunki uska filesystem har
 * request/deploy par reset ho jata hai — ticks ud jate.
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

/** Table pehli baar me bana deta hai. Baar-baar call karna safe hai. */
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
      schemaReady = null; // agli baar dobara koshish ho sake
      throw e;
    });
  }
  return schemaReady;
}


/** Vercel body de deta hai; local/raw case ke liye fallback. */
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
