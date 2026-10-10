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
import re
import sqlite3
import threading
import zlib
from array import array
from contextlib import closing
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
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
        response = await call_next(request)
        response.headers["Cache-Control"] = "private, no-cache"
        return response
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
    return {"user": request.state.user, "role": accounts.get_role(request.state.user) or "reviewer"}


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
        CREATE TABLE IF NOT EXISTS pattern_checks (
            record_id TEXT PRIMARY KEY, pattern TEXT NOT NULL, fits INTEGER NOT NULL, note TEXT NOT NULL,
            reviewer TEXT NOT NULL, at TEXT NOT NULL, code TEXT, user_id INTEGER);
        CREATE TABLE IF NOT EXISTS pattern_check_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, record_id TEXT, pattern TEXT, fits INTEGER, note TEXT,
            reviewer TEXT, at TEXT, code TEXT, user_id INTEGER);
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


# ------------------------------------------------------------------ does the known pattern fit a request
class CheckIn(BaseModel):
    record_id: str = Field(min_length=1, max_length=64)
    pattern: Literal["P1", "P2", "P3", "P4"]
    answer: Literal["fits", "not_fit", "other"]
    note: str = Field("", max_length=1000)
    code: Optional[str] = Field(None, max_length=80)
    user_id: Optional[int] = None


CHECK_COLS = ["record_id", "pattern", "fits", "note", "reviewer", "at", "code", "user_id"]
ANSWERS = {"fits": 1, "not_fit": 0, "other": 2}  # stored in the fits column; "other" keeps the reviewer's own answer in note
ANSWER_OF = {v: k for k, v in ANSWERS.items()}


def check_out(row):
    rec = dict(zip(CHECK_COLS, row))
    rec["answer"] = ANSWER_OF.get(rec.pop("fits"), "other")
    return rec


@app.get("/api/pattern-checks")
def list_checks(record_id: Optional[str] = Query(None, min_length=1, max_length=64)):
    """Reviewers' answers on whether the known pattern fits a request; all of them, or one request's."""
    sql = "SELECT %s FROM pattern_checks" % ", ".join(CHECK_COLS)
    with _lock, closing(review_db()) as db:
        rows = (db.execute(sql + " WHERE record_id = ?", (record_id,)) if record_id else db.execute(sql + " ORDER BY at DESC")).fetchall()
    return {"checks": [check_out(r) for r in rows]}


@app.put("/api/pattern-checks")
def save_check(c: CheckIn, request: Request):
    note = c.note.strip() if c.answer == "other" else ""
    if c.answer == "other" and not note:
        raise HTTPException(422, "Write your answer about the pattern.")
    vals = [c.record_id, c.pattern, ANSWERS[c.answer], note, request.state.user, now_ist(), c.code, c.user_id]
    marks = ", ".join("?" * len(CHECK_COLS))
    with _lock, closing(review_db()) as db:
        db.execute("INSERT OR REPLACE INTO pattern_checks (%s) VALUES (%s)" % (", ".join(CHECK_COLS), marks), vals)
        db.execute("INSERT INTO pattern_check_log (%s) VALUES (%s)" % (", ".join(CHECK_COLS), marks), vals)
        db.commit()
    return check_out(vals)


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
AGENT_LINES = ("Rejected by agent", "Approved by agent", "Earlier request")
_reviewer_view = {}


def reviewer_dashboard(path):
    """dashboard.json without the platform agent's decisions: for each request the decision, remark,
    platform reason and training label are removed, reason lines that quote the agent are dropped, and
    the reject counts are left out. Built once per data file and kept in memory."""
    stamp = os.path.getmtime(path)
    if _reviewer_view.get("stamp") != stamp:
        D = json.load(open(path, encoding="utf-8"))
        D["agent"] = False
        for r in D.get("W", []):
            r[2], r[11], r[12], r[13] = None, -1, -1, -1
        d = D.get("dict", {})
        d["k"] = ["; ".join(p for p in s.split("; ") if not p.startswith(AGENT_LINES)) for s in d.get("k", [])]
        for k in ("lb", "rm", "rs"):
            d[k] = []
        for b in D.get("band_r", []):
            b["rej"] = None
        for g in D.get("groups", []):
            g["rej"] = None
        for a in D.get("age_r", []):
            a["hi_rej"] = None
        if "tot" in D:
            D["tot"]["hi_rej"] = None
        _reviewer_view.update(stamp=stamp, body=json.dumps(D, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    return _reviewer_view["body"]


@app.get("/api/dashboard")
def dashboard(request: Request):
    path = os.path.join(DATA, "dashboard.json")
    if not os.path.exists(path):
        raise HTTPException(503, "Dashboard data has not been built yet. Run build_data.py.")
    if accounts.get_role(request.state.user) == "developer":
        return FileResponse(path, media_type="application/json", headers={"Cache-Control": "no-cache"})
    with _lock:
        body = reviewer_dashboard(path)
    return Response(body, media_type="application/json", headers={"Cache-Control": "no-cache"})


@app.get("/api/meta")
def meta():
    with closing(activity_db()) as db:
        return dict(db.execute("SELECT key, value FROM meta").fetchall())


app.mount("/static", StaticFiles(directory=WEB), name="static")


def page(name):
    """An HTML page with each /static/ file linked by its change time, so browsers load the new
    version right after an update instead of a cached copy."""
    def stamp(m):
        return "/static/%s?v=%d" % (m.group(1), os.path.getmtime(os.path.join(WEB, m.group(1))))

    with open(os.path.join(WEB, name), encoding="utf-8") as f:
        return HTMLResponse(re.sub(r"/static/([\w.-]+\.(?:js|css))", stamp, f.read()))


@app.get("/")
def index():
    return page("index.html")


@app.get("/login")
def login_page(request: Request):
    if request.state.user:
        return RedirectResponse("/", status_code=303)
    return page("login.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("PANEL_HOST", "127.0.0.1"), port=int(os.environ.get("PANEL_PORT", "8080")))
