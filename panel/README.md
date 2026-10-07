# Fraud Review panel

Review panel for flagged withdrawal requests. Reviewers sign in, open a flagged player, check the statements
and bets the score was based on, and mark the player as **Fraud** or **Not fraud** with a reason.
The panel also holds the full request tables, account groups and the known fraud patterns with reviewer notes.

## What is inside

| Page | What it shows |
|---|---|
| Review queue | Players with a request scored 60% or higher, waiting for a decision |
| Decisions | Every decision made in the panel, with CSV export for the platform |
| Withdrawal requests | All scored risk events, with score bands and filters |
| Account groups | 3 or more similar unusual users under one master within 72 hours |
| Known patterns | The four confirmed fraud patterns (P1 to P4), what each check looks for, how many requests match, and notes from reviewers |

On a request page:

- **Statements**: the entries the score used, from the start of the data window up to the request time.
  Filter by type (deposit, withdrawal, casino, sports, bonus) and search the description.
- **Bets**: every bet in the data for the request. Bets carry no time, so they are listed in the order
  the platform numbered them. P/L and liability are the amounts on each bet as sent by the platform,
  not the settled result. Settled sports results are in the statements.
- **NA** means the data had no statements or no bets for that request.
- **Review**: choose Fraud or Not fraud, write a reason and press **Submit**. A notification confirms the
  decision and that it will be used to retrain the model at the next update.

Scores run from 0 to 99%. No score reaches 100%.

Search the request table by user, master or remark, by group (`G24`) or by pattern (`P2`).

## Sign-in

Every page and API call needs a signed-in reviewer. Accounts and sessions live in `data/users.db`.

- An account can be signed in on **one browser at a time**. Signing in on another browser ends the earlier
  session, and that browser returns to the sign-in page with a message saying why.
- A session ends after 12 hours without activity, and after 7 days in any case.
- After 5 failed attempts on a user name, or 20 from one address, sign-in is paused for 15 minutes.
- Passwords are stored as salted PBKDF2-SHA256 hashes and must have at least 8 characters.
- Decisions and notes are saved under the signed-in account name.

Manage accounts with `accounts.py` (on the server, use `sudo fraud-panel-users` instead of `python accounts.py`):

```bash
python accounts.py add User1 User2     # asks for each password twice
python accounts.py passwd User2        # new password; ends the user's session
python accounts.py remove User2
python accounts.py list
```

## Setup

```bash
pip install -r requirements-build.txt
```

`requirements.txt` (FastAPI and uvicorn) is all the server needs. `requirements-build.txt` adds what
`build_data.py` needs, on the machine that has the analysis workspace.

## Build the data

Reads the scored results and the raw exports from the analysis workspace and writes `data/`:

```bash
python build_data.py --workspace D:/fraud_detection
```

Takes about 5 to 6 minutes. Run it again after new data is scored.

| File | Contents | Rebuilt by `build_data.py` |
|---|---|---|
| `data/dashboard.json` | Request tables, bands, groups, model figures | Yes |
| `data/activity.db` | Statements and bets per user, and the window each request was scored on | Yes |
| `data/review.db` | Reviewer decisions with their full history, and notes on the known patterns | No, kept across rebuilds |
| `data/users.db` | Reviewer accounts, sessions and sign-in history | No, kept across rebuilds |

`data/` holds client data and is never committed (see `.gitignore`).

## Run

```bash
python accounts.py add <your name>
python server.py
```

Open http://127.0.0.1:8080 and sign in. Set `PANEL_HOST`, `PANEL_PORT` or `PANEL_DATA` to change the address
or the data folder.

## Model updates

Decisions are not applied to the model one by one. At each model update, the decisions made in the panel are
added to the training data together with the new risk events, the models are retrained and checked, and the
panel data is rebuilt and sent to the server. A new model version is used only if it is at least as accurate
as the one in use.

## API

All routes except sign-in need a session cookie.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/login` | Sign in with `name` and `password`; sets the session cookie |
| POST | `/api/logout` | Sign out |
| GET | `/api/me` | Signed-in account |
| GET | `/api/session` | Session check used by the open panel; does not count as activity |
| GET | `/api/dashboard` | Tables and figures |
| GET | `/api/activity?key=<request id>&tab=statements` | Statements (or `tab=bets`) for a request |
| GET | `/api/decisions` | Current decisions |
| PUT | `/api/decisions` | Submit a decision: `decision` is `fraud` or `not_fraud`; `reason` is required |
| DELETE | `/api/decisions?player=<key>` | Remove a decision (kept in the history) |
| GET | `/api/decisions.csv` | Decisions for the platform |
| GET | `/api/pattern-notes` | Notes on the known patterns |
| POST | `/api/pattern-notes` | Add a note: `pattern` is `P1` to `P4`, `note` is the text |
| DELETE | `/api/pattern-notes?id=<id>` | Remove your own note (kept in the database) |

Requests that change data must come from the panel itself; requests started from another site are refused.

## Deploy on a server

`deploy/` holds everything for an Ubuntu 22.04 / 24.04 server (tested size: `t3.medium`, 40 GB `gp3`):

| File | Purpose |
|---|---|
| `setup_server.sh` | Setup and later refreshes: packages, swap, service, nginx, HTTPS certificate, daily backup |
| `fraud-panel.service` | Runs the panel as the `panel` user on `127.0.0.1:8080`, restarts it if it stops |
| `nginx-review-panel.conf` | Front for the panel; limits how fast sign-in can be tried |
| `fraud-panel-users.sh` | Installed as `fraud-panel-users`; manages reviewer accounts |
| `backup-review-db.sh` | Daily copy of `review.db` to S3 |
| `install_update.sh` | Installed as `fraud-panel-install-update`; installs an uploaded update |
| `push_update.ps1` | Run on the Windows machine to send new code and data to the server |

Security group: 443 and 80 open to everyone (80 only redirects to HTTPS and renews the certificate),
22 only from your own IP. Port 8080 stays closed; the panel listens on `127.0.0.1` only.

First setup, after the DNS record points to the server:

```bash
scp -i key.pem -r panel ubuntu@<server address>:~/
ssh -i key.pem ubuntu@<server address>
sudo bash ~/panel/deploy/setup_server.sh panel.example.com you@example.com your-backup-bucket
sudo fraud-panel-users add User1 User2
```

The email is for the free HTTPS certificate. Leave it out when a load balancer or CDN in front of the server
already serves HTTPS for the domain:

```bash
sudo bash ~/panel/deploy/setup_server.sh panel.example.com
```

Running the script again refreshes code and config and keeps decisions, notes and accounts.

After new data is built (`python build_data.py`), send it to the server from Windows:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\push_update.ps1 -Key C:\keys\panel.pem -Server ubuntu@<server address>
```

`<server address>` is the server's public IP or a DNS name that points straight at it; SSH does not pass
through a load balancer or CDN.

Backups: the S3 copy needs an IAM role on the instance that allows `s3:PutObject` on the bucket.
Also schedule weekly EBS snapshots (EC2 > Lifecycle Manager).
