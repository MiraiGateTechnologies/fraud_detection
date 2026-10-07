# -*- coding: utf-8 -*-
"""
Build the review panel's local data from the analysis workspace.

Writes into panel/data/:
  dashboard.json   request tables, score bands, account groups and model figures
                   (produced by fraud_score/4_artifact.py in JSON mode)
  activity.db      every user's statements and bets, and for each withdrawal request the exact
                   window of entries its score was based on

Reviewer decisions are stored separately in panel/data/review.db by the server and are never
touched here, so the data can be rebuilt at any time.

It reads the risk events from 15 Sep: the same export files as pattern_detection/data_prep/prepare.py
(its SOURCES list), plus any newer dated export in fraud_ingest/data. The July data is not part of the
panel and is dropped from dashboard.json.

Usage:
  python build_data.py [--workspace D:/fraud_detection]
"""
from __future__ import annotations

import argparse
import ast
import calendar
import glob
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import zlib
from array import array
from bisect import bisect_left, bisect_right
from collections import defaultdict
from datetime import datetime

import ijson
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data")
SECTION1_START = "2026-09-15"

# statement type codes, shared with the web app
DEP, WD, BONUS, CASINO, SPORT, OTHER = range(6)
SPORT_HEADS = {"CRICKET", "TENNIS", "SOCCER", "PREMIUM", "SPORTSBOOK", "FANTASY CRICKET", "HORSE RACING"}


def statement_type(desc):
    d = (desc or "").strip()
    low = d.lower()
    if low.startswith("wallet deposit") or low.startswith("deposit"):
        return DEP
    if low.startswith("wallet withdraw") or low.startswith("withdraw"):
        return WD
    if "bonus" in low:
        return BONUS
    if low.startswith("fantasy cricket"):
        return SPORT
    if " > " in d:
        head = d.split(" > ", 1)[0].strip().upper()
        if head in SPORT_HEADS:
            return SPORT
        return OTHER if head == "ROLLBACKED" else CASINO
    return CASINO if d else OTHER


def epoch(s):
    """'2026-09-15 11:47:03' (UTC) -> seconds since 1970, or None."""
    try:
        return calendar.timegm((int(s[0:4]), int(s[5:7]), int(s[8:10]), int(s[11:13]), int(s[14:16]), int(s[17:19])))
    except (TypeError, ValueError, IndexError):
        return None


def flag_epoch(rec):
    return int(datetime.fromisoformat(rec["createdAt"]["$date"].replace("Z", "+00:00")).timestamp())


def num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if x != x or x in (float("inf"), float("-inf")):
        return None
    x = round(x, 2)
    return int(x) if x == int(x) else x


def as_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


class UserActivity:
    """One user's statements and bets, de-duplicated across all of their requests."""
    __slots__ = ("stmts", "bets")

    def __init__(self):
        self.stmts = {}  # statement id -> (time, type, description, amount, balance)
        self.bets = {}   # bet id -> row

    def add_statement(self, s):
        t = epoch(s.get("created_at"))
        if t is None:
            return None, None
        desc = s.get("description") or ""
        amount, balance = num(s.get("pl")), num(s.get("balance"))
        sid = as_int(s.get("id"))
        if sid is None:  # no id in the export: key on the content instead
            sid = -(hash((t, desc, amount, balance)) & 0x3FFFFFFFFFFFFFFF) - 1
        if sid not in self.stmts:
            self.stmts[sid] = (t, statement_type(desc), desc, amount, balance)
        return sid, t

    def add_bet(self, b):
        bid = as_int(b.get("bet_id"))
        side = str(b.get("selection_type") or "").lower()
        odds, req = num(b.get("odds")), num(b.get("requested_odds"))
        row = [as_int(b.get("sport_id")), str(b.get("event_id") or ""), as_int(b.get("bet_market_type")), str(b.get("selection") or ""),
               1 if side == "back" else 0 if side == "lay" else None, odds, req if req != odds else None, num(b.get("stake")),
               num(b.get("p_l")), num(b.get("liability")), as_int(b.get("bet_status")), b.get("reason") or None, str(b.get("market_id") or "")]
        if bid is None:
            bid = -(hash(json.dumps(row, default=str)) & 0x3FFFFFFFFFFFFFFF) - 1
        if bid not in self.bets:
            self.bets[bid] = row
        return bid

    def packed(self):
        """Sorted lists plus id -> position maps."""
        s_ids = sorted(self.stmts, key=lambda k: (self.stmts[k][0], k))
        b_ids = sorted(self.bets)
        return s_ids, b_ids


def window(ids, pos, sel_ids):
    """Positions of sel_ids in the user's sorted list: (start, end, None) when they are one
    unbroken run, else (start, end, packed positions)."""
    if not len(sel_ids):
        return 0, 0, None
    p = sorted(pos[i] for i in sel_ids)
    if p[-1] - p[0] + 1 == len(p):
        return p[0], p[-1] + 1, None
    return p[0], p[-1] + 1, array("I", p).tobytes()


def read_sources(prepare_py):
    tree = ast.parse(open(prepare_py, encoding="utf-8").read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "SOURCES" for t in node.targets):
            return ast.literal_eval(node.value)
    raise SystemExit("SOURCES not found in %s" % prepare_py)


def section1_files(ws):
    """The training exports (prepare.py SOURCES) plus any newer dated export in fraud_ingest/data.
    Newer exports hold requests that were scored but are not in the training data yet."""
    files = read_sources(os.path.join(ws, "pattern_detection", "data_prep", "prepare.py"))
    dated = re.compile(r"risk_events_(\d{4}-\d{2}-\d{2}_\d{4})\.json$")
    stamps = [m.group(1) for m in (dated.search(os.path.basename(f)) for f in files) if m]
    latest = max(stamps) if stamps else ""
    known = {os.path.normcase(os.path.abspath(f)) for f in files}
    for f in sorted(glob.glob(os.path.join(ws, "fraud_ingest", "data", "risk_events_*.json"))):
        m = dated.search(os.path.basename(f))
        if m and m.group(1) > latest and os.path.normcase(os.path.abspath(f)) not in known:
            files.append(f)
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace", default="D:/fraud_detection")
    args = ap.parse_args()
    ws = args.workspace
    results = os.path.join(ws, "fraud_score", "results")
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()

    # 1) tables and model figures; the panel shows only the risk events, so the July section is dropped
    path = os.path.join(OUT, "dashboard.json")
    subprocess.run([sys.executable, os.path.join(ws, "fraud_score", "4_artifact.py"), path], check=True)
    D = json.load(open(path, encoding="utf-8"))
    for k in ("J", "band_j"):
        D.pop(k, None)
    D["dict"].pop("ru", None)
    for k in [k for k in D["tot"] if k.startswith("j") or k == "rules_auc"]:
        D["tot"].pop(k)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(D, fh, ensure_ascii=False, separators=(",", ":"))
    print("dashboard.json done, %.1f MB (%.0fs)" % (os.path.getsize(path) / 1e6, time.time() - t0), flush=True)

    # 2) which requests and users the panel shows
    R = pd.read_csv(os.path.join(results, "scores_risk_events.csv"), usecols=["record_id", "user_id_str", "created_ist", "fraud_pct"],
                    dtype={"record_id": str, "user_id_str": str}, low_memory=False)
    R = R[(R.created_ist >= SECTION1_START) & R.fraud_pct.notna()]
    wanted = dict(zip(R.record_id, R.user_id_str))

    # 3) one pass over the exports
    users = defaultdict(UserActivity)
    requests = {}  # record id -> (user, flag, statement ids, bet ids)
    seen = set()
    for src in section1_files(ws):
        with open(src, "rb") as fh:
            for rec in ijson.items(fh, "item", use_float=True):
                oid = rec["_id"]["$oid"]
                if oid not in wanted or oid in seen:
                    continue
                seen.add(oid)
                user, flag = wanted[oid], flag_epoch(rec)
                sv = (rec.get("surveillance") or [None])[0] or {}
                ua = users[user]
                s_sel = array("q")
                for s in sv.get("statements") or []:
                    sid, t = ua.add_statement(s)
                    if sid is not None and t <= flag:  # the score never used entries after the request
                        s_sel.append(sid)
                b_sel = array("q", (ua.add_bet(b) for b in sv.get("bets") or []))
                requests[oid] = (user, flag, s_sel, b_sel)
        print("  %s: %d requests (%.0fs)" % (os.path.basename(src), len(requests), time.time() - t0), flush=True)
    missing = len(wanted) - len(requests)

    # 4) write activity.db (to a temp file, swapped in at the end)
    tmp = os.path.join(OUT, "activity.db.part")
    if os.path.exists(tmp):
        os.remove(tmp)
    db = sqlite3.connect(tmp)
    db.executescript("""
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE users (section INTEGER, uid TEXT, n_s INTEGER, n_b INTEGER, blob BLOB, PRIMARY KEY (section, uid));
        CREATE TABLE requests (record_id TEXT PRIMARY KEY, uid TEXT, flag INTEGER, s0 INTEGER, s1 INTEGER, b0 INTEGER, b1 INTEGER,
                               s_idx BLOB, b_idx BLOB, n_s INTEGER, n_b INTEGER);
    """)
    by_user = defaultdict(list)
    for oid, (user, flag, s_sel, b_sel) in requests.items():
        by_user[user].append(oid)
    split_s = split_b = 0
    raw = packed = 0
    for user, ua in users.items():
        s_ids, b_ids = ua.packed()
        doc = {"s": [list(ua.stmts[k]) for k in s_ids], "b": [ua.bets[k] for k in b_ids]}
        text = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        blob = zlib.compress(text, 6)
        raw, packed = raw + len(text), packed + len(blob)
        db.execute("INSERT INTO users VALUES (1, ?, ?, ?, ?)", (user, len(s_ids), len(b_ids), blob))
        s_pos = {k: i for i, k in enumerate(s_ids)}
        b_pos = {k: i for i, k in enumerate(b_ids)}
        for oid in by_user[user]:
            _, flag, s_sel, b_sel = requests[oid]
            s0, s1, s_idx = window(s_ids, s_pos, set(s_sel))
            b0, b1, b_idx = window(b_ids, b_pos, set(b_sel))
            split_s += s_idx is not None
            split_b += b_idx is not None
            db.execute("INSERT INTO requests VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                       (oid, user, flag, s0, s1, b0, b1, s_idx, b_idx, len(set(s_sel)), len(set(b_sel))))
    meta = {"built_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "requests": len(requests), "users": len(users),
            "requests_not_found": missing}
    db.executemany("INSERT INTO meta VALUES (?, ?)", [(k, str(v)) for k, v in meta.items()])
    db.commit()
    db.close()
    os.replace(tmp, os.path.join(OUT, "activity.db"))
    print("activity.db: %d requests, %d users, %.0f MB of data stored as %.0f MB | requests not found %d | "
          "split windows: statements %d, bets %d | %.0fs" % (len(requests), len(users), raw / 1e6, packed / 1e6,
                                                               missing, split_s, split_b, time.time() - t0))


if __name__ == "__main__":
    main()
