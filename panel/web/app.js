// Fraud Review panel. Plain ES modules, no build step.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const view = $("#view");

// ------------------------------------------------------------------ formatting
const nf = new Intl.NumberFormat("en-IN");
const nf2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = (v) => (v == null ? "" : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]));
const count = (n) => (n == null ? "–" : nf.format(n));
const money = (v) => (v == null ? "–" : (v < 0 ? "−₹" : "₹") + nf.format(Math.abs(Math.round(v))));
const amount = (v) => (v == null ? "–" : (v < 0 ? "−₹" : v > 0 ? "+₹" : "₹") + nf2.format(Math.abs(v)));
const rupees = (v) => (v == null ? "–" : (v < 0 ? "−₹" : "₹") + nf2.format(Math.abs(v)));
const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many}`;
const pct1 = (a, b) => (b ? ((100 * a) / b).toFixed(1) : "0.0");
const pad = (n) => String(n).padStart(2, "0");

const score = (p) => (p == null ? null : Math.min(99, Math.round(p)));
const bandOf = (p) => (p == null ? "n" : p >= 90 ? "vh" : p >= 60 ? "h" : p >= 40 ? "m" : p >= 20 ? "l" : "n");
const BAND_NAME = { vh: "Very high", h: "High", m: "Medium", l: "Low", n: "Normal" };
const bandRange = (b) => `${b.lo}–${b.hi >= 100 ? 99 : b.hi - 1}%`;
const scoreBadge = (p, big = false) =>
  p == null ? '<span class="muted">–</span>' : `<span class="score ${bandOf(p)}${big ? " big" : ""}">${score(p)}%</span>`;

function requestTime(s) {
  const [d, t] = String(s).split(" ");
  const p = d.split("-");
  return p.length === 3 ? `${+p[2]} ${MON[+p[1] - 1]} ${p[0]}, ${t || ""}`.trim() : s;
}
function istTime(t) {
  const d = new Date((t + 19800) * 1000);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
function ageText(d) {
  if (d == null) return "–";
  if (d < 1 / 24) return "Under 1 hour";
  if (d < 1) return plural(Math.round(d * 24), "hour", "hours");
  if (d < 10) {
    let days = Math.floor(d);
    let hours = Math.round((d - days) * 24);
    if (hours === 24) { days += 1; hours = 0; }
    return plural(days, "day", "days") + (hours ? " " + plural(hours, "hour", "hours") : "");
  }
  return plural(Math.round(d), "day", "days");
}
const isNew = (d) => d != null && d < 7;

const STMT_TYPES = [["Deposit", "Deposits"], ["Withdrawal", "Withdrawals"], ["Bonus", "Bonus"], ["Casino", "Casino"], ["Sports", "Sports"], ["Other", "Other"]];
const SPORTS = { 1: "Football", 2: "Tennis", 4: "Cricket", 7: "Horse racing" };
const MARKETS = { 1: "Match odds", 2: "Bookmaker", 3: "Fancy" };
const PATTERN = {
  1: ["P1", "unusual casino play or winnings"],
  2: ["P2", "small deposit, then 10 times or more in casino winnings"],
  3: ["P3", "back and lay, or backing several runners in a market"],
  4: ["P4", "bonus with no deposit"],
};
const PATTERN_RULES = {
  1: ["Unusual casino play or winnings", [
    "85% or more of the play is in the casino",
    "Casino winnings are 4 times the deposits or more, or there is no deposit in the period and casino winnings are ₹10,000 or more"]],
  2: ["Small deposit, then a big casino win", [
    "Only one deposit, of ₹1,000 or less",
    "Winnings are 10 times the deposit or more",
    "90% or more of the play is in the casino",
    "The account is 30 days old or newer"]],
  3: ["Back and lay, or backing several runners", [
    "Back and lay on the same selection, on 150 selections or more",
    "Or backing 2 or more runners in the same market, in 80 markets or more",
    "Or an account less than 2 days old backing 2 or more runners in 3 markets or more"]],
  4: ["Bonus with no deposit", [
    "No deposit in the period",
    "Bonus of ₹300 or more"]],
};
const QUICK = {
  fraud: ["Small deposit, then a big casino win", "Back and lay on the same market", "Bonus used with no deposit",
    "Part of a group of linked accounts", "Bets voided after checking"],
  not_fraud: ["Genuine winner with normal play", "Win came from normal bet sizes", "Platform or game error",
    "Older account with a normal history"],
};

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  inbox: svg('<path d="M3 13h4l2 3h6l2-3h4"/><path d="M5.5 5h13l2.5 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>'),
  check: svg('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 12.5l2 2 4-4.5"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/>'),
  layers: svg('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  ok: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
};

// ------------------------------------------------------------------ api
async function api(path, options = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (res.status === 401) {
    let why = "ended";
    try { why = (await res.json()).reason || why; } catch (e) { /* not json */ }
    location.replace(`/login${why === "replaced" ? "?replaced=1" : why === "ended" ? "?ended=1" : ""}${location.hash}`);
    throw new Error("Your session has ended. Sign in again.");
  }
  if (!res.ok) {
    let msg = `The server returned an error (${res.status}).`;
    try { const j = await res.json(); if (typeof j.detail === "string") msg = j.detail; } catch (e) { /* not json */ }
    throw new Error(msg);
  }
  return res.json();
}

let noticeTimer = 0;
function notify(title, text) {
  const el = $("#notice");
  el.innerHTML = `${ICON.ok}<div class="notice-text"><b>${esc(title)}</b><p>${esc(text)}</p></div>
    <button type="button" class="notice-close" aria-label="Close">${ICON.close}</button>`;
  const hide = () => { clearTimeout(noticeTimer); el.classList.remove("show"); };
  $(".notice-close", el).onclick = hide;
  el.onmouseenter = () => clearTimeout(noticeTimer);
  el.onmouseleave = () => { noticeTimer = setTimeout(hide, 4000); };
  el.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(hide, 9000);
}

let toastTimer = 0;
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ------------------------------------------------------------------ state
const S = {
  D: null,
  reqs: [], byRid: new Map(), byPlayer: new Map(), byCode: new Map(),
  decisions: new Map(),
  signedIn: "", // account name of the reviewer using the panel
  back: "#/review",
  ui: {
    review: { tab: "pending", q: "", min: 60, agent: "", nw: false, t: { sort: "score", dir: -1, page: 0 } },
    requests: { q: "", band: "", agent: "", review: "", min: 0, pat: false, nw: false, grp: false, t: { sort: "score", dir: -1, page: 0 } },
    decisions: { which: "", t: { sort: "at", dir: -1, page: 0 } },
    groups: { t: { sort: "pct", dir: -1, page: 0 } },
  },
};

const playerKey = (uid, code) => (uid != null ? "id:" + uid : "code:" + code);
const decisionOf = (player) => S.decisions.get(player) || null;

function buildData(D) {
  const dic = (k, i) => (i >= 0 ? D.dict[k][i] || "" : "");
  S.reqs = D.W.map((r) => {
    const o = {
      code: r[0], at: r[1], rejected: r[2] === 1, pct: r[3], reasons: dic("k", r[4]), pattern: r[5], pscore: r[6], unusual: r[7],
      group: r[8], master: dic("m", r[9]), wl: dic("wl", r[10]), label: dic("lb", r[11]), remark: dic("rm", r[12]),
      platformReason: dic("rs", r[13]), dep: r[14], depN: r[15], profit: r[16], wd: r[17], casino: r[18], age: r[19],
      bonus: r[20], nBets: r[21], nStmts: r[22], unusualWhy: dic("aj", r[23]), uid: r[24], rid: r[25],
    };
    o.player = playerKey(o.uid, o.code);
    o.text = `${o.code} ${o.master} ${o.wl} ${o.remark}`.toLowerCase();
    return o;
  });
  for (const r of S.reqs) {
    S.byRid.set(r.rid, r);
    (S.byPlayer.get(r.player) || S.byPlayer.set(r.player, []).get(r.player)).push(r);
    (S.byCode.get(r.code) || S.byCode.set(r.code, []).get(r.code)).push(r);
  }
}

function flaggedPlayers() {
  const out = [];
  for (const [player, list] of S.byPlayer) {
    let top = null;
    let rej = 0;
    let last = "";
    for (const r of list) {
      if (r.rejected) rej += 1;
      if (r.at > last) last = r.at;
      if (!top || r.pct > top.pct || (r.pct === top.pct && r.at > top.at)) top = r;
    }
    if (top && top.pct >= 60) out.push({ player, top, code: top.code, n: list.length, rej, last });
  }
  return out;
}

// ------------------------------------------------------------------ small pieces of markup
const stat = (label, value, note = "", cls = "") =>
  `<div class="stat ${cls}"><div class="label">${esc(label)}</div><div class="value">${typeof value === "number" ? count(value) : value}</div>${note ? `<div class="note">${esc(note)}</div>` : ""}</div>`;
const fact = (label, value, note = "") => `<div class="fact"><div class="label">${esc(label)}</div><div class="value">${value}${note ? ` <small>${esc(note)}</small>` : ""}</div></div>`;
const userCell = (r, sub) => `<span class="user">${esc(r.code)}</span><span class="sub">${sub != null ? sub : esc([r.master, r.wl].filter(Boolean).join(" · ") || "–")}</span>`;
const moneyCell = (v) => `<span class="${v < 0 ? "neg" : ""}">${money(v)}</span>`;
const ageCell = (d) => `${esc(ageText(d))}${isNew(d) ? ' <span class="pill new">New</span>' : ""}`;
const agentPill = (rejected) => (rejected ? '<span class="pill out-red">Rejected</span>' : '<span class="pill out-green">Approved</span>');
const decisionPill = (d) =>
  !d ? '<span class="pill gray">Waiting</span>' : d.decision === "fraud" ? '<span class="pill red">Fraud</span>' : '<span class="pill green">Not fraud</span>';
function reasonTags(text, max = 2) {
  if (!text) return '<span class="muted">Looks normal</span>';
  const parts = text.split("; ");
  const shown = parts.slice(0, max).map((p) => `<span class="tag">${esc(p)}</span>`).join("");
  return `<div class="tag-list">${shown}${parts.length > max ? `<span class="tag more">+${parts.length - max} more</span>` : ""}</div>`;
}
const notFound = (text) => `<a class="back" href="${S.back}">${ICON.left} Back</a><div class="card"><div class="empty">${esc(text)}</div></div>`;

function setCrumbs(...parts) {
  $("#crumbs").innerHTML = parts.map((p, i) => (i === parts.length - 1 ? `<b>${esc(p)}</b>` : esc(p))).join(" / ");
  document.title = `${parts[parts.length - 1]} · Fraud Review`;
}

function debounce(fn, ms = 180) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ------------------------------------------------------------------ table with sorting and pages
function mountTable(el, cfg) {
  const st = cfg.state;
  const per = cfg.per || 50;
  let rows = cfg.rows;
  function ordered() {
    const col = cfg.cols.find((c) => c.key === st.sort);
    if (!col || !col.sortVal) return rows;
    const val = col.sortVal;
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null || x === "") return y == null || y === "" ? 0 : 1;
      if (y == null || y === "") return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * st.dir;
    });
  }
  function draw() {
    const list = ordered();
    const pages = Math.max(1, Math.ceil(list.length / per));
    st.page = Math.min(Math.max(0, st.page), pages - 1);
    const from = st.page * per;
    const slice = list.slice(from, from + per);
    const head = cfg.cols.map((c) => {
      const on = st.sort === c.key;
      const aria = on ? ` aria-sort="${st.dir < 0 ? "descending" : "ascending"}"` : "";
      return `<th class="${c.num ? "num " : ""}${c.sortVal ? "sortable" : ""}" data-k="${c.key}"${c.sortVal ? ' tabindex="0"' : ""}${aria}>${esc(c.label)}${on ? `<span class="arw">${st.dir < 0 ? "▼" : "▲"}</span>` : ""}</th>`;
    }).join("");
    const body = slice.length
      ? slice.map((r, i) => `<tr class="${cfg.open ? "click " : ""}${cfg.rowClass ? cfg.rowClass(r) : ""}" data-i="${from + i}"${cfg.open ? ' tabindex="0"' : ""}>${cfg.cols.map((c) => `<td class="${c.num ? "num " : ""}${c.cls || ""}">${c.cell(r)}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${cfg.cols.length}"><div class="empty">${esc(cfg.empty || "Nothing to show.")}</div></td></tr>`;
    const pager = list.length > per
      ? `<div class="pager"><span>${count(from + 1)}–${count(Math.min(from + per, list.length))} of ${count(list.length)}</span><div class="btns">
          <button data-p="first"${st.page === 0 ? " disabled" : ""}>First</button><button data-p="prev"${st.page === 0 ? " disabled" : ""}>Previous</button>
          <button data-p="next"${st.page >= pages - 1 ? " disabled" : ""}>Next</button><button data-p="last"${st.page >= pages - 1 ? " disabled" : ""}>Last</button></div></div>`
      : "";
    el.innerHTML = `<div class="table-wrap"><table class="grid${cfg.compact ? " compact" : ""}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${pager}`;
    $$("th[data-k]", el).forEach((th) => {
      const c = cfg.cols.find((x) => x.key === th.dataset.k);
      if (!c.sortVal) return;
      const go = () => {
        if (st.sort === c.key) st.dir = -st.dir;
        else { st.sort = c.key; st.dir = c.dir0 || -1; }
        st.page = 0;
        draw();
      };
      th.onclick = go;
      th.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
    if (cfg.open) {
      $$("tbody tr[data-i]", el).forEach((tr) => {
        const r = list[+tr.dataset.i];
        tr.onclick = (e) => { if (!e.target.closest("a, button, input, select")) cfg.open(r); };
        tr.onkeydown = (e) => { if (e.key === "Enter") cfg.open(r); };
      });
    }
    $$(".pager button", el).forEach((b) => {
      b.onclick = () => {
        const p = b.dataset.p;
        st.page = p === "first" ? 0 : p === "prev" ? st.page - 1 : p === "next" ? st.page + 1 : pages - 1;
        draw();
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      };
    });
  }
  draw();
  return { draw, setRows(next) { rows = next; st.page = 0; draw(); }, list: () => ordered() };
}

// ------------------------------------------------------------------ navigation
const NAV = [
  ["Review", [["review", "Review queue", ICON.inbox, () => flaggedPlayers().filter((p) => !decisionOf(p.player)).length],
    ["decisions", "Decisions", ICON.check, () => S.decisions.size]]],
  ["Data", [["requests", "Withdrawal requests", ICON.list, () => S.reqs.length],
    ["groups", "Account groups", ICON.users, () => S.D.groups.length],
    ["patterns", "Known patterns", ICON.layers, null]]],
];

function renderNav(active) {
  $("#nav").innerHTML = NAV.map(([label, items]) => `<div class="nav-group"><div class="nav-label">${label}</div>${items.map(([k, l, icon, n]) => {
    const c = n ? n() : null;
    return `<a href="#/${k}" class="${active === k ? "active" : ""}"${active === k ? ' aria-current="page"' : ""}>${icon}<span>${l}</span>${c != null ? `<span class="count">${count(c)}</span>` : ""}</a>`;
  }).join("")}</div>`).join("");
}

const ROUTES = [
  [/^\/review$/, renderReview, "review"],
  [/^\/requests$/, renderRequests, "requests"],
  [/^\/r\/(.+)$/, renderRequest, null],
  [/^\/groups$/, renderGroups, "groups"],
  [/^\/decisions$/, renderDecisions, "decisions"],
  [/^\/patterns$/, renderPatterns, "patterns"],
];

function route() {
  const hash = location.hash.slice(1) || "/review";
  const [path, qs] = hash.split("?");
  const params = new URLSearchParams(qs || "");
  for (const [re, fn, nav] of ROUTES) {
    const m = re.exec(path);
    if (!m) continue;
    const active = nav || (S.back.startsWith("#/review") ? "review" : S.back.startsWith("#/decisions") ? "decisions" : "requests");
    renderNav(active);
    $("#sidebar").classList.remove("open");
    $("#menuBtn").setAttribute("aria-expanded", "false");
    fn(...m.slice(1).map(decodeURIComponent), params);
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
    return;
  }
  location.hash = "#/review";
}

// ------------------------------------------------------------------ review queue
function renderReview() {
  const ui = S.ui.review;
  const players = flaggedPlayers();
  const by = { pending: 0, fraud: 0, not_fraud: 0 };
  for (const p of players) { const d = decisionOf(p.player); by[d ? d.decision : "pending"] += 1; }
  setCrumbs("Review queue");
  view.innerHTML = `
    <div class="page-head"><div><h1>Review queue</h1>
      <p class="sub">Players with at least one withdrawal request scored 60% or higher. Open a player, check the statements and bets, then mark the player as fraud or not fraud.</p></div></div>
    <div class="stat-row">
      ${stat("Waiting for review", by.pending, `of ${plural(players.length, "player", "players")}`, by.pending ? "warn" : "")}
      ${stat("Marked fraud", by.fraud)}
      ${stat("Marked not fraud", by.not_fraud)}
      ${stat("Scored 90% or higher", players.filter((p) => p.top.pct >= 90).length, "players")}
    </div>
    <div class="card">
      <div class="toolbar">
        <div class="seg" role="tablist" aria-label="Review status">${[["pending", "Waiting", by.pending], ["fraud", "Fraud", by.fraud],
          ["not_fraud", "Not fraud", by.not_fraud], ["all", "All", players.length]].map(([k, l, n]) =>
          `<button role="tab" data-tab="${k}" aria-selected="${ui.tab === k}" class="${ui.tab === k ? "on" : ""}">${l}<span class="n">${count(n)}</span></button>`).join("")}</div>
        <input type="search" class="input" id="rq" placeholder="Search user, master or white label" value="${esc(ui.q)}">
        <select class="select" id="rmin" aria-label="Minimum score">${[[60, "Score 60% or higher"], [75, "Score 75% or higher"], [90, "Score 90% or higher"]]
          .map(([v, l]) => `<option value="${v}"${ui.min === v ? " selected" : ""}>${l}</option>`).join("")}</select>
        <select class="select" id="ragent" aria-label="Agent decision"><option value="">Any agent decision</option>
          <option value="rej"${ui.agent === "rej" ? " selected" : ""}>Has a rejected request</option>
          <option value="ok"${ui.agent === "ok" ? " selected" : ""}>All requests approved</option></select>
        <label class="check"><input type="checkbox" id="rnew"${ui.nw ? " checked" : ""}> New accounts only</label>
      </div>
      <div id="rtable"></div>
    </div>`;
  const filter = () => {
    const q = ui.q.trim().toLowerCase();
    return players.filter((p) => {
      const d = decisionOf(p.player);
      if (ui.tab === "pending" && d) return false;
      if ((ui.tab === "fraud" || ui.tab === "not_fraud") && (!d || d.decision !== ui.tab)) return false;
      if (p.top.pct < ui.min) return false;
      if (ui.agent === "rej" && !p.rej) return false;
      if (ui.agent === "ok" && p.rej) return false;
      if (ui.nw && !isNew(p.top.age)) return false;
      return !q || p.top.text.includes(q);
    });
  };
  const table = mountTable($("#rtable"), {
    state: ui.t, rows: filter(),
    empty: ui.tab === "pending" ? "No players are waiting for review." : "No players match these filters.",
    cols: [
      { key: "score", label: "Score", sortVal: (p) => p.top.pct, cell: (p) => scoreBadge(p.top.pct) },
      { key: "user", label: "User", sortVal: (p) => p.code.toLowerCase(), dir0: 1, cell: (p) => userCell(p.top) },
      { key: "last", label: "Latest request", sortVal: (p) => p.last, cls: "nowrap", cell: (p) => esc(requestTime(p.last)) },
      { key: "n", label: "Requests", num: true, sortVal: (p) => p.n, cell: (p) => `${count(p.n)}${p.rej ? `<span class="sub">${count(p.rej)} rejected</span>` : ""}` },
      { key: "why", label: "Main reasons", cls: "reasons", cell: (p) => reasonTags(p.top.reasons) },
      { key: "age", label: "Account age", sortVal: (p) => p.top.age, dir0: 1, cls: "nowrap", cell: (p) => ageCell(p.top.age) },
      { key: "dep", label: "Deposits", num: true, sortVal: (p) => p.top.dep, cell: (p) => money(p.top.dep) },
      { key: "wd", label: "Withdrawn", num: true, sortVal: (p) => p.top.wd, cell: (p) => money(p.top.wd) },
      { key: "pl", label: "Profit", num: true, sortVal: (p) => p.top.profit, cell: (p) => moneyCell(p.top.profit) },
      { key: "review", label: "Review", sortVal: (p) => (decisionOf(p.player) || {}).decision || "", cell: (p) => decisionPill(decisionOf(p.player)) },
    ],
    open: (p) => openRequest(p.top, "#/review"),
    rowClass: (p) => (decisionOf(p.player) ? "done" : ""),
  });
  const refresh = () => table.setRows(filter());
  $$(".seg button", view).forEach((b) => {
    b.onclick = () => {
      ui.tab = b.dataset.tab;
      $$(".seg button", view).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", String(x === b)); });
      refresh();
    };
  });
  $("#rq").oninput = debounce((e) => { ui.q = e.target.value; refresh(); });
  $("#rmin").onchange = (e) => { ui.min = +e.target.value; refresh(); };
  $("#ragent").onchange = (e) => { ui.agent = e.target.value; refresh(); };
  $("#rnew").onchange = (e) => { ui.nw = e.target.checked; refresh(); };
}

function openRequest(r, back) {
  S.back = back;
  location.hash = `#/r/${encodeURIComponent(r.rid)}`;
}

// ------------------------------------------------------------------ all withdrawal requests (section 1)
function inBand(p, lo) {
  const hi = { 90: 101, 60: 90, 40: 60, 20: 40, 0: 20 }[lo];
  return p >= lo && p < hi;
}

function renderRequests(params) {
  const ui = S.ui.requests;
  if (params.has("q")) { ui.q = params.get("q"); ui.band = ""; ui.t.page = 0; }
  const D = S.D;
  const T = D.tot;
  const top = D.band_r[0];
  const low = D.band_r[4];
  setCrumbs("Withdrawal requests");
  view.innerHTML = `
    <div class="page-head"><div><h1>Withdrawal requests</h1>
      <p class="sub">Risk events from ${esc(T.from)} to ${esc(T.to)} (latest request ${esc(T.to_time)}). Each request is scored on the user's bets and statements from up to 20 days before it.</p></div></div>
    <div class="stat-row">
      ${stat("Scored 90% or higher", T.hi, `from ${plural(T.hi_u, "user", "users")}`)}
      ${stat("Rejected by agents at 90%+", pct1(top.rej, top.n) + "%", `Compared with ${pct1(low.rej, low.n)}% below 20%`)}
      ${stat("Confirmed fraud cases", T.fraud_n, `The model alone puts ${D.model.oof90[0]} of ${D.model.oof90[1]} at 90%+`)}
      ${stat("Requests scored", T.scored, `${plural(T.users, "user", "users")}; ${count(T.nodata)} more had no betting data`)}
    </div>
    <div class="bands" id="bands">${D.band_r.map((b) => `<button class="band-card ${bandOf(b.lo)}${ui.band === String(b.lo) ? " on" : ""}" data-lo="${b.lo}" aria-pressed="${ui.band === String(b.lo)}">
      <div class="t">${esc(b.b)} · ${bandRange(b)}</div><div class="c">${count(b.n)}</div>
      <div class="d">${count(b.rej)} rejected (${pct1(b.rej, b.n)}%)</div></button>`).join("")}</div>
    <div class="card">
      <div class="toolbar">
        <input type="search" class="input" id="fq" placeholder="User, master, remark, group (G24) or pattern (P2)" value="${esc(ui.q)}">
        <select class="select" id="fagent" aria-label="Agent decision"><option value="">Any agent decision</option>
          <option value="rej"${ui.agent === "rej" ? " selected" : ""}>Rejected</option><option value="ok"${ui.agent === "ok" ? " selected" : ""}>Approved</option></select>
        <select class="select" id="freview" aria-label="Review"><option value="">Any review</option>
          ${[["pending", "Waiting for review"], ["fraud", "Marked fraud"], ["not_fraud", "Marked not fraud"]].map(([v, l]) => `<option value="${v}"${ui.review === v ? " selected" : ""}>${l}</option>`).join("")}</select>
        <select class="select" id="fmin" aria-label="Minimum score">${[0, 20, 40, 60, 75, 90].map((v) => `<option value="${v}"${ui.min === v ? " selected" : ""}>${v ? `Score ${v}% or higher` : "Any score"}</option>`).join("")}</select>
        <button class="toggle${ui.pat ? " on" : ""}" data-f="pat" aria-pressed="${ui.pat}">Known pattern</button>
        <button class="toggle${ui.nw ? " on" : ""}" data-f="nw" aria-pressed="${ui.nw}">New account</button>
        <button class="toggle${ui.grp ? " on" : ""}" data-f="grp" aria-pressed="${ui.grp}">In a group</button>
        <span class="spacer"></span>
        <button class="btn ghost" id="fclear">Clear filters</button>
      </div>
      <div class="result-line" id="fline"></div>
      <div id="ftable"></div>
    </div>`;
  const filter = () => {
    const q = ui.q.trim().toLowerCase();
    const gm = /^g(\d+)$/.exec(q);
    const pm = /^p([1-4])$/.exec(q);
    return S.reqs.filter((r) => {
      if (ui.band !== "" && !inBand(r.pct, +ui.band)) return false;
      if (r.pct < ui.min) return false;
      if (ui.agent === "rej" && !r.rejected) return false;
      if (ui.agent === "ok" && r.rejected) return false;
      if (ui.review) {
        const d = decisionOf(r.player);
        if (ui.review === "pending" ? d : !d || d.decision !== ui.review) return false;
      }
      if (ui.pat && !r.pattern) return false;
      if (ui.nw && !isNew(r.age)) return false;
      if (ui.grp && !r.group) return false;
      if (gm) return r.group === +gm[1];
      if (pm) return r.pattern === +pm[1];
      return !q || r.text.includes(q);
    });
  };
  const line = (rows) => {
    const users = new Set(rows.map((r) => r.code)).size;
    $("#fline").innerHTML = `<span><b>${count(rows.length)}</b> requests</span><span><b>${count(users)}</b> users</span><span><b>${count(rows.filter((r) => r.rejected).length)}</b> rejected by agents</span>`;
  };
  const rows0 = filter();
  line(rows0);
  const table = mountTable($("#ftable"), {
    state: ui.t, rows: rows0, empty: "No requests match these filters.",
    cols: [
      { key: "score", label: "Score", sortVal: (r) => r.pct, cell: (r) => scoreBadge(r.pct) },
      { key: "user", label: "User", sortVal: (r) => r.code.toLowerCase(), dir0: 1, cell: (r) => userCell(r) },
      { key: "at", label: "Requested (IST)", sortVal: (r) => r.at, cls: "nowrap", cell: (r) => esc(requestTime(r.at)) },
      { key: "agent", label: "Agent decision", sortVal: (r) => (r.rejected ? 1 : 0), cell: (r) => agentPill(r.rejected) },
      { key: "why", label: "Main reasons", cls: "reasons", cell: (r) => reasonTags(r.reasons) },
      { key: "age", label: "Account age", sortVal: (r) => r.age, dir0: 1, cls: "nowrap", cell: (r) => ageCell(r.age) },
      { key: "unusual", label: "Unusual score", num: true, sortVal: (r) => r.unusual, cell: (r) => count(r.unusual) },
      { key: "group", label: "Group", sortVal: (r) => r.group || null, cell: (r) => (r.group ? `G${r.group}` : "") },
      { key: "dep", label: "Deposits", num: true, sortVal: (r) => r.dep, cell: (r) => money(r.dep) },
      { key: "wd", label: "Withdrawn", num: true, sortVal: (r) => r.wd, cell: (r) => money(r.wd) },
      { key: "pl", label: "Profit", num: true, sortVal: (r) => r.profit, cell: (r) => moneyCell(r.profit) },
      { key: "review", label: "Review", sortVal: (r) => (decisionOf(r.player) || {}).decision || "", cell: (r) => decisionPill(decisionOf(r.player)) },
    ],
    open: (r) => openRequest(r, "#/requests"),
  });
  const refresh = () => { const rows = filter(); line(rows); table.setRows(rows); };
  $$("#bands .band-card").forEach((b) => {
    b.onclick = () => {
      ui.band = ui.band === b.dataset.lo ? "" : b.dataset.lo;
      $$("#bands .band-card").forEach((x) => { const on = x.dataset.lo === ui.band; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on)); });
      refresh();
    };
  });
  $("#fq").oninput = debounce((e) => { ui.q = e.target.value; refresh(); });
  $("#fagent").onchange = (e) => { ui.agent = e.target.value; refresh(); };
  $("#freview").onchange = (e) => { ui.review = e.target.value; refresh(); };
  $("#fmin").onchange = (e) => { ui.min = +e.target.value; refresh(); };
  $$(".toggle[data-f]", view).forEach((b) => {
    b.onclick = () => { const k = b.dataset.f; ui[k] = !ui[k]; b.classList.toggle("on", ui[k]); b.setAttribute("aria-pressed", String(ui[k])); refresh(); };
  });
  $("#fclear").onclick = () => {
    Object.assign(ui, { q: "", band: "", agent: "", review: "", min: 0, pat: false, nw: false, grp: false });
    ui.t.page = 0;
    if (location.hash !== "#/requests") location.hash = "#/requests";
    else renderRequests(new URLSearchParams());
  };
}

// ------------------------------------------------------------------ request detail (section 1)
function whyHtml(r, withRemarks) {
  const items = (r.reasons ? r.reasons.split("; ") : ["Looks normal"]).map((x) => `<li>${esc(x)}</li>`).join("");
  let extra = "";
  if (r.pattern && PATTERN[r.pattern]) {
    extra += `<div class="note-box"><b>Known pattern ${PATTERN[r.pattern][0]}:</b> ${esc(PATTERN[r.pattern][1])}. <a href="#/patterns?p=${r.pattern}">See the pattern and its notes</a></div>`;
  }
  const old = S.D.old;
  if (r.age != null && r.age > old.days) {
    extra += `<div class="note-box"><b>Account older than ${old.days} days.</b> Older accounts get a lower score. They reach 90% or more only in very strong cases, and then only between ${old.min}% and ${old.max}%.</div>`;
  }
  if (r.unusualWhy) extra += `<div class="note-box"><b>Different from normal users:</b> ${esc(r.unusualWhy)}</div>`;
  if (withRemarks && (r.remark || r.platformReason)) {
    extra += `<div class="note-box"><b>Agent remark:</b> ${esc(r.remark) || "–"}<br><b>Platform reason:</b> ${esc(r.platformReason) || "–"}</div>`;
  }
  return `<ul class="why-list">${items}</ul>${extra}`;
}

function renderRequest(rid) {
  const r = S.byRid.get(rid);
  if (!r) { setCrumbs("Request"); view.innerHTML = notFound("This request is not in the current data."); return; }
  const all = (S.byPlayer.get(r.player) || []).slice().sort((a, b) => (a.at < b.at ? 1 : -1));
  const others = all.filter((x) => x.rid !== r.rid);
  const backLabel = S.back.startsWith("#/review") ? "Review queue" : S.back.startsWith("#/decisions") ? "Decisions" : "Withdrawal requests";
  setCrumbs(backLabel, r.code);
  view.innerHTML = `
    <a class="back" href="${S.back}">${ICON.left} Back to ${esc(backLabel.toLowerCase())}</a>
    <div class="card detail-head">
      <div>
        <h1>${esc(r.code)}${isNew(r.age) ? '<span class="pill new">New account</span>' : ""}</h1>
        <div class="meta">${[r.uid != null ? `User ID ${r.uid}` : null, r.master ? `Master ${esc(r.master)}` : null, r.wl ? `White label ${esc(r.wl)}` : null].filter(Boolean).join(" · ")}</div>
      </div>
      <div class="score-box">${scoreBadge(r.pct, true)}<div class="band-name">${BAND_NAME[bandOf(r.pct)]} risk</div></div>
    </div>
    <div class="detail-grid">
      <div class="col-main">
        <div class="card"><div class="facts">
          ${fact("Requested (IST)", esc(requestTime(r.at)))}
          ${fact("Agent decision", agentPill(r.rejected))}
          ${fact("Account age", esc(ageText(r.age)))}
          ${fact("Deposits", money(r.dep), plural(r.depN, "deposit", "deposits"))}
          ${fact("Withdrawn", money(r.wd))}
          ${fact("Profit", `<span class="${r.profit < 0 ? "neg" : "pos"}">${money(r.profit)}</span>`)}
          ${fact("Casino share of play", `${r.casino}%`)}
          ${fact("Bonus", money(r.bonus))}
        </div></div>
        <div class="card card-pad"><h2 class="card-title">Why this score</h2>${whyHtml(r, true)}</div>
        <div class="card" id="activity"></div>
      </div>
      <aside class="col-side">
        <div class="card card-pad review" id="review"></div>
        <div class="card card-pad"><h2 class="card-title">Signals</h2><dl class="kv">
          <dt>Known pattern score</dt><dd>${r.pscore != null ? count(Math.min(99, r.pscore)) : "–"}${r.pattern ? " · P" + r.pattern : ""}</dd>
          <dt>Unusual score</dt><dd>${count(Math.min(99, r.unusual))}</dd>
          <dt>Account group</dt><dd>${r.group ? `<a href="#/requests?q=G${r.group}">G${r.group}</a>` : "None"}</dd>
          <dt>Training label</dt><dd>${esc(r.label) || "–"}</dd>
          <dt>Requests from this user</dt><dd>${count(all.length)}</dd>
        </dl></div>
      </aside>
    </div>`;
  mountReview($("#review"), { player: r.player, uid: r.uid, code: r.code, section: 1, rid: r.rid, pct: r.pct });
  mountActivity($("#activity"), { section: 1, key: r.rid, nStmts: r.nStmts, nBets: r.nBets, others, what: "request" });
}

// ------------------------------------------------------------------ statements and bets
const ACT_PER = 100;

function mountActivity(el, ctx) {
  const tabs = [["statements", "Statements", ctx.nStmts], ["bets", "Bets", ctx.nBets]];
  if (ctx.others) tabs.push(["others", "Other requests", ctx.others.length]);
  const st = {
    tab: ctx.nStmts > 0 || !ctx.nBets ? "statements" : "bets",
    statements: { offset: 0, type: null, q: "", order: "desc" },
    bets: { offset: 0, side: null, market: null, q: "", order: "desc" },
  };
  let seq = 0;

  function drawTabs() {
    el.innerHTML = `<div class="tabs" role="tablist">${tabs.map(([k, l, n]) => {
      const na = k !== "others" && !n;
      return `<button role="tab" data-t="${k}" aria-selected="${st.tab === k}" class="${st.tab === k ? "on" : ""}">${l}<span class="n${na ? " na" : ""}">${na ? "NA" : count(n)}</span></button>`;
    }).join("")}</div><div id="actBody"></div>`;
    $$(".tabs button", el).forEach((b) => { b.onclick = () => { st.tab = b.dataset.t; drawTabs(); }; });
    drawBody();
  }

  function drawBody() {
    const box = $("#actBody", el);
    if (st.tab === "others") { drawOthers(box); return; }
    const n = st.tab === "statements" ? ctx.nStmts : ctx.nBets;
    if (!n) {
      box.innerHTML = `<div class="na-box"><b>NA</b>No ${st.tab === "statements" ? "statement entries" : "bets"} came in the data for this ${ctx.what}.</div>`;
      return;
    }
    if (st.tab === "statements") {
      box.innerHTML = `
        <div class="act-head">
          <span class="act-window" id="actWin">Loading…</span><span class="spacer"></span>
          <input type="search" class="input" id="actQ" placeholder="Search description" value="${esc(st.statements.q)}">
          <select class="select" id="actOrder" aria-label="Order"><option value="desc">Newest first</option><option value="asc"${st.statements.order === "asc" ? " selected" : ""}>Oldest first</option></select>
        </div>
        <div class="act-head" id="actChips"></div>
        <div class="sum-line" id="actSum"></div>
        <div id="actRes"></div>`;
    } else {
      box.innerHTML = `
        <div class="act-head">
          <div class="chips" id="sideChips">${[[null, "All"], [1, "Back"], [0, "Lay"]].map(([v, l]) => `<button class="chip${st.bets.side === v ? " on" : ""}" data-v="${v}">${l}</button>`).join("")}</div>
          <select class="select" id="actMarket" aria-label="Market"><option value="">All markets</option>${Object.entries(MARKETS).map(([v, l]) => `<option value="${v}"${String(st.bets.market) === v ? " selected" : ""}>${l}</option>`).join("")}</select>
          <span class="spacer"></span>
          <input type="search" class="input" id="actQ" placeholder="Search selection, event or note" value="${esc(st.bets.q)}">
          <select class="select" id="actOrder" aria-label="Order"><option value="desc">Newest first</option><option value="asc"${st.bets.order === "asc" ? " selected" : ""}>Oldest first</option></select>
        </div>
        <div class="sum-line" id="actSum"></div>
        <div id="actRes"></div>
        <p class="small-note" style="padding:0 16px 14px">Bets have no time in the data, so they are listed in the order the platform numbered them.
          P/L and liability are the amounts on each bet as sent by the platform, not the settled result. Settled sports results are in the statements.</p>`;
      $$("#sideChips .chip", box).forEach((c) => {
        c.onclick = () => {
          st.bets.side = c.dataset.v === "null" ? null : +c.dataset.v;
          st.bets.offset = 0;
          $$("#sideChips .chip", box).forEach((x) => x.classList.toggle("on", x === c));
          load();
        };
      });
      $("#actMarket", box).onchange = (e) => { st.bets.market = e.target.value ? +e.target.value : null; st.bets.offset = 0; load(); };
    }
    const f = st[st.tab];
    $("#actQ", box).oninput = debounce((e) => { f.q = e.target.value.trim(); f.offset = 0; load(); }, 250);
    $("#actOrder", box).onchange = (e) => { f.order = e.target.value; f.offset = 0; load(); };
    load();
  }

  async function load() {
    const tab = st.tab;
    const f = st[tab];
    const p = new URLSearchParams({ section: ctx.section, key: ctx.key, tab, offset: f.offset, limit: ACT_PER, order: f.order });
    if (tab === "statements" && f.type != null) p.set("type", f.type);
    if (tab === "bets" && f.side != null) p.set("side", f.side);
    if (tab === "bets" && f.market != null) p.set("market", f.market);
    if (f.q) p.set("q", f.q);
    const my = ++seq;
    const res$ = $("#actRes", el);
    if (res$ && !res$.innerHTML) res$.innerHTML = '<div class="na-box">Loading…</div>';
    let res;
    try {
      res = await api("/api/activity?" + p);
    } catch (e) {
      if (my === seq && $("#actRes", el)) $("#actRes", el).innerHTML = `<div class="na-box"><b>Could not load</b>${esc(e.message)}</div>`;
      return;
    }
    if (my !== seq || st.tab !== tab) return;
    const box = $("#actBody", el);
    if (!res.available) {
      box.innerHTML = `<div class="na-box"><b>NA</b>The ${tab === "statements" ? "statement entries" : "bets"} for this ${ctx.what} are not in the panel data.</div>`;
      return;
    }
    if (tab === "statements") drawStatements(res, f);
    else drawBets(res, f);
  }

  function pagerHtml(res) {
    if (res.total <= ACT_PER) return "";
    const from = res.offset;
    return `<div class="pager"><span>${count(from + 1)}–${count(Math.min(from + ACT_PER, res.total))} of ${count(res.total)}</span><div class="btns">
      <button data-p="prev"${from === 0 ? " disabled" : ""}>Previous</button><button data-p="next"${from + ACT_PER >= res.total ? " disabled" : ""}>Next</button></div></div>`;
  }
  function bindPager(res, f) {
    $$("#actRes .pager button", el).forEach((b) => {
      b.onclick = () => {
        f.offset = Math.max(0, f.offset + (b.dataset.p === "next" ? ACT_PER : -ACT_PER));
        load();
        $("#actBody", el).scrollIntoView({ block: "start", behavior: "smooth" });
      };
    });
  }

  function drawStatements(res, f) {
    const sum = res.summary || {};
    const win = res.window;
    $("#actWin", el).innerHTML = win
      ? `Entries the score used: <b>${esc(win.from ? istTime(win.from) : "–")}</b> to <b>${esc(istTime(win.to))}</b> (the request)`
      : "All entries in the data for this user";
    $("#actChips", el).innerHTML = `<div class="chips">${[[null, "All", res.count]].concat(STMT_TYPES.map(([, many], k) => [k, many, (sum[k] || {}).n || 0]).filter(([, , n]) => n))
      .map(([k, l, n]) => `<button class="chip${f.type === k ? " on" : ""}" data-k="${k}">${l}<span class="n">${count(n)}</span></button>`).join("")}</div>`;
    $$("#actChips .chip", el).forEach((c) => {
      c.onclick = () => { f.type = c.dataset.k === "null" ? null : +c.dataset.k; f.offset = 0; load(); };
    });
    const totals = [[0, "Deposits"], [1, "Withdrawals"], [3, "Casino net"], [4, "Sports net"], [2, "Bonus"]]
      .filter(([k]) => sum[k]).map(([k, l]) => `<span>${l} <b class="${sum[k].sum < 0 ? "neg" : ""}">${rupees(sum[k].sum)}</b></span>`);
    $("#actSum", el).innerHTML = totals.join("") || "<span>No money movement</span>";
    const rows = res.rows.map(([t, k, d, a, b]) => `<tr><td class="nowrap mono">${esc(istTime(t))}</td><td><span class="kind k${k}">${STMT_TYPES[k][0]}</span></td>
      <td class="desc">${esc(d)}</td><td class="num ${a < 0 ? "neg" : a > 0 ? "pos" : ""}">${amount(a)}</td><td class="num">${rupees(b)}</td></tr>`).join("");
    $("#actRes", el).innerHTML = `<div class="table-wrap"><table class="grid compact"><thead><tr><th>Time (IST)</th><th>Type</th><th>Description</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5"><div class="empty">No entries match.</div></td></tr>`}</tbody></table></div>${pagerHtml(res)}`;
    bindPager(res, f);
  }

  function drawBets(res, f) {
    const s = res.summary;
    $("#actSum", el).innerHTML = `<span>Back <b>${count(s.back)}</b></span><span>Lay <b>${count(s.lay)}</b></span>
      ${Object.entries(s.markets).map(([m, n]) => `<span>${esc(MARKETS[m] || "Other market")} <b>${count(n)}</b></span>`).join("")}
      <span>Total stake <b>${rupees(s.stake)}</b></span>`;
    const rows = res.rows.map((r) => {
      const [i, sport, event, mtype, sel, side, odds, req, stake, pl, liability, status, note, market] = r;
      return `<tr><td class="num muted">${count(i)}</td><td>${esc(SPORTS[sport] || (sport != null ? `Sport ${sport}` : "–"))}</td>
        <td>${esc(MARKETS[mtype] || "–")}<span class="sub mono">Event ${esc(event || "–")}</span></td>
        <td title="Market ${esc(market)}">${esc(sel) || "–"}</td>
        <td>${side === 1 ? '<span class="side-tag back">Back</span>' : side === 0 ? '<span class="side-tag lay">Lay</span>' : "–"}</td>
        <td class="num">${odds == null ? "–" : nf2.format(odds)}${req != null ? `<span class="sub">asked ${nf2.format(req)}</span>` : ""}</td>
        <td class="num">${rupees(stake)}</td><td class="num">${rupees(pl)}</td><td class="num">${rupees(liability)}</td>
        <td class="num">${status == null ? "–" : status}</td><td>${esc(note || "")}</td></tr>`;
    }).join("");
    $("#actRes", el).innerHTML = `<div class="table-wrap"><table class="grid compact"><thead><tr><th class="num">#</th><th>Sport</th><th>Market</th><th>Selection</th><th>Side</th>
      <th class="num">Odds</th><th class="num">Stake</th><th class="num">P/L (platform)</th><th class="num">Liability</th><th class="num" title="Status code as sent by the platform">Status</th><th>Note</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="11"><div class="empty">No bets match.</div></td></tr>`}</tbody></table></div>${pagerHtml(res)}`;
    bindPager(res, f);
  }

  function drawOthers(box) {
    if (!ctx.others.length) { box.innerHTML = '<div class="na-box">This user has no other withdrawal requests in the data.</div>'; return; }
    box.innerHTML = '<div id="othersTable"></div>';
    mountTable($("#othersTable", box), {
      state: { sort: "at", dir: -1, page: 0 }, rows: ctx.others, per: 20, compact: true,
      cols: [
        { key: "score", label: "Score", sortVal: (r) => r.pct, cell: (r) => scoreBadge(r.pct) },
        { key: "at", label: "Requested (IST)", sortVal: (r) => r.at, cls: "nowrap", cell: (r) => esc(requestTime(r.at)) },
        { key: "agent", label: "Agent decision", cell: (r) => agentPill(r.rejected) },
        { key: "remark", label: "Agent remark", cell: (r) => esc(r.remark) || '<span class="muted">–</span>' },
        { key: "dep", label: "Deposits", num: true, cell: (r) => money(r.dep) },
        { key: "wd", label: "Withdrawn", num: true, cell: (r) => money(r.wd) },
        { key: "pl", label: "Profit", num: true, cell: (r) => moneyCell(r.profit) },
      ],
      open: (r) => { location.hash = `#/r/${encodeURIComponent(r.rid)}`; },
    });
  }

  drawTabs();
}

// ------------------------------------------------------------------ review box
function reviewNotice(code, decision) {
  return decision === "fraud"
    ? `${code} is marked as fraud. Your decision is saved and will be used to retrain the model at the next update, so similar cases are scored more accurately.`
    : `${code} is marked as not fraud. Your decision is saved and will be used to retrain the model at the next update, so genuine players like this get fewer alerts.`;
}

function nextWaiting(exceptPlayer) {
  const list = flaggedPlayers().filter((p) => p.player !== exceptPlayer && !decisionOf(p.player));
  list.sort((a, b) => b.top.pct - a.top.pct || (a.last < b.last ? 1 : -1));
  return list[0] || null;
}

function mountReview(el, ctx) {
  let editing = !decisionOf(ctx.player);
  let choice = null;
  let draft = "";

  function draw() {
    const d = decisionOf(ctx.player);
    if (d && !editing) {
      el.innerHTML = `<h2 class="card-title">Review</h2>
        <div class="decided">${decisionPill(d)}<span class="by">by ${esc(d.reviewer)} on ${esc(d.at)} IST</span></div>
        <p class="reason-text">${esc(d.reason)}</p>
        <div class="btn-row"><button class="btn" id="rvChange">Change</button><button class="btn ghost danger" id="rvClear">Remove decision</button></div>`;
      $("#rvChange", el).onclick = () => { editing = true; choice = d.decision; draft = d.reason; draw(); };
      $("#rvClear", el).onclick = clear;
      return;
    }
    const quick = choice ? QUICK[choice] : [];
    el.innerHTML = `<h2 class="card-title">Review</h2>
      <p class="hint">Mark this player after checking the statements and bets.</p>
      <div class="choice">
        <button class="choice-btn fraud${choice === "fraud" ? " on" : ""}" data-c="fraud" aria-pressed="${choice === "fraud"}">Fraud</button>
        <button class="choice-btn ok${choice === "not_fraud" ? " on" : ""}" data-c="not_fraud" aria-pressed="${choice === "not_fraud"}">Not fraud</button>
      </div>
      <div class="field"><label class="label" for="rvReason">Reason</label>
        ${quick.length ? `<div class="quick">${quick.map((t) => `<button type="button" class="quick-chip">${esc(t)}</button>`).join("")}</div>` : ""}
        <textarea id="rvReason" rows="3" placeholder="${choice ? "Explain the decision. It goes back to the platform and is used for training." : "Choose Fraud or Not fraud first."}"${choice ? "" : " disabled"}>${esc(draft)}</textarea></div>
      <div class="field"><span class="label">Reviewer</span><div>${esc(S.signedIn)}</div></div>
      <div class="form-error" id="rvErr" hidden></div>
      <div class="btn-row"><button class="btn primary" id="rvSave">Submit</button><button class="btn" id="rvNext">Submit and open next</button>
        ${decisionOf(ctx.player) ? '<button class="btn ghost" id="rvCancel">Cancel</button>' : ""}</div>`;
    $$(".choice-btn", el).forEach((b) => { b.onclick = () => { draft = $("#rvReason", el).value; choice = b.dataset.c; draw(); $("#rvReason", el).focus(); }; });
    $$(".quick-chip", el).forEach((b) => {
      b.onclick = () => {
        const ta = $("#rvReason", el);
        const cur = ta.value.trim();
        ta.value = cur ? `${cur.replace(/[.;,]$/, "")}; ${b.textContent}` : b.textContent;
        draft = ta.value;
        ta.focus();
      };
    });
    $("#rvReason", el).oninput = (e) => { draft = e.target.value; };
    $("#rvSave", el).onclick = () => save(false);
    $("#rvNext", el).onclick = () => save(true);
    const cancel = $("#rvCancel", el);
    if (cancel) cancel.onclick = () => { editing = false; draw(); };
  }

  function fail(msg) {
    const e = $("#rvErr", el);
    e.textContent = msg;
    e.hidden = false;
  }

  async function save(goNext) {
    const updated = !!decisionOf(ctx.player);
    const reason = $("#rvReason", el).value.trim();
    if (!choice) return fail("Choose Fraud or Not fraud.");
    if (reason.length < 3) return fail("Write a short reason.");
    const body = { player: ctx.player, user_id: ctx.uid ?? null, code: ctx.code, section: ctx.section, record_id: ctx.rid || null,
      decision: choice, reason, score: ctx.pct ?? null };
    $$(".btn", el).forEach((b) => { b.disabled = true; });
    try {
      const saved = await api("/api/decisions", { method: "PUT", body: JSON.stringify(body) });
      S.decisions.set(ctx.player, saved);
    } catch (e) {
      $$(".btn", el).forEach((b) => { b.disabled = false; });
      return fail(e.message);
    }
    editing = false;
    draft = "";
    renderNav(document.querySelector(".nav a.active")?.getAttribute("href")?.slice(2) || "review");
    const next = goNext ? nextWaiting(ctx.player) : null;
    notify(updated ? "Review updated" : "Review submitted",
      reviewNotice(ctx.code, choice) + (goNext && !next ? " No more players are waiting for review." : ""));
    if (next) { openRequest(next.top, "#/review"); return; }
    draw();
  }

  async function clear() {
    if (!window.confirm("Remove the decision for this player?")) return;
    try {
      await api(`/api/decisions?player=${encodeURIComponent(ctx.player)}`, { method: "DELETE" });
    } catch (e) { toast(e.message); return; }
    S.decisions.delete(ctx.player);
    editing = true;
    choice = null;
    draft = "";
    toast("Decision removed");
    renderNav(document.querySelector(".nav a.active")?.getAttribute("href")?.slice(2) || "review");
    draw();
  }

  draw();
}

// ------------------------------------------------------------------ account groups
function renderGroups() {
  setCrumbs("Account groups");
  view.innerHTML = `
    <div class="page-head"><div><h1>Account groups</h1>
      <p class="sub">Three or more users under the same master who show similar unusual behaviour within 72 hours. A group can point to organised fraud. Open a group to see its requests.</p></div></div>
    <div class="card"><div id="gtable"></div></div>`;
  mountTable($("#gtable"), {
    state: S.ui.groups.t, rows: S.D.groups, empty: "No account groups in the current data.",
    cols: [
      { key: "id", label: "Group", sortVal: (g) => g.id, dir0: 1, cell: (g) => `<span class="user">G${g.id}</span>` },
      { key: "master", label: "Master", sortVal: (g) => g.master, dir0: 1, cell: (g) => esc(g.master) },
      { key: "pct", label: "Median score", sortVal: (g) => g.pct, cell: (g) => scoreBadge(g.pct) },
      { key: "users", label: "Users", num: true, sortVal: (g) => g.users, cell: (g) => count(g.users) },
      { key: "records", label: "Requests", num: true, sortVal: (g) => g.records, cell: (g) => count(g.records) },
      { key: "rej", label: "Rejected", num: true, sortVal: (g) => g.rej, cell: (g) => count(g.rej) },
      { key: "dep", label: "Median deposit", num: true, sortVal: (g) => g.dep, cell: (g) => money(g.dep) },
      { key: "wd", label: "Median withdrawn", num: true, sortVal: (g) => g.wd, cell: (g) => money(g.wd) },
      { key: "pl", label: "Median profit", num: true, sortVal: (g) => g.pl, cell: (g) => moneyCell(g.pl) },
      { key: "casino", label: "Casino", num: true, sortVal: (g) => g.casino, cell: (g) => `${g.casino}%` },
      { key: "age", label: "Account age", sortVal: (g) => g.age, dir0: 1, cls: "nowrap", cell: (g) => esc(ageText(g.age)) },
      { key: "from", label: "Period (IST)", sortVal: (g) => g.from, cls: "nowrap", cell: (g) => `${esc(requestTime(g.from))}<span class="sub">to ${esc(requestTime(g.to))}</span>` },
    ],
    open: (g) => { S.ui.requests = { ...S.ui.requests, q: `G${g.id}`, band: "" }; location.hash = `#/requests?q=G${g.id}`; },
  });
}

// ------------------------------------------------------------------ decisions
function renderDecisions() {
  const ui = S.ui.decisions;
  const all = [...S.decisions.values()];
  const nFraud = all.filter((d) => d.decision === "fraud").length;
  setCrumbs("Decisions");
  view.innerHTML = `
    <div class="page-head"><div><h1>Decisions</h1>
      <p class="sub">Every player marked in this panel. Each decision is used to retrain the model at the next update. Export the list to send the results back to the platform.</p></div>
      <a class="btn" href="/api/decisions.csv" download>${ICON.download} Export CSV</a></div>
    <div class="stat-row">${stat("Players reviewed", all.length)}${stat("Marked fraud", nFraud)}${stat("Marked not fraud", all.length - nFraud)}
      ${stat("Reviewers", new Set(all.map((d) => d.reviewer)).size)}</div>
    <div class="card">
      <div class="toolbar"><div class="seg">${[["", "All"], ["fraud", "Fraud"], ["not_fraud", "Not fraud"]].map(([k, l]) =>
        `<button data-w="${k}" class="${ui.which === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div id="dtable"></div>
    </div>`;
  const rows = () => all.filter((d) => !ui.which || d.decision === ui.which);
  const table = mountTable($("#dtable"), {
    state: ui.t, rows: rows(), empty: "No decisions yet. Open the review queue to start.",
    cols: [
      { key: "at", label: "Decided (IST)", sortVal: (d) => d.at, cls: "nowrap", cell: (d) => esc(d.at) },
      { key: "code", label: "User", sortVal: (d) => String(d.code).toLowerCase(), dir0: 1, cell: (d) => `<span class="user">${esc(d.code)}</span><span class="sub">${d.user_id != null ? `ID ${d.user_id}` : "–"}</span>` },
      { key: "decision", label: "Decision", sortVal: (d) => d.decision, cell: (d) => decisionPill(d) },
      { key: "reason", label: "Reason", cls: "reasons", cell: (d) => esc(d.reason) },
      { key: "reviewer", label: "Reviewer", sortVal: (d) => d.reviewer.toLowerCase(), dir0: 1, cell: (d) => esc(d.reviewer) },
      { key: "score", label: "Score", sortVal: (d) => d.score, cell: (d) => scoreBadge(d.score) },
    ],
    open: (d) => {
      S.back = "#/decisions";
      const r = (d.record_id && S.byRid.get(d.record_id)) || (S.byPlayer.get(d.player) || [])[0];
      if (r) location.hash = `#/r/${encodeURIComponent(r.rid)}`;
      else toast("This player is not in the current data");
    },
  });
  $$(".seg button", view).forEach((b) => {
    b.onclick = () => { ui.which = b.dataset.w; $$(".seg button", view).forEach((x) => x.classList.toggle("on", x === b)); table.setRows(rows()); };
  });
}

// ------------------------------------------------------------------ known patterns
function patternStats() {
  const st = {};
  for (const n of [1, 2, 3, 4]) st[n] = { n: 0, users: new Set(), rej: 0, fraud: 0, not_fraud: 0 };
  for (const r of S.reqs) {
    const s = st[r.pattern];
    if (!s) continue;
    s.n += 1;
    s.users.add(r.code);
    if (r.rejected) s.rej += 1;
  }
  for (const d of S.decisions.values()) {
    const r = d.record_id && S.byRid.get(d.record_id);
    if (r && st[r.pattern]) st[r.pattern][d.decision] += 1;
  }
  return st;
}

function renderPatterns(params) {
  const st = patternStats();
  const by = (S.D.pattern && S.D.pattern.by) || {};
  const pstat = (value, label, note) => `<div><b>${value}</b><span>${esc(label)}</span>${note ? `<small>${esc(note)}</small>` : ""}</div>`;
  setCrumbs("Known patterns");
  view.innerHTML = `
    <div class="page-head"><div><h1>Known patterns</h1>
      <p class="sub">Fraud patterns found in confirmed cases. Every request is checked against them, using the user's statements and bets from up to 20 days before the request. Add a note when you notice something new about a pattern. Notes are read at each model update.</p></div></div>
    <div class="pattern-grid">${[1, 2, 3, 4].map((n) => {
      const [title, checks] = PATTERN_RULES[n];
      const s = st[n];
      return `<section class="card pattern" id="pat${n}" aria-labelledby="patTitle${n}">
        <div class="pattern-head"><span class="pattern-code">P${n}</span><h2 id="patTitle${n}">${esc(title)}</h2></div>
        <div class="pattern-body">
          <div class="label">What the check looks for</div>
          <ul class="check-list">${checks.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
          <div class="pattern-stats">
            ${pstat(count(by["P" + n] || 0), "Confirmed fraud cases", "used to set the check")}
            ${pstat(count(s.n), "Matching requests", `from ${plural(s.users.size, "user", "users")}`)}
            ${pstat(count(s.rej), "Rejected by agents", "of the matching requests")}
            ${pstat(count(s.fraud), "Marked fraud here", `${count(s.not_fraud)} marked not fraud`)}
          </div>
          ${s.n ? `<a class="btn" href="#/requests?q=P${n}">View matching requests</a>` : ""}
        </div>
        <div class="notes" data-p="P${n}">
          <div class="notes-head"><h3>Notes</h3><span class="muted" data-count></span></div>
          <form class="note-form">
            <textarea rows="2" maxlength="2000" aria-label="Note about P${n}" placeholder="Write what you have noticed about this pattern"></textarea>
            <div class="note-actions"><span class="form-error" hidden></span><button class="btn primary" type="submit">Add note</button></div>
          </form>
          <ul class="note-list"><li class="muted">Loading notes…</li></ul>
        </div>
      </section>`;
    }).join("")}</div>`;

  const grid = $(".pattern-grid", view);
  let notes = [];
  const mine = (x) => x.author.toLowerCase() === S.signedIn.toLowerCase();
  function drawNotes() {
    for (const box of $$(".notes", grid)) {
      const list = notes.filter((x) => x.pattern === box.dataset.p);
      $("[data-count]", box).textContent = list.length ? plural(list.length, "note", "notes") : "";
      $(".note-list", box).innerHTML = list.length
        ? list.map((x) => `<li><div class="note-meta"><b>${esc(x.author)}</b><span>${esc(requestTime(x.at))} IST</span>
            ${mine(x) ? `<button type="button" class="link-btn" data-del="${x.id}">Remove</button>` : ""}</div><p>${esc(x.note)}</p></li>`).join("")
        : '<li class="muted">No notes yet.</li>';
    }
    $$("[data-del]", grid).forEach((b) => { b.onclick = () => removeNote(+b.dataset.del); });
  }
  async function removeNote(id) {
    if (!window.confirm("Remove this note?")) return;
    try { await api(`/api/pattern-notes?id=${id}`, { method: "DELETE" }); } catch (e) { toast(e.message); return; }
    notes = notes.filter((x) => x.id !== id);
    drawNotes();
    toast("Note removed");
  }
  $$(".note-form", grid).forEach((f) => {
    const ta = $("textarea", f);
    const err = $(".form-error", f);
    const btn = $("button", f);
    ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) f.requestSubmit(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const pattern = f.closest(".notes").dataset.p;
      const note = ta.value.trim();
      if (!note) { err.textContent = "Write a note first."; err.hidden = false; ta.focus(); return; }
      err.hidden = true;
      btn.disabled = true;
      try {
        notes.unshift(await api("/api/pattern-notes", { method: "POST", body: JSON.stringify({ pattern, note }) }));
        ta.value = "";
        drawNotes();
        toast(`Note added to ${pattern}`);
      } catch (x) {
        err.textContent = x.message;
        err.hidden = false;
      }
      btn.disabled = false;
    };
  });
  api("/api/pattern-notes").then((res) => {
    if (!grid.isConnected) return;
    notes = res.notes;
    drawNotes();
  }).catch((e) => {
    $$(".note-list", grid).forEach((ul) => { ul.innerHTML = `<li class="form-error">${esc(e.message)}</li>`; });
  });

  const card = $(`#pat${params.get("p")}`, grid);
  if (card) {
    requestAnimationFrame(() => {
      card.scrollIntoView({ block: "start" });
      card.classList.add("flash");
    });
  }
}

// ------------------------------------------------------------------ start
function initials(name) {
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  const m = /^(\D)\D*(\d{1,2})$/.exec(name);
  return (m ? m[1] + m[2] : name.slice(0, 2)).toUpperCase();
}

function wireShell() {
  $("#whoName").textContent = S.signedIn;
  $("#avatar").textContent = initials(S.signedIn);
  $("#signOut").onclick = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {
      toast("Could not sign out. Check your connection and try again.");
      return;
    }
    location.replace("/login?out=1");
  };
  const T = S.D.tot;
  $("#dataNote").textContent = `Data ${T.from} to ${T.to}, latest request ${T.to_time}.${S.D.updated ? ` Model updated ${S.D.updated}.` : ""}`;
  $("#menuBtn").onclick = () => {
    const open = !$("#sidebar").classList.contains("open");
    $("#sidebar").classList.toggle("open", open);
    $("#menuBtn").setAttribute("aria-expanded", String(open));
  };
  $("#globalSearch").onsubmit = (e) => {
    e.preventDefault();
    const q = $("#globalQ").value.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    const reqs = S.byCode.get(lower) || S.byCode.get(q);
    if (reqs && reqs.length) {
      const top = reqs.slice().sort((a, b) => b.pct - a.pct)[0];
      openRequest(top, "#/requests");
    } else {
      S.ui.requests.q = q;
      location.hash = `#/requests?q=${encodeURIComponent(q)}`;
    }
    $("#globalQ").value = "";
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.target.closest("input, textarea, select")) { e.preventDefault(); $("#globalQ").focus(); }
  });
}

// Signing in on another browser ends this session; check now and then so this tab finds out.
function watchSession() {
  const check = () => { api("/api/session").catch(() => { /* offline, try again later */ }); };
  setInterval(check, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
}

async function init() {
  try {
    const [D, dec, me] = await Promise.all([api("/api/dashboard"), api("/api/decisions"), api("/api/me")]);
    S.signedIn = me.user || "";
    S.D = D;
    buildData(D);
    for (const d of dec.decisions) S.decisions.set(d.player, d);
  } catch (e) {
    view.innerHTML = `<div class="error-box"><b>The data could not be loaded.</b>${esc(e.message)}</div>`;
    return;
  }
  wireShell();
  watchSession();
  window.addEventListener("hashchange", route);
  route();
}

init();
