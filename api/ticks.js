/**
 * /api/ticks — store for "Confirmed fraud" ticks.
 *
 *   GET     -> { ok, persistent, ticks: [...] }
 *   POST    -> body { userId, userCode, name, on, markedBy }   add or remove a tick
 *   DELETE  -> remove all ticks
 *
 * On purpose, responses reveal nothing about the setup: not the database type or URL,
 * not whether login is on, and not the real SQL error. The client only learns whether
 * a tick was saved permanently. The real error goes to the server log (Vercel -> Logs).
 */
import { getClient, ensureSchema, dbMode, readBody } from "./_db.js";

function fail(res, status) {
  res.status(status).json({ ok: false, persistent: false, ticks: [] });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (dbMode() === "none") {
    // No database configured -> the page keeps working with browser-only ticks
    res.status(200).json({ ok: false, persistent: false, ticks: [] });
    return;
  }

  try {
    await ensureSchema();
    const db = getClient();

    if (req.method === "GET") {
      const r = await db.execute(
        "SELECT user_id, user_code, name, marked_by, marked_at FROM ticks ORDER BY marked_at DESC"
      );
      res.status(200).json({ ok: true, persistent: true, ticks: r.rows });
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const userId = Number(body.userId);
      if (!Number.isInteger(userId)) {
        fail(res, 400);
        return;
      }
      if (body.on) {
        await db.execute({
          sql: `INSERT INTO ticks (user_id, user_code, name, marked_by, marked_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                  user_code = excluded.user_code,
                  name      = excluded.name,
                  marked_by = excluded.marked_by,
                  marked_at = excluded.marked_at`,
          args: [
            userId,
            String(body.userCode || "").slice(0, 80),
            String(body.name || "").slice(0, 120),
            String(body.markedBy || "").slice(0, 80) || null,
            new Date().toISOString(),
          ],
        });
      } else {
        await db.execute({ sql: "DELETE FROM ticks WHERE user_id = ?", args: [userId] });
      }
      const r = await db.execute("SELECT COUNT(*) AS n FROM ticks");
      res.status(200).json({ ok: true, persistent: true, total: r.rows[0].n });
      return;
    }

    if (req.method === "DELETE") {
      await db.execute("DELETE FROM ticks");
      res.status(200).json({ ok: true, persistent: true, cleared: true });
      return;
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    fail(res, 405);
  } catch (e) {
    // details go to the server log only, never to the response
    console.error("[/api/ticks]", req.method, e);
    fail(res, 500);
  }
}
