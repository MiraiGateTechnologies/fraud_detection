# -*- coding: utf-8 -*-
"""
Reviewer accounts and sign-in sessions of the review panel (data/users.db).

  python accounts.py add <name> [<name> ...]   create reviewer accounts, asks for each password
  python accounts.py add --developer <name>    create a developer account
  python accounts.py role <name> <role>        set the role: reviewer or developer
  python accounts.py passwd <name>             set a new password and end the user's open sessions
  python accounts.py remove <name>             delete the account and end its sessions
  python accounts.py list                      accounts, role, last sign-in and open sessions

Roles: a reviewer sees the scores, the activity data and the review tools. A developer also sees how the
platform's agent handled each request (decision, remark, platform reason) and the training labels.

On the server use the wrapper, which runs this as the panel user:

  sudo fraud-panel-users add User2

An account can be signed in on one browser at a time: signing in on another browser ends the
earlier session, and that browser is sent back to the sign-in page.

Passwords are stored as salted PBKDF2-SHA256 hashes. Sessions are random tokens kept in a
cookie; only their SHA-256 is stored, so a copy of users.db cannot be used to sign in.
"""
from __future__ import annotations

import argparse
import base64
import getpass
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import sys
import time
from contextlib import closing
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("PANEL_DATA", os.path.join(HERE, "data"))
IST = timezone(timedelta(hours=5, minutes=30))

ITERATIONS = 600_000
SESSION_IDLE = 12 * 3600       # signed out after 12 hours without activity
SESSION_MAX = 7 * 24 * 3600    # and after 7 days in any case
TOUCH_EVERY = 300              # refresh a session's last activity at most every 5 minutes
FAIL_WINDOW = 15 * 60          # failed sign-ins are counted over 15 minutes
FAIL_LIMIT_NAME = 5            # per user name
FAIL_LIMIT_IP = 20             # per address, across all user names
KEEP_LOG_DAYS = 180
MIN_PASSWORD = 8
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    name TEXT PRIMARY KEY COLLATE NOCASE, password TEXT NOT NULL,
    created TEXT NOT NULL, changed TEXT NOT NULL, last_login TEXT);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE,
    created REAL NOT NULL, seen REAL NOT NULL, ip TEXT, agent TEXT, ended TEXT);
CREATE TABLE IF NOT EXISTS logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT, at REAL NOT NULL, name TEXT COLLATE NOCASE, ip TEXT, ok INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS logins_at ON logins (at);
"""
ROLES = ("reviewer", "developer")
_ready = set()


def connect():
    os.makedirs(DATA, exist_ok=True)
    path = os.path.join(DATA, "users.db")
    con = sqlite3.connect(path, timeout=10)
    if path not in _ready:
        con.executescript(SCHEMA)
        cols = {r[1] for r in con.execute("PRAGMA table_info(users)")}
        if "role" not in cols:  # accounts made before roles existed are reviewers
            con.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'reviewer'")
            con.commit()
        _ready.add(path)
    return con


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M")


# ------------------------------------------------------------------ passwords
def _b64(raw):
    return base64.b64encode(raw).decode("ascii")


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return "pbkdf2_sha256$%d$%s$%s" % (ITERATIONS, _b64(salt), _b64(digest))


def check_password(password, stored):
    try:
        algo, rounds, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        test = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), base64.b64decode(salt), int(rounds))
        return hmac.compare_digest(test, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


_dummy = []


def dummy_hash():
    """Checked against when the user name does not exist, so both cases take the same time."""
    if not _dummy:
        _dummy.append(hash_password(secrets.token_hex(16)))
    return _dummy[0]


def password_problem(name, password):
    if len(password) < MIN_PASSWORD:
        return "Use at least %d characters." % MIN_PASSWORD
    if len(password) > 200:
        return "Use at most 200 characters."
    if password.strip().lower() == name.lower():
        return "The password cannot be the user name."
    return None


# ------------------------------------------------------------------ accounts
def get_account(name):
    with closing(connect()) as con:
        row = con.execute("SELECT name FROM users WHERE name = ?", (name,)).fetchone()
    return row[0] if row else None


def get_role(name):
    with closing(connect()) as con:
        row = con.execute("SELECT role FROM users WHERE name = ?", (name,)).fetchone()
    return row[0] if row else None


def set_role(name, role):
    if role not in ROLES:
        raise ValueError("The role is reviewer or developer.")
    with closing(connect()) as con:
        n = con.execute("UPDATE users SET role = ?, changed = ? WHERE name = ?", (role, now_ist(), name)).rowcount
        con.commit()
    if not n:
        raise ValueError("There is no account named %s." % name)


def create_account(name, password, role="reviewer"):
    if not NAME_RE.match(name):
        raise ValueError("User names are 2 to 40 letters, digits, dots, dashes or underscores.")
    if role not in ROLES:
        raise ValueError("The role is reviewer or developer.")
    problem = password_problem(name, password)
    if problem:
        raise ValueError(problem)
    stamp = now_ist()
    with closing(connect()) as con:
        try:
            con.execute("INSERT INTO users (name, password, created, changed, role) VALUES (?, ?, ?, ?, ?)",
                        (name, hash_password(password), stamp, stamp, role))
        except sqlite3.IntegrityError:
            raise ValueError("%s already exists." % name) from None
        con.commit()


def set_password(name, password):
    problem = password_problem(name, password)
    if problem:
        raise ValueError(problem)
    with closing(connect()) as con:
        n = con.execute("UPDATE users SET password = ?, changed = ? WHERE name = ?",
                        (hash_password(password), now_ist(), name)).rowcount
        con.execute("DELETE FROM sessions WHERE name = ?", (name,))
        con.commit()
    if not n:
        raise ValueError("There is no account named %s." % name)


def remove_account(name):
    with closing(connect()) as con:
        n = con.execute("DELETE FROM users WHERE name = ?", (name,)).rowcount
        con.execute("DELETE FROM sessions WHERE name = ?", (name,))
        con.commit()
    if not n:
        raise ValueError("There is no account named %s." % name)


def list_accounts():
    now = time.time()
    with closing(connect()) as con:
        return con.execute("""
            SELECT u.name, u.role, u.created, u.last_login,
                   EXISTS (SELECT 1 FROM sessions s WHERE s.name = u.name AND s.ended IS NULL AND s.seen > ? AND s.created > ?)
            FROM users u ORDER BY u.name""", (now - SESSION_IDLE, now - SESSION_MAX)).fetchall()


# ------------------------------------------------------------------ signing in
def wait_seconds(name, ip):
    """Seconds before this user name or address may try again after too many failed sign-ins, 0 if now."""
    now = time.time()
    since = now - FAIL_WINDOW
    with closing(connect()) as con:
        last_ok = con.execute("SELECT MAX(at) FROM logins WHERE name = ? AND ok = 1", (name,)).fetchone()[0] or 0
        n_name, first_name = con.execute("SELECT COUNT(*), MIN(at) FROM logins WHERE name = ? AND ok = 0 AND at > ?",
                                         (name, max(since, last_ok))).fetchone()
        n_ip, first_ip = con.execute("SELECT COUNT(*), MIN(at) FROM logins WHERE ip = ? AND ok = 0 AND at > ?",
                                     (ip, since)).fetchone()
    waits = [0.0]
    if n_name >= FAIL_LIMIT_NAME:
        waits.append(first_name + FAIL_WINDOW - now)
    if n_ip >= FAIL_LIMIT_IP:
        waits.append(first_ip + FAIL_WINDOW - now)
    return max(waits)


def check_login(name, password, ip):
    """The account name as stored if the password is right, else None. Every attempt is logged."""
    with closing(connect()) as con:
        row = con.execute("SELECT name, password FROM users WHERE name = ?", (name,)).fetchone()
    ok = check_password(password, row[1] if row else dummy_hash()) and row is not None
    with closing(connect()) as con:
        con.execute("INSERT INTO logins (at, name, ip, ok) VALUES (?, ?, ?, ?)",
                    (time.time(), (row[0] if row else name)[:60], ip, int(ok)))
        con.commit()
    return row[0] if ok else None


def _key(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_session(name, ip, agent):
    """Signs the account in on this browser and ends its session on any other browser."""
    token = secrets.token_urlsafe(32)
    now = time.time()
    with closing(connect()) as con:
        con.execute("DELETE FROM sessions WHERE seen < ? OR created < ?", (now - SESSION_IDLE, now - SESSION_MAX))
        con.execute("DELETE FROM logins WHERE at < ?", (now - KEEP_LOG_DAYS * 86400,))
        con.execute("UPDATE sessions SET ended = 'replaced' WHERE name = ? AND ended IS NULL", (name,))
        con.execute("INSERT INTO sessions (token, name, created, seen, ip, agent) VALUES (?, ?, ?, ?, ?, ?)",
                    (_key(token), name, now, now, ip, (agent or "")[:200]))
        con.execute("UPDATE users SET last_login = ? WHERE name = ?", (now_ist(), name))
        con.commit()
    return token


def session_state(token, touch=True):
    """(account name, None) for a live session. Otherwise (None, why): "replaced" when the account has signed in
    on another browser, "ended" when the session expired or was ended, None when there is no cookie.
    touch=False checks the session without counting it as activity."""
    if not token:
        return None, None
    if len(token) > 100:
        return None, "ended"
    key = _key(token)
    now = time.time()
    with closing(connect()) as con:
        row = con.execute("SELECT u.name, s.created, s.seen, s.ended FROM sessions s JOIN users u ON u.name = s.name WHERE s.token = ?",
                          (key,)).fetchone()
        if not row:
            return None, "ended"
        name, created, seen, ended = row
        if ended:
            return None, ended
        if now - seen > SESSION_IDLE or now - created > SESSION_MAX:
            con.execute("DELETE FROM sessions WHERE token = ?", (key,))
            con.commit()
            return None, "ended"
        if touch and now - seen > TOUCH_EVERY:
            con.execute("UPDATE sessions SET seen = ? WHERE token = ?", (now, key))
            con.commit()
    return name, None


def end_session(token):
    if token and len(token) <= 100:
        with closing(connect()) as con:
            con.execute("DELETE FROM sessions WHERE token = ?", (_key(token),))
            con.commit()


# ------------------------------------------------------------------ command line
def ask_password(name):
    while True:
        first = getpass.getpass("Password for %s: " % name)
        problem = password_problem(name, first)
        if problem:
            print(problem)
            continue
        if getpass.getpass("Repeat the password: ") != first:
            print("The passwords do not match. Try again.")
            continue
        return first


def main(argv=None):
    parser = argparse.ArgumentParser(prog="fraud-panel-users", description="Reviewer accounts of the review panel.")
    sub = parser.add_subparsers(dest="cmd", required=True)
    add = sub.add_parser("add", help="create accounts")
    add.add_argument("--developer", action="store_true", help="the accounts can also see the agent's decisions")
    add.add_argument("names", nargs="+")
    role = sub.add_parser("role", help="set an account's role")
    role.add_argument("name")
    role.add_argument("role", choices=ROLES)
    sub.add_parser("passwd", help="set a new password").add_argument("name")
    sub.add_parser("remove", help="delete an account").add_argument("name")
    sub.add_parser("list", help="show accounts")
    args = parser.parse_args(argv)
    failed = False

    if args.cmd == "add":
        for name in args.names:
            if not NAME_RE.match(name):
                print("Skipped %s: user names are 2 to 40 letters, digits, dots, dashes or underscores." % name)
                failed = True
                continue
            if get_account(name):
                print("Skipped %s: the account already exists. To change its password: fraud-panel-users passwd %s" % (name, name))
                failed = True
                continue
            try:
                kind = "developer" if args.developer else "reviewer"
                create_account(name, ask_password(name), kind)
                print("Account %s created (%s)." % (name, kind))
            except ValueError as e:
                print("Skipped %s: %s" % (name, e))
                failed = True

    elif args.cmd == "role":
        name = get_account(args.name)
        if not name:
            print("There is no account named %s." % args.name)
            return 1
        set_role(name, args.role)
        print("%s is now a %s. The change shows when the panel is next opened or reloaded." % (name, args.role))

    elif args.cmd == "passwd":
        name = get_account(args.name)
        if not name:
            print("There is no account named %s." % args.name)
            return 1
        set_password(name, ask_password(name))
        print("Password changed for %s. Their open sessions were ended." % name)

    elif args.cmd == "remove":
        try:
            remove_account(args.name)
            print("Account %s removed and signed out." % args.name)
        except ValueError as e:
            print(e)
            return 1

    else:
        rows = list_accounts()
        if not rows:
            print("No accounts yet. Create one with: fraud-panel-users add <name>")
        else:
            print("%-20s %-10s %-17s %-17s %s" % ("Account", "Role", "Created", "Last sign-in", "Signed in now"))
            for name, role, created, last, live in rows:
                print("%-20s %-10s %-17s %-17s %s" % (name, role, created, last or "never", "yes" if live else "no"))
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print()
        sys.exit(130)
