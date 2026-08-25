# Seven Rules Fraud Console

MiraiGate ka fraud review dashboard — **React (Vite)** + **SQLite (libSQL)**.

7 rules ki final lists (921 unique players, 1,063 rule-hits). Har player ko
**"Fraud confirm"** tick kiya ja sakta hai, aur wo tick **database me** save hota hai —
isliye incognito me bhi nahi udta aur har device par ek hi list dikhti hai.

---

## Chalane ke liye

```bash
npm install
cp .env.example .env          # DATABASE_URL=file:local.db  (asli SQLite file)
npm run db:init               # table bana deta hai
```

Do terminal chahiye:

```bash
npm run dev:api               # API  -> http://localhost:3001
```

```bash
npm run dev                   # App  -> http://localhost:5173
```

Vite `/api` ko 3001 par proxy kar deta hai, isliye app seedhe kaam karega.
`local.db` `.gitignore` me hai — repo me commit nahi hogi.

---

## Vercel par deploy

### 1. Database — Turso

Vercel par **seedhi SQLite file kaam nahi karti**. Uska filesystem har deploy/request
par reset ho jata hai, to ticks ud jayenge. Isliye Turso (hosted SQLite, free tier):

```bash
npm i -g turso
turso auth signup
turso db create fraud-console
turso db show fraud-console --url         # libsql://... URL
turso db tokens create fraud-console      # auth token
```

Table bana lo:

```bash
turso db shell fraud-console < schema.sql
```

### 2. Deploy

```bash
npm i -g vercel
vercel
```

### 3. Vercel me environment variables

Project → Settings → Environment Variables:

| Name | Value | Kis liye |
|---|---|---|
| `DATABASE_URL` | `libsql://<db>-<org>.turso.io` | Turso ka URL |
| `DATABASE_AUTH_TOKEN` | `<token>` | Turso ka token |
| `BASIC_AUTH_USER` | jo chaho | login username |
| `BASIC_AUTH_PASS` | **strong password** | login password |

Set karne ke baad ek baar redeploy karo, warna nayi values nahi lagti.

> **Login zaroori hai.** `BASIC_AUTH_*` set nahi karoge to site **bina password ke**
> khulegi. Is page par 921 asli players ka User ID, naam, deposit, withdrawal aur
> P&L hai — koi bhi URL wala sab dekh lega.

`middleware.js` ye login handle karta hai (Vercel ka apna Password Protection Pro
plan ka feature hai; ye free Hobby par bhi chalta hai).

---

## Data update karna

Rule lists `src/data.json` me hain. Naya data banane ke liye:

```bash
python ../build_dashboard_data.py       # exact_rules/Final ki 7 Excel se JSON banata hai
cp ../dashboard_data.json src/data.json
npm run build
```

Ticks database me alag rehte hain, isliye data update karne se tick nahi jaate.

---

## Kya kahan hai

```
index.html              Vite entry
vite.config.js          build + /api proxy (dev)
vercel.json             build config + security headers (noindex, no-store, ...)
middleware.js           Basic Auth (BASIC_AUTH_USER / BASIC_AUTH_PASS)
schema.sql              ticks table

api/
  _db.js                libSQL client + schema + helpers
  ticks.js              GET / POST / DELETE  /api/ticks

scripts/
  dev-api.js            local API server (vercel dev ke bina)
  init-db.js            npm run db:init

src/
  main.jsx              React root
  App.jsx               header, tabs, banners, layout
  useTicks.js           tick state — DB, aur DB na mile to localStorage
  format.js             ₹ / number formatting, W-L blocks
  styles.css            poora theme (light + dark, tokens se)
  data.json             7 rules ka data (921 players)
  components/
    ReviewBar.jsx       counter, reviewer naam, copy list, clear
    Overview.jsx        7 rule cards + multi-rule overlap
    RulePanel.jsx       filters, sortable table, tick column, detail row
```

---

## API

```
GET    /api/ticks    -> { ok, persistent, ticks: [...] }
POST   /api/ticks    body { userId, userCode, name, on, markedBy }
DELETE /api/ticks    -> saare ticks hatao
```

Response me `persistent` ke alawa kuch nahi jaata — na database ka naam, na URL, na
login ki halat, na SQL ka asli error. Client ko sirf itna pata chalta hai ki tick
permanently save hua ya nahi.

Table:

```sql
CREATE TABLE ticks (
  user_id   INTEGER PRIMARY KEY,
  user_code TEXT,
  name      TEXT,
  marked_by TEXT,
  marked_at TEXT NOT NULL
);
```

`marked_by` review bar wale "Aapka naam" field se aata hai — kisne kis player ko
confirm kiya, uska record rehta hai.

---

## Do baatein jaan lo

**Tick player ke saath juda hai, rule ke saath nahi.** Ek player agar P1, R8 aur R13
teeno me hai, to kisi ek jagah tick karne se teeno tabs me ticked dikhega.

**DB na mile to app band nahi hota.** `DATABASE_URL` set nahi hai ya API down hai to
app localStorage par chalta rehta hai, aur upar amber banner user ko saaf batata hai ki
ticks sirf isi browser me hain — taaki kaam chup-chap na khoye.

**Frontend par koi technical detail nahi dikhti.** Kaunsa database hai, login laga hai
ya nahi, ya asli error kya tha — kuch bhi screen par nahi jaata. Error server log me
jaata hai (Vercel -> Logs). Sab theek chal raha ho to koi status badge bhi nahi dikhta.
