# -*- coding: utf-8 -*-
"""
Fraud review panel: web app and API.

  python server.py                 # http://127.0.0.1:8080

Environment:
  PANEL_HOST, PANEL_PORT   where to listen (default 127.0.0.1 and 8080)
  PANEL_DATA               data folder (default ./data, built by build_data.py)

data/activity.db and data/dashboard.json are rebuilt by build_data.py.
Reviewer decisions live in data/review.db and are kept across rebuilds.

Every page and API call needs a signed-in reviewer. Accounts and sessions live in data/users.db
and are managed with accounts.py (python accounts.py add <name>).
"""
from __future__ import annotations

import csv
import io
import json
import math
import os
import sqlite3
import threading
import zlib
from array import array
from contextlib import closing
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import accounts

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("PANEL_DATA", os.path.join(HERE, "data"))
WEB = os.path.join(HERE, "web")
IST = timezone(timedelta(hours=5, minutes=30))

app = FastAPI(title="Fraud Review", docs_url=None, redoc_url=None, openapi_url=None)


# ------------------------------------------------------------------ sign-in
COOKIE = "panel_session"
OPEN_PATHS = {"/login", "/api/login", "/api/logout", "/static/styles.css", "/static/login.js"}


def client_ip(request: Request):
    """nginx passes the visitor's address in X-Real-IP. The app itself listens on 127.0.0.1 only."""
    return (request.headers.get("x-real-ip") or (request.client.host if request.client else ""))[:64]


def same_origin(request: Request):
    """Browsers mark each request with Sec-Fetch-Site. Requests that change data are refused when another
    site (another subdomain included) started them. This holds behind a load balancer or CDN too."""
    return request.headers.get("sec-fetch-site", "same-origin") in ("same-origin", "none")


def cookie_secure(request: Request):
    """HTTPS-only cookie when nginx received the request over HTTPS."""
    return request.headers.get("x-forwarded-proto") == "https"


SIGNED_OUT = {
    "ended": "Your session has ended. Sign in again.",
    "replaced": "You were signed out because this account signed in on another browser.",
}


@app.middleware("http")
async def require_sign_in(request: Request, call_next):
    if request.method not in ("GET", "HEAD") and not same_origin(request):
        return JSONResponse({"detail": "This request came from another site and was refused."}, status_code=403)
    path = request.url.path
    user, why = accounts.session_state(request.cookies.get(COOKIE), touch=path != "/api/session")
    request.state.user = user
    if user or path in OPEN_PATHS:
        return await call_next(request)
    if path.startswith("/api/"):
        return JSONResponse({"detail": SIGNED_OUT.get(why, "Sign in to use the panel."), "reason": why or "signin"}, status_code=401)
    return RedirectResponse("/login?%s=1" % why if why else "/login", status_code=303)


class LoginIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


@app.post("/api/login")
def login(body: LoginIn, request: Request):
    name, ip = body.name.strip(), client_ip(request)
    wait = accounts.wait_seconds(name, ip)
    if wait > 0:
        minutes = max(1, math.ceil(wait / 60))
        raise HTTPException(429, "Too many failed attempts. Try again in %d minute%s." % (minutes, "" if minutes == 1 else "s"))
    user = accounts.check_login(name, body.password, ip)
    if not user:
        raise HTTPException(401, "The user name or password is incorrect.")
    token = accounts.new_session(user, ip, request.headers.get("user-agent"))
    res = JSONResponse({"user": user})
    res.set_cookie(COOKIE, token, max_age=accounts.SESSION_MAX, path="/", httponly=True, samesite="lax", secure=cookie_secure(request))
    return res


@app.post("/api/logout")
def logout(request: Request):
    accounts.end_session(request.cookies.get(COOKIE))
    res = JSONResponse({"ok": True})
    res.delete_cookie(COOKIE, path="/", httponly=True, samesite="lax", secure=cookie_secure(request))
    return res


@app.get("/api/me")
def me(request: Request):
    return {"user": request.state.user}


@app.get("/api/session")
def session(request: Request):
    """Checked by the open panel every 30 seconds. Does not count as activity."""
    return {"user": request.state.user}


# ------------------------------------------------------------------ activity (statements and bets)
def activity_path():
    path = os.path.join(DATA, "activity.db")
    if not os.path.exists(path):
        raise HTTPException(503, "Activity data has not been built yet. Run build_data.py.")
    return path


def activity_db():
    return sqlite3.connect("file:%s?mode=ro" % activity_path().replace("\\", "/"), uri=True)


@lru_cache(maxsize=48)
def user_activity(section: int, uid: str, stamp: float):
    """Decoded statements and bets of one user. `stamp` (file time) drops the cache after a rebuild."""
    with closing(activity_db()) as db:
        row = db.execute("SELECT blob FROM users WHERE section = ? AND uid = ?", (section, uid)).fetchone()
    return json.loads(zlib.decompress(row[0])) if row else None


def pick(rows, start, end, idx):
    if idx is not None:
        return [rows[i] for i in array("I", idx)]
    return rows[start:end]


def statement_summary(rows):
    out = {}
    for t, kind, _desc, amount, _bal in rows:
        s = out.setdefault(kind, [0, 0.0])
        s[0] += 1
        s[1] += amount or 0
    return {str(k): {"n": v[0], "sum": round(v[1], 2)} for k, v in out.items()}


def bet_summary(rows):
    out = {"back": 0, "lay": 0, "stake": 0.0, "pl": 0.0, "markets": {}}
    for r in rows:
        out["back" if r[4] == 1 else "lay"] += r[4] in (0, 1)
        out["stake"] += r[7] or 0
        out["pl"] += r[8] or 0
        out["markets"][str(r[2])] = out["markets"].get(str(r[2]), 0) + 1
    out["stake"], out["pl"] = round(out["stake"], 2), round(out["pl"], 2)
    return out


@app.get("/api/activity")
def activity(section: int = Query(1, ge=1, le=1), key: str = Query(..., min_length=1, max_length=64),
             tab: Literal["statements", "bets"] = "statements", offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
             order: Literal["asc", "desc"] = "desc", type: Optional[int] = Query(None, ge=0, le=5), q: str = Query("", max_length=80),
             side: Optional[int] = Query(None, ge=0, le=1), market: Optional[int] = Query(None, ge=1, le=9)):
    stamp = os.path.getmtime(activity_path())
    with closing(activity_db()) as db:
        req = db.execute("SELECT uid, flag, s0, s1, b0, b1, s_idx, b_idx FROM requests WHERE record_id = ?", (key,)).fetchone()
    if not req:
        return {"available": False}
    uid, flag, s0, s1, b0, b1, s_idx, b_idx = req
    data = user_activity(section, uid, stamp)
    if data is None:
        return {"available": False}
    rows = pick(data["s"], s0, s1, s_idx) if tab == "statements" else pick(data["b"], b0, b1, b_idx)
    window = {"to": flag}
    if tab == "statements":
        summary = statement_summary(rows)
        if rows:
            window["from"] = rows[0][0]
        needle = q.strip().lower()
        sel = [r for r in rows if (type is None or r[1] == type) and (not needle or needle in (r[2] or "").lower())]
    else:
        summary = bet_summary(rows)
        rows = [[i + 1] + r for i, r in enumerate(rows)]  # keep the bet's place in the sequence
        needle = q.strip().lower()
        sel = [r for r in rows if (side is None or r[5] == side) and (market is None or r[3] == market)
               and (not needle or needle in (r[4] or "").lower() or needle in str(r[12] or "").lower() or needle in (r[2] or ""))]
    if order == "desc":
        sel.reverse()
    return {"available": True, "count": len(rows), "total": len(sel), "offset": offset, "rows": sel[offset:offset + limit],
            "summary": summary, "window": window}


# ------------------------------------------------------------------ reviewer decisions
_lock = threading.Lock()


def review_db():
    os.makedirs(DATA, exist_ok=True)
    db = sqlite3.connect(os.path.join(DATA, "review.db"))
    db.executescript("""
        CREATE TABLE IF NOT EXISTS decisions (
            player TEXT PRIMARY KEY, user_id INTEGER, code TEXT, section INTEGER, record_id TEXT,
            decision TEXT NOT NULL, reason TEXT NOT NULL, reviewer TEXT NOT NULL, score REAL, at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS decision_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, player TEXT, user_id INTEGER, code TEXT, section INTEGER, record_id TEXT,
            decision TEXT, reason TEXT, reviewer TEXT, score REAL, at TEXT);
        CREATE TABLE IF NOT EXISTS pattern_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, pattern TEXT NOT NULL, note TEXT NOT NULL,
            author TEXT NOT NULL, at TEXT NOT NULL, removed_at TEXT);
    """)
    return db


COLS = ["player", "user_id", "code", "section", "record_id", "decision", "reason", "reviewer", "score", "at"]


class DecisionIn(BaseModel):
    player: str = Field(min_length=1, max_length=80)
    user_id: Optional[int] = None
    code: str = Field(min_length=1, max_length=80)
    section: int = Field(1, ge=1, le=1)
    record_id: Optional[str] = Field(None, max_length=64)
    decision: Literal["fraud", "not_fraud"]
    reason: str = Field(min_length=3, max_length=600)
    score: Optional[float] = None


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M")


@app.get("/api/decisions")
def list_decisions():
    with _lock, closing(review_db()) as db:
        rows = db.execute("SELECT %s FROM decisions ORDER BY at DESC" % ", ".join(COLS)).fetchall()
    return {"decisions": [dict(zip(COLS, r)) for r in rows]}


@app.put("/api/decisions")
def save_decision(d: DecisionIn, request: Request):
    rec = d.model_dump()
    rec["reason"], rec["reviewer"] = rec["reason"].strip(), request.state.user
    if len(rec["reason"]) < 3:
        raise HTTPException(422, "Write a short reason.")
    rec["at"] = now_ist()
    vals = [rec[c] for c in COLS]
    with _lock, closing(review_db()) as db:
        db.execute("INSERT OR REPLACE INTO decisions (%s) VALUES (%s)" % (", ".join(COLS), ", ".join("?" * len(COLS))), vals)
        db.execute("INSERT INTO decision_log (%s) VALUES (%s)" % (", ".join(COLS), ", ".join("?" * len(COLS))), vals)
        db.commit()
    return rec


@app.delete("/api/decisions")
def clear_decision(request: Request, player: str = Query(..., min_length=1, max_length=80)):
    with _lock, closing(review_db()) as db:
        row = db.execute("SELECT %s FROM decisions WHERE player = ?" % ", ".join(COLS), (player,)).fetchone()
        if not row:
            raise HTTPException(404, "No decision for this player.")
        rec = dict(zip(COLS, row))
        rec.update(decision="cleared", reviewer=request.state.user, at=now_ist())
        db.execute("DELETE FROM decisions WHERE player = ?", (player,))
        db.execute("INSERT INTO decision_log (%s) VALUES (%s)" % (", ".join(COLS), ", ".join("?" * len(COLS))), [rec[c] for c in COLS])
        db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ notes on the known patterns
class NoteIn(BaseModel):
    pattern: Literal["P1", "P2", "P3", "P4"]
    note: str = Field(min_length=1, max_length=2000)


NOTE_COLS = ["id", "pattern", "note", "author", "at"]


@app.get("/api/pattern-notes")
def list_notes():
    with _lock, closing(review_db()) as db:
        rows = db.execute("SELECT %s FROM pattern_notes WHERE removed_at IS NULL ORDER BY id DESC" % ", ".join(NOTE_COLS)).fetchall()
    return {"notes": [dict(zip(NOTE_COLS, r)) for r in rows]}


@app.post("/api/pattern-notes")
def add_note(n: NoteIn, request: Request):
    rec = {"pattern": n.pattern, "note": n.note.strip(), "author": request.state.user, "at": now_ist()}
    if not rec["note"]:
        raise HTTPException(422, "Write a note first.")
    with _lock, closing(review_db()) as db:
        rec["id"] = db.execute("INSERT INTO pattern_notes (pattern, note, author, at) VALUES (?, ?, ?, ?)",
                               (rec["pattern"], rec["note"], rec["author"], rec["at"])).lastrowid
        db.commit()
    return rec


@app.delete("/api/pattern-notes")
def remove_note(request: Request, note_id: int = Query(..., ge=1, alias="id")):
    with _lock, closing(review_db()) as db:
        row = db.execute("SELECT author FROM pattern_notes WHERE id = ? AND removed_at IS NULL", (note_id,)).fetchone()
        if not row:
            raise HTTPException(404, "This note has already been removed.")
        if row[0].lower() != request.state.user.lower():
            raise HTTPException(403, "Only the reviewer who wrote a note can remove it.")
        db.execute("UPDATE pattern_notes SET removed_at = ? WHERE id = ?", (now_ist(), note_id))
        db.commit()
    return {"ok": True}


@app.get("/api/decisions.csv")
def export_decisions():
    with _lock, closing(review_db()) as db:
        rows = db.execute("SELECT user_id, code, decision, reason, reviewer, at, record_id, score FROM decisions ORDER BY at").fetchall()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["user_id", "user_code", "decision", "reason", "reviewer", "decided_at_ist", "request_id", "score"])
    for r in rows:
        w.writerow([r[0] or "", r[1], "Fraud" if r[2] == "fraud" else "Not fraud", r[3], r[4], r[5], r[6] or "", r[7] if r[7] is not None else ""])
    name = "decisions_%s.csv" % datetime.now(IST).strftime("%Y%m%d_%H%M")
    return Response(buf.getvalue().encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="%s"' % name})


# ------------------------------------------------------------------ dashboard data and pages
@app.get("/api/dashboard")
def dashboard():
    path = os.path.join(DATA, "dashboard.json")
    if not os.path.exists(path):
        raise HTTPException(503, "Dashboard data has not been built yet. Run build_data.py.")
    return FileResponse(path, media_type="application/json", headers={"Cache-Control": "no-cache"})


@app.get("/api/meta")
def meta():
    with closing(activity_db()) as db:
        return dict(db.execute("SELECT key, value FROM meta").fetchall())


app.mount("/static", StaticFiles(directory=WEB), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(WEB, "index.html"), headers={"Cache-Control": "no-cache"})


@app.get("/login")
def login_page(request: Request):
    if request.state.user:
        return RedirectResponse("/", status_code=303)
    return FileResponse(os.path.join(WEB, "login.html"), headers={"Cache-Control": "no-cache"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("PANEL_HOST", "127.0.0.1"), port=int(os.environ.get("PANEL_PORT", "8080")))
