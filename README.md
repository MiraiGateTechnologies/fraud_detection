# Fraud Detection

MiraiGate's withdrawal fraud screening dashboard. Every withdrawal request and every user gets a
**fraud score from 0% to 100%** with the main reasons behind it. The score shows how closely the
activity matches confirmed fraud cases. It is a priority list for reviewers, not a final decision.

Reviewers can tick **Confirmed fraud** for any player. Ticks are saved in a shared SQLite database,
so every reviewer sees the same list on every device.

## What the dashboard shows

| View | Contents |
|---|---|
| **Section 1 — Risk events from 15 Sep** | Every withdrawal request from the risk event exports, with score bands, filters, account age, reasons and full details. Includes **Account groups**: 3+ similar unusual users under the same master within 72 hours. |
| **Section 2 — Old data (July)** | Users from `data_pipeline_output-24`, `25` and `26` (about 2 days of activity each), compared with the client's rule list. |
| **Reference — Model and accuracy** | How the score is built, test results, the rule for accounts older than 30 days, and model versions. |

How the score works, in short:

- A known-pattern score (P1–P4) and a behaviour score (how far the user is from normal users, mainly
  winnings far above deposits) are combined, and the higher one is used.
- The result is set against approved requests: **90% or more** means the request looks more like
  fraud than 999 of every 1,000 approved requests. Bands: 90–100, 60–90, 40–60, 20–40, 0–20.
- Accounts older than 30 days get a lower score. They are shown at 90% or more only in very strong
  cases, and then only between 95% and 98%.
- Confirmed fraud cases are always shown at 95% or more (95–98% for accounts older than 30 days).
- Money columns are in rupees: deposits, amount withdrawn and profit in the data window (about the
  last 20 days for risk events, about 2 days for the July data).

## Project layout

```
index.html              page layout (Vite entry)                          generated
src/main.js             dashboard logic: sections, filters, tables, ticks  generated
src/styles.css          theme (light and dark) and layout                  generated
public/data/dashboard.json   scored data                                   generated
src/ticks.js            tick store: shared database via /api/ticks, browser-only fallback

api/ticks.js            GET / POST / DELETE /api/ticks (Vercel serverless function)
api/_db.js              libSQL client, schema and helpers
middleware.js           Basic Auth for the whole site (BASIC_AUTH_USER / BASIC_AUTH_PASS)
schema.sql              ticks table
scripts/dev-api.js      local API server (without `vercel dev`)
scripts/init-db.js      npm run db:init
vercel.json             build settings and security headers (noindex, no-store, ...)
```

## Run locally

```bash
npm install
cp .env.example .env          # DATABASE_URL=file:local.db (a real SQLite file)
npm run db:init               # creates the ticks table
```

Then, in two terminals:

```bash
npm run dev:api               # API -> http://localhost:3001
```

```bash
npm run dev                   # App -> http://localhost:5173
```

Vite proxies `/api` to port 3001. `local.db` is in `.gitignore` and is never committed.

## Deploy on Vercel

### 1. Database — Turso

A plain SQLite file does not work on Vercel: its filesystem resets on every deploy and request,
so ticks would be lost. Use Turso (hosted SQLite, free tier):

```bash
npm i -g turso
turso auth signup
turso db create fraud-console
turso db show fraud-console --url         # libsql://... URL
turso db tokens create fraud-console      # auth token
turso db shell fraud-console < schema.sql
```

### 2. Environment variables

Vercel → Project → Settings → Environment Variables:

| Name | Value | Purpose |
|---|---|---|
| `DATABASE_URL` | `libsql://<db>-<org>.turso.io` | Turso URL |
| `DATABASE_AUTH_TOKEN` | `<token>` | Turso token |
| `BASIC_AUTH_USER` | any user name | login user name |
| `BASIC_AUTH_PASS` | **a strong password** | login password |

Redeploy once after setting them. **Set the login.** Without `BASIC_AUTH_*` the site opens without
a password, and it contains client user IDs, master names, amounts and agent remarks.

### 3. Deploy

Push to `main`. Vercel builds with `npm run build` and serves `dist/`.

## Update the data

The files marked *generated* above are built from the dashboard template
(`fraud_score/artifact_template.html` in the analysis workspace), the same template used for the
shared Claude link and the local `dashboard.html`. Make lasting text or layout changes in the
template; a direct edit to a generated file is replaced on the next update.

From the `fraud_score` folder of the analysis workspace:

```bash
python 1_train.py
python 2_score.py
python 5_github_dashboard.py <path-to-this-repo>
```

Then commit and push. Ticks live in the database, so updating the data never removes them.

## Ticks API

```
GET    /api/ticks    -> { ok, persistent, ticks: [...] }
POST   /api/ticks    body { userId, userCode, name, on, markedBy }
DELETE /api/ticks    -> remove all ticks
```

Responses reveal nothing beyond `persistent`: not the database name or URL, not the login state and
not the real SQL error. Errors go to the server log (Vercel → Logs).

```sql
CREATE TABLE ticks (
  user_id   INTEGER PRIMARY KEY,   -- platform's numeric user ID
  user_code TEXT,
  name      TEXT,
  marked_by TEXT,                  -- from the "Your name" field in the review bar
  marked_at TEXT NOT NULL
);
```

## Good to know

- **A tick belongs to the player, not to one request.** Ticking a user marks every request from that
  user, in both sections.
- **The page keeps working without a database.** If `DATABASE_URL` is not set or the API is down,
  ticks are saved in the browser only, and an amber banner says so clearly.
- **No technical details on screen.** The page never shows which database is used, whether login is
  on, or the real error.
