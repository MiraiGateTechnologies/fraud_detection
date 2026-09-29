/**
 * Fraud Detection dashboard.
 *
 * Loads public/data/dashboard.json (built by the fraud scoring pipeline) and renders three views:
 * Section 1 (risk events from 15 Sep), Section 2 (Newdata folder, July) and Model and accuracy.
 * The "Confirmed fraud" tick in the last table column is saved through /api/ticks (see src/ticks.js).
 */
import "./styles.css";
import { createTicks, loadReviewer, saveReviewer } from "./ticks.js";

const loading = document.querySelector("#loading");
fetch("/data/dashboard.json", { cache: "no-cache" })
  .then((r) => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  })
  .then(init)
  .catch(() => {
    loading.textContent = "The data could not be loaded. Refresh the page to try again.";
  });

function init(D) {
  const T = D.tot, DC = D.dict;
  const $ = s => document.querySelector(s);
  const nf = new Intl.NumberFormat("en-IN");
  const fmt = n => n == null ? "–" : nf.format(n);
  const rs = n => n == null ? "–" : "₹" + nf.format(n);
  const esc = s => s == null ? "" : String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const dic = (k, i) => i >= 0 ? DC[k][i] : "";
  const bk = p => p == null ? "b0" : p >= 80 ? "b80" : p >= 60 ? "b60" : p >= 40 ? "b40" : p >= 20 ? "b20" : "b0";
  const pill = p => `<span class="fp ${bk(p)}">${p == null ? "–" : Math.round(p) + "%"}</span>`;
  const plural = (n, one, many) => fmt(n) + " " + (n === 1 ? one : many);
  const pct1 = (a, b) => (100 * a / Math.max(1, b)).toFixed(1);
  const ageTxt = d => d == null ? "–" : d < 1 ? plural(Math.max(1, Math.round(d * 24)), "hour", "hours") : d < 10 ? d.toFixed(1) + " days" : fmt(Math.round(d)) + " days";
  const isNew = d => d != null && d < 7;
  const ageCell = d => (isNew(d) ? '<span class="tag new">New</span> ' : "") + `<span class="mono">${ageTxt(d)}</span>`;
  const mult = x => x == null ? "–" : x + "x";
  const reasons = s => s ? s.split("; ").map(x => `<span class="rsn">${esc(x)}</span>`).join("") : "";
  const oldNote = d => d != null && d > D.old.days ? `<br><b>Account older than ${D.old.days} days:</b> the score was lowered. It can reach 80% or more only with a strong known-pattern match (pattern score ${D.old.p80_old} or higher).` : "";
  const TK = createTicks(onTicks);
  const tickNote = id => { const t = id != null && TK.get(id); return t ? `<br><b>Confirmed fraud:</b> marked${t.by ? " by " + esc(t.by) : ""}${t.at ? " on " + esc(t.at.slice(0, 10)) : ""}.` : ""; };
  const tickCell = (S, r) => {
    const id = S.uid(r);
    if (id == null) return '<td class="tickcell"><span class="mono">–</span></td>';
    return `<td class="tickcell"><input type="checkbox" class="tick" data-uid="${id}" data-code="${esc(r[0])}"${TK.has(id) ? " checked" : ""}${TK.isBusy(id) || TK.mode() === "loading" ? " disabled" : ""} aria-label="Mark ${esc(r[0])} as confirmed fraud"></td>`;
  };
  const PAT = ["", "P1", "P2", "P3", "P4"];
  const PATN = {P1: "unusual casino play or winnings", P2: "small deposit, then 10x or more casino winnings", P3: "back and lay, or backing several runners", P4: "bonus with no deposit"};
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const exLines = rows => rows.map(([k, v]) => (k + "           ").slice(0, 11) + v).join("\n");

  // ---------------------------------------------------------------- datasets
  const SETS = {
    withdrawals: {
      rows: D.W, pct: r => r[3], uid: r => r[24], age: r => r[19], why: r => dic("k", r[4]), one: "request", many: "requests", bands: D.band_r,
      title: "How the score works for these requests",
      what: "Each row is one withdrawal request. The score uses only the bets and statements the user had before the request, for up to the last 30 days.",
      howL: "How the score is calculated",
      how: `The score has two parts. The first checks how closely the user matches the four known fraud patterns (P1–P4). The second checks how far the user's behaviour is from normal users, mainly when a user wins far more than they deposit. The final score is the higher of the two. Accounts older than ${D.old.days} days get a lower score, and they reach 80% or more only with a strong match to a known pattern. The ${T.fraud_n} confirmed fraud cases were scored without the model seeing them.`,
      listTitle: "All withdrawal requests",
      bandSub: "How many requests fall in each band, and how many of them agents rejected. Select a band to filter the table.",
      ph: "User, master, remark or group (e.g. G24)",
      search: r => (r[0] + " " + dic("m", r[9]) + " " + dic("wl", r[10]) + " " + dic("rm", r[12])).toLowerCase(),
      filt: (r, f) => (f.st === "" || String(r[2]) === f.st) && (!f.grp || r[8] > 0) && (!f.nw || isNew(r[19])) && (!f.pat || r[5] > 0),
      cols: [
        {h: "Fraud %", r: 1, v: r => r[3], c: r => pill(r[3])},
        {h: "User", v: r => r[0], c: r => `<span class="pid">${esc(r[0])}</span><span class="pname">${esc(dic("m", r[9]))}</span>`},
        {h: "Requested (IST)", v: r => r[1], c: r => `<span class="mono">${esc(r[1])}</span>`, cls: "nw"},
        {h: "Status", v: r => r[2], c: r => r[2] ? '<span class="st rej">Rejected</span>' : '<span class="st ok">Approved</span>'},
        {h: "Main reasons", v: r => dic("k", r[4]), c: r => reasons(dic("k", r[4])), cls: "why"},
        {h: "Account age", r: 1, d0: 1, v: r => r[19], c: r => ageCell(r[19]), cls: "nw"},
        {h: "Unusual score", r: 1, v: r => r[7], c: r => `<span class="mono">${fmt(r[7])}</span>`},
        {h: "Group", v: r => r[8] || null, c: r => r[8] ? `<span class="mono">G${r[8]}</span>` : ""},
        {h: "Deposits", r: 1, v: r => r[14], c: r => `<span class="mono">${rs(r[14])}</span>`},
        {h: "Profit ÷ deposits", r: 1, v: r => r[17], c: r => `<span class="mono">${mult(r[17])}</span>`},
      ],
      example: r => exLines([
        ["User", `${r[0]}  (master ${dic("m", r[9]) || "–"})`],
        ["Requested", `${r[1]} IST · ${r[2] ? "rejected" : "approved"}`],
        ["Deposits", `${rs(r[14])} (${plural(r[15], "deposit", "deposits")})`],
        ["Profit", r[17] == null ? "no deposit to compare" : `${r[17]}x the deposits`],
        ["Casino", `${r[18]}% of play`],
        ["Account", `${ageTxt(r[19])} old`],
        ...(r[8] ? [["Group", "G" + r[8]]] : []),
        ["Fraud %", Math.round(r[3]) + "%"],
        ["Reasons", dic("k", r[4]).split("; ").join("\n           ")],
      ]),
      detail: r => `
        <div class="dgrp"><h4>Money, last 30 days</h4><dl>
          <dt>Deposits</dt><dd>${rs(r[14])} · ${plural(r[15], "deposit", "deposits")}</dd>
          <dt>Net win or loss</dt><dd class="${r[16] >= 0 ? "pos" : "neg"}">${rs(r[16])}</dd>
          <dt>Profit ÷ deposits</dt><dd>${mult(r[17])}</dd>
          <dt>Casino share of play</dt><dd>${r[18]}%</dd>
          <dt>Bonus</dt><dd>${rs(r[20])}</dd></dl></div>
        <div class="dgrp"><h4>Account and activity</h4><dl>
          <dt>Account age</dt><dd>${ageTxt(r[19])}${isNew(r[19]) ? " · new" : ""}</dd>
          <dt>Bets</dt><dd>${fmt(r[21])}</dd>
          <dt>Statement entries</dt><dd>${fmt(r[22])}</dd>
          <dt>Master</dt><dd>${esc(dic("m", r[9])) || "–"}</dd>
          <dt>White label</dt><dd>${esc(dic("wl", r[10])) || "–"}</dd></dl></div>
        <div class="dgrp"><h4>Signals</h4><dl>
          <dt>Known pattern score</dt><dd>${fmt(r[6])}${r[5] ? " · " + PAT[r[5]] : ""}</dd>
          <dt>Unusual score (0–100)</dt><dd>${fmt(r[7])}</dd>
          <dt>Group</dt><dd>${r[8] ? "G" + r[8] : "None"}</dd>
          <dt>Review label</dt><dd>${esc(dic("lb", r[11])) || "–"}</dd></dl></div>
        <p class="dnote"><b>Why ${Math.round(r[3])}%:</b> ${esc(dic("k", r[4])) || "Looks normal"}${r[5] ? ` <b>·</b> ${PAT[r[5]]} means ${PATN[PAT[r[5]]]}` : ""}
          ${oldNote(r[19])}${tickNote(r[24])}
          ${r[23] >= 0 ? `<br><b>Different from normal users:</b> ${esc(dic("aj", r[23]))}` : ""}
          ${r[12] >= 0 || r[13] >= 0 ? `<br><b>Agent remark:</b> ${esc(dic("rm", r[12])) || "–"} <b>· Client reason:</b> ${esc(dic("rs", r[13])) || "–"}` : ""}</p>`,
      money: rows => `Rejected <b>${fmt(rows.filter(r => r[2]).length)}</b> · Users <b>${fmt(new Set(rows.map(r => r[0])).size)}</b>`,
    },
    july: {
      rows: D.J, pct: r => r[2], uid: r => r[18], age: r => r[13], why: r => dic("k", r[3]), one: "user", many: "users", bands: D.band_j,
      title: "How the score works for these users",
      what: "Each row is one user from the Newdata folder files data_pipeline_output-24, 25 and 26. Each user has about 2 days of activity.",
      howL: "What is different for this data",
      how: `The same model is used, with three changes for the short time window. Unusual behaviour is checked with a 48-hour model. If no deposit appears in the window, the deposit is treated as unknown, so the no-deposit signals and pattern P4 are not applied. There is no master field, so group checks do not run. As in Section 1, accounts older than ${D.old.days} days get a lower score.`,
      listTitle: "All users",
      bandSub: "How many users fall in each band, how many made a withdrawal, and how many are on the client's rule list. Select a band to filter the table.",
      ph: "User ID, file or rule code (e.g. R13)",
      search: r => (r[0] + " file " + r[1] + " " + dic("ru", r[17])).toLowerCase(),
      filt: (r, f) => (!f.wd || r[7] > 0) && (!f.rules || r[17] >= 0) && (!f.nw || isNew(r[13])) && (!f.pat || r[4] > 0),
      cols: [
        {h: "Fraud %", r: 1, v: r => r[2], c: r => pill(r[2])},
        {h: "User", v: r => r[0], c: r => `<span class="pid">${esc(r[0])}</span><span class="pname">File ${r[1]}</span>`},
        {h: "Main reasons", v: r => dic("k", r[3]), c: r => reasons(dic("k", r[3])), cls: "why"},
        {h: "Account age", r: 1, d0: 1, v: r => r[13], c: r => ageCell(r[13]), cls: "nw"},
        {h: "Unusual score (48 h)", r: 1, v: r => r[6], c: r => `<span class="mono">${fmt(r[6])}</span>`},
        {h: "Withdrawals", r: 1, v: r => r[7], c: r => `<span class="mono">${rs(r[7])}</span>`},
        {h: "Deposits", r: 1, v: r => r[8], c: r => `<span class="mono">${rs(r[8])}</span>`},
        {h: "Profit ÷ deposits", r: 1, v: r => r[11], c: r => `<span class="mono">${mult(r[11])}</span>`},
        {h: "Casino share", r: 1, v: r => r[12], c: r => `<span class="mono">${r[12]}%</span>`},
        {h: "Client rules", v: r => dic("ru", r[17]) || null, c: r => `<span class="mono">${esc(dic("ru", r[17]))}</span>`},
      ],
      example: r => exLines([
        ["User", `${r[0]}  (file ${r[1]})`],
        ["Deposits", `${rs(r[8])} (${plural(r[9], "deposit", "deposits")})`],
        ["Withdrew", rs(r[7])],
        ["Profit", r[11] == null ? "no deposit to compare" : `${r[11]}x the deposits`],
        ["Casino", `${r[12]}% of play`],
        ["Account", `${ageTxt(r[13])} old`],
        ["Fraud %", Math.round(r[2]) + "%"],
        ["Reasons", dic("k", r[3]).split("; ").join("\n           ")],
      ]),
      detail: r => `
        <div class="dgrp"><h4>Money, about 2 days</h4><dl>
          <dt>Deposits</dt><dd>${rs(r[8])} · ${plural(r[9], "deposit", "deposits")}</dd>
          <dt>Withdrawals</dt><dd>${rs(r[7])}</dd>
          <dt>Net win or loss</dt><dd class="${r[10] >= 0 ? "pos" : "neg"}">${rs(r[10])}</dd>
          <dt>Profit ÷ deposits</dt><dd>${mult(r[11])}</dd>
          <dt>Casino share of play</dt><dd>${r[12]}%</dd>
          <dt>Bonus</dt><dd>${rs(r[14])}</dd></dl></div>
        <div class="dgrp"><h4>Account and activity</h4><dl>
          <dt>Account age</dt><dd>${ageTxt(r[13])}${isNew(r[13]) ? " · new" : ""}</dd>
          <dt>Bets</dt><dd>${fmt(r[15])}</dd>
          <dt>Statement entries</dt><dd>${fmt(r[16])}</dd>
          <dt>Source file</dt><dd>data_pipeline_output-${r[1]}</dd></dl></div>
        <div class="dgrp"><h4>Signals</h4><dl>
          <dt>Known pattern score</dt><dd>${fmt(r[5])}${r[4] ? " · " + PAT[r[4]] : ""}</dd>
          <dt>Unusual score, 48 hours (0–100)</dt><dd>${fmt(r[6])}</dd>
          <dt>Client rules</dt><dd>${esc(dic("ru", r[17])) || "None"}</dd></dl></div>
        <p class="dnote"><b>Why ${Math.round(r[2])}%:</b> ${esc(dic("k", r[3])) || "Looks normal"}${r[4] ? ` <b>·</b> ${PAT[r[4]]} means ${PATN[PAT[r[4]]]}` : ""}
          ${oldNote(r[13])}${tickNote(r[18])}</p>`,
      money: rows => `Made a withdrawal <b>${fmt(rows.filter(r => r[7] > 0).length)}</b> · On client rule list <b>${fmt(rows.filter(r => r[17] >= 0).length)}</b>`,
    },
  };
  const PER = 50;
  const fresh = () => ({q: "", band: "", st: "", minp: 0, pat: false, nw: false, grp: false, wd: false, rules: false, tick: false, sort: 0, dir: -1, page: 0, open: -1});
  const CHIPS = [["cPat", "pat"], ["cNew", "nw"], ["cGrp", "grp"], ["cWd", "wd"], ["cRules", "rules"], ["cTick", "tick"]];
  const state = {withdrawals: fresh(), july: fresh()};
  let cur = "withdrawals";

  // ---------------------------------------------------------------- sections, banner, sub-tabs
  const C = D.cv, A = D.anom, P = D.pattern, r80 = D.band_r[0], r0 = D.band_r[4];
  const pc = v => Math.round(100 * v) + "%", pp = v => (100 * v).toFixed(1) + "%";
  const SECS = [
    ["s1", "Section 1", "Risk events from 15 Sep", `${T.from} – ${T.to} · ${fmt(T.scored)} requests`],
    ["s2", "Section 2", "Newdata folder (July)", `15–17 July · ${fmt(T.j)} users`],
    ["ref", "Reference", "Model and accuracy", "Method, test results and updates"],
  ];
  const BANNER = {
    s1: {eye: "Section 1 · Risk events", title: `Withdrawal requests from ${T.from.replace(/ \d{4}$/, "")} to ${T.to}`,
      src: `Source: risk event exports in fraud_ingest/data. Each request comes with the user's bets and account statements for up to the last 30 days. Latest request: ${T.to}, ${T.to_time}.`,
      kpis: [["alert", fmt(T.hi), "Requests scored 80% or higher", `from ${plural(T.hi_u, "user", "users")}`],
        ["", pct1(r80.rej, r80.n) + "%", "Rejected by agents in the 80%+ band", `Compared with ${pct1(r0.rej, r0.n)}% in the 0–20% band`],
        ["good", `${T.fraud_hi} of ${T.fraud_n}`, "Confirmed fraud cases scored 80%+", "Scored without the model seeing them"],
        ["", fmt(T.scored), "Requests scored", `${plural(T.users, "user", "users")}; ${fmt(T.nodata)} other requests had no betting data`]]},
    s2: {eye: "Section 2 · Newdata folder", title: "July users from the Newdata folder",
      src: "Source: Newdata folder, files data_pipeline_output-24, 25 and 26 (15–17 July). Each user has about 2 days of activity, and there is no master field.",
      kpis: [["alert", fmt(T.j_hi), "Users scored 80% or higher", `${fmt(D.band_j[0].w)} of them made a withdrawal`],
        ["", fmt(T.j), "Users scored", "About 2 days of data per user"],
        ["", fmt(T.j_w), "Users who made a withdrawal", `${pct1(T.j_w, T.j)}% of all users`],
        ["", fmt(T.j_rules), "Users on the client's rule list", `Agreement with the fraud %: AUC ${T.rules_auc}`]]},
    ref: {eye: "Reference", title: "Model and accuracy",
      src: `How the fraud % is built, how it was tested, and what changed in the latest update${D.updated ? ` (${D.updated})` : ""}. This applies to both sections.`,
      kpis: [["good", C.full[0].toFixed(3), "AUC, confirmed fraud vs genuine", "1.000 is perfect and 0.500 is chance"],
        ["", pc(C.full[1]), "Fraud caught at 1% false alarms", `Before this model: ${pc(C.base[1])}`],
        ["", C.hidden[0].toFixed(3), "AUC on an unseen pattern", "Each case's own pattern hidden in testing"],
        ["", pp(A.new.fa_L2), "False alarms on genuine requests", `Unusual-behaviour model ${A.new_v} · ${A.old_v} was ${pp(A.old.fa_L2)}`]]},
  };
  const SUB = [["requests", "Withdrawal requests", T.scored], ["groups", "Account groups", D.groups.length]];
  const VIEWS = {requests: "s1", groups: "s1", newdata: "s2", model: "ref"};
  const ALIAS = {withdrawals: "requests", "risk-events": "requests", section1: "requests", july: "newdata", section2: "newdata"};
  const FIRST = {s1: "requests", s2: "newdata", ref: "model"};
  $("#sections").innerHTML = SECS.map(([id, k, t, m]) => `<button role="tab" id="sec-${id}" data-sec="${id}" aria-selected="false"><span class="sk">${k}</span><span class="stt">${t}</span><span class="sm">${m}</span></button>`).join("");
  $("#subtabs").innerHTML = SUB.map(([id, t, c]) => `<button role="tab" id="sub-${id}" data-v="${id}" aria-selected="false">${t} <span class="c">${fmt(c)}</span></button>`).join("");
  let lastS1 = "requests";

  function show(v) {
    v = ALIAS[v] || v;
    if (!VIEWS[v]) v = "requests";
    const sec = VIEWS[v], B = BANNER[sec];
    if (sec === "s1") lastS1 = v;
    document.querySelectorAll("#sections button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.sec === sec)));
    $("#sEye").textContent = B.eye; $("#sTitle").textContent = B.title; $("#sSrc").textContent = B.src;
    $("#kpis").innerHTML = B.kpis.map(([cls, n, l, s]) => `<div class="kpi ${cls}"><span class="n">${n}</span><span class="l">${l}</span><span class="s">${s}</span></div>`).join("");
    $("#subtabs").hidden = sec !== "s1";
    document.querySelectorAll("#subtabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.v === v)));
    $("#pane-data").hidden = !(v === "requests" || v === "newdata");
    $("#pane-groups").hidden = v !== "groups";
    $("#pane-model").hidden = v !== "model";
    if (v === "requests" || v === "newdata") { cur = v === "requests" ? "withdrawals" : "july"; setupData(); }
    lsSet("fpc_view", v);
  }
  document.querySelectorAll("#sections button").forEach(b => b.onclick = () => show(b.dataset.sec === "s1" ? lastS1 : FIRST[b.dataset.sec]));
  document.querySelectorAll("#subtabs button").forEach(b => b.onclick = () => show(b.dataset.v));

  // ---------------------------------------------------------------- data pane
  function setupData() {
    const S = SETS[cur], st = state[cur], isW = cur === "withdrawals";
    $("#dTitle").textContent = S.title; $("#dWhat").textContent = S.what; $("#dHowL").textContent = S.howL; $("#dHow").textContent = S.how;
    $("#dSig").innerHTML = D.weights.slice(0, 6).map(([f, w]) => `<div class="sigline"><span class="dt"></span><span class="lb">${esc(f)}</span><span class="ct">weight ${w}</span></div>`).join("")
      + `<div class="sigline"><span class="dt"></span><span class="lb">Similar to a known fraud pattern (P1–P4)</span><span class="ct">score 50 → ${D.pmap[0][1]}%</span></div>`
      + `<div class="sigline"><span class="dt low"></span><span class="lb">Account older than ${D.old.days} days lowers the score</span><span class="ct">80%+ needs pattern ${D.old.p80_old}+</span></div>`;
    $("#dEx").textContent = S.example(S.rows[0]);
    $("#listTitle").textContent = S.listTitle; $("#bandSub").textContent = S.bandSub; $("#q").placeholder = S.ph;
    $("#bands").innerHTML = S.bands.map(b => `<button class="v${b.lo}" data-lo="${b.lo}" aria-pressed="false">
        <div class="t">${esc(b.b)} · ${b.lo}–${b.lo + 20}%</div>
        <div class="c">${fmt(b.n)}</div>
        <div class="d">${isW ? `${plural(b.u, "user", "users")} · ${fmt(b.rej)} rejected (${pct1(b.rej, b.n)}%)` : `${fmt(b.w)} made a withdrawal`}</div>
        <div class="m">${isW ? `Confirmed fraud: ${b.fraud}` : `On client rule list: ${fmt(b.rules)}`}</div></button>`).join("");
    document.querySelectorAll("#bands button").forEach(b => b.onclick = () => {
      st.band = st.band === b.dataset.lo ? "" : b.dataset.lo; st.page = 0; st.open = -1; syncControls(); draw();
    });
    $("#stWrap").hidden = !isW; $("#cGrp").hidden = !isW; $("#cWd").hidden = isW; $("#cRules").hidden = isW;
    syncControls();
    $("#thead").innerHTML = S.cols.map((c, i) => `<th class="${c.r ? "r" : ""}" data-i="${i}" tabindex="0" data-active="${st.sort === i ? 1 : 0}"${st.sort === i ? ` aria-sort="${st.dir < 0 ? "descending" : "ascending"}"` : ""}>${c.h}&nbsp;<span class="arw">${st.sort === i ? (st.dir < 0 ? "▼" : "▲") : "▼"}</span></th>`).join("") + '<th class="tickhead" scope="col">Confirmed fraud</th>';
    document.querySelectorAll("#thead th[data-i]").forEach(th => {
      const go = () => {
        const i = +th.dataset.i;
        if (st.sort === i) st.dir = -st.dir; else { st.sort = i; st.dir = S.cols[i].d0 || -1; }
        st.page = 0; st.open = -1; setupData();
        const again = document.querySelector(`#thead th[data-i="${i}"]`); if (again) again.focus();
      };
      th.onclick = go;
      th.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
    draw();
  }
  function syncControls() {
    const st = state[cur];
    $("#q").value = st.q; $("#band").value = st.band; $("#st").value = st.st; $("#minp").value = st.minp; $("#minpVal").textContent = st.minp + "%";
    CHIPS.forEach(([id, k]) => $("#" + id).setAttribute("aria-pressed", st[k] ? "true" : "false"));
    document.querySelectorAll("#bands button").forEach(b => b.setAttribute("aria-pressed", st.band === b.dataset.lo ? "true" : "false"));
  }
  function filtered() {
    const S = SETS[cur], st = state[cur], q = st.q.trim().toLowerCase(), lo = st.band === "" ? null : +st.band;
    const hi = lo == null ? null : lo === 80 ? 101 : lo + 20;
    const gm = cur === "withdrawals" ? /^g(\d+)$/.exec(q) : null;
    const out = S.rows.filter(r => {
      const p = S.pct(r);
      if (lo != null && !(p >= lo && p < hi)) return false;
      if (p < st.minp) return false;
      if (gm) { if (r[8] !== +gm[1]) return false; } else if (q && !S.search(r).includes(q)) return false;
      return S.filt(r, st) && (!st.tick || TK.has(S.uid(r)));
    });
    const col = S.cols[st.sort], d = st.dir;
    out.sort((a, b) => {
      const x = col.v(a), y = col.v(b);
      if (x == null || y == null) return (x == null) - (y == null) || (S.pct(b) - S.pct(a));
      return (x < y ? -1 : x > y ? 1 : 0) * d || (S.pct(b) - S.pct(a));
    });
    return out;
  }
  function draw() {
    const S = SETS[cur], st = state[cur], rows = filtered(), pages = Math.max(1, Math.ceil(rows.length / PER));
    if (st.page >= pages) st.page = pages - 1;
    const from = st.page * PER, slice = rows.slice(from, from + PER);
    $("#resCount").innerHTML = `<b>${fmt(rows.length)}</b> ${rows.length === 1 ? S.one : S.many}`;
    $("#resMoney").innerHTML = S.money(rows);
    if (!slice.length) {
      $("#tbody").innerHTML = `<tr><td colspan="${S.cols.length + 1}"><div class="empty"><b>No results match these filters</b>Clear the filters or choose another band.</div></td></tr>`;
    } else {
      $("#tbody").innerHTML = slice.map((r, j) => {
        const idx = from + j, open = st.open === idx;
        return `<tr class="row${open ? " open" : ""}${TK.has(S.uid(r)) ? " confirmed" : ""}" data-idx="${idx}" tabindex="0" aria-expanded="${open}">${S.cols.map(c => `<td class="${(c.r ? "r " : "") + (c.cls || "")}">${c.c(r)}</td>`).join("")}${tickCell(S, r)}</tr>`
          + (open ? `<tr class="detail"><td colspan="${S.cols.length + 1}"><div class="dwrap">${S.detail(r)}</div></td></tr>` : "");
      }).join("");
    }
    document.querySelectorAll("#tbody tr.row").forEach(tr => {
      const i = +tr.dataset.idx;
      const tog = () => { st.open = st.open === i ? -1 : i; draw(); const again = document.querySelector(`#tbody tr.row[data-idx="${i}"]`); if (again) again.focus({preventScroll: true}); };
      tr.onclick = tog;
      tr.onkeydown = e => { if (e.target !== tr) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog(); } };
    });
    document.querySelectorAll("#tbody td.tickcell").forEach(td => td.addEventListener("click", e => e.stopPropagation()));
    document.querySelectorAll("#tbody input.tick").forEach(cb => cb.addEventListener("change", () => {
      lastTick = +cb.dataset.uid;
      TK.toggle(+cb.dataset.uid, cb.dataset.code, $("#rvWho").value.trim());
    }));
    $("#pgInfo").textContent = rows.length ? `${fmt(from + 1)}–${fmt(Math.min(from + PER, rows.length))} of ${fmt(rows.length)} · Page ${st.page + 1} of ${fmt(pages)}` : "";
    $("#pgFirst").disabled = $("#pgPrev").disabled = st.page === 0;
    $("#pgNext").disabled = $("#pgLast").disabled = st.page >= pages - 1;
  }
  const upd = (k, v) => { const st = state[cur]; st[k] = v; st.page = 0; st.open = -1; syncControls(); draw(); };
  $("#q").addEventListener("input", e => upd("q", e.target.value));
  $("#band").addEventListener("change", e => upd("band", e.target.value));
  $("#st").addEventListener("change", e => upd("st", e.target.value));
  $("#minp").addEventListener("input", e => upd("minp", +e.target.value));
  CHIPS.forEach(([id, k]) => $("#" + id).addEventListener("click", () => upd(k, !state[cur][k])));
  $("#reset").onclick = () => { state[cur] = fresh(); setupData(); };
  const page = f => { const st = state[cur]; st.page = f(st.page); st.open = -1; draw(); };
  $("#pgFirst").onclick = () => page(() => 0);
  $("#pgPrev").onclick = () => page(p => Math.max(0, p - 1));
  $("#pgNext").onclick = () => page(p => p + 1);
  $("#pgLast").onclick = () => page(() => 1e9);

  // ---------------------------------------------------------------- account groups (Section 1)
  $("#groups").innerHTML = D.groups.map(g => `<div class="gcard ${g.pct >= 80 ? "v80" : g.pct >= 60 ? "v60" : g.pct >= 40 ? "v40" : ""}">
    <div class="gtop"><b>G${g.id} · ${esc(g.master)}</b>${pill(g.pct)}</div>
    <div class="kv"><span><b>${g.users}</b> users</span><span><b>${g.records}</b> ${g.records === 1 ? "request" : "requests"}</span><span><b>${g.rej}</b> rejected</span></div>
    <div class="kv"><span class="mono">${esc(g.from)} → ${esc(g.to)} IST</span></div>
    <div class="kv"><span>Median deposit <b>${rs(g.dep)}</b></span><span>Profit ÷ deposits <b>${g.mult}x</b></span><span>Casino <b>${g.casino}%</b></span><span>Account age <b>${ageTxt(g.age)}</b></span></div>
    <div class="members">${g.members.map(esc).join(", ")}</div>
    <button class="glink" data-g="${g.id}">View requests</button></div>`).join("");
  document.querySelectorAll(".glink").forEach(b => b.onclick = () => {
    state.withdrawals = Object.assign(fresh(), {q: "g" + b.dataset.g});
    show("requests"); $(".secbar").scrollIntoView({block: "start"});
  });

  // ---------------------------------------------------------------- model and accuracy
  $("#mIntro").textContent = `The data was split by user into 5 parts and the test was repeated 10 times, so no user was in training and testing at the same time. The test used ${fmt(D.cvn.fraud || T.fraud_n)} confirmed fraud cases and ${fmt(D.cvn.genuine || A.genuine)} genuine requests. In the unseen-pattern test, each fraud case's own pattern was hidden, as if the model had never seen it.`;
  $("#mCv").innerHTML = `<tr><th>Method</th><th>AUC</th><th>Fraud caught at 1% false alarms</th><th>At 3% false alarms</th></tr>
    <tr><td>Before: unusual-behaviour score only</td><td>${C.base[0].toFixed(3)}</td><td>${pc(C.base[1])}</td><td>${pc(C.base[2])}</td></tr>
    <tr class="win"><td>Now: fraud % model</td><td class="good">${C.full[0].toFixed(3)}</td><td class="good">${pc(C.full[1])}</td><td class="good">${pc(C.full[2])}</td></tr>
    <tr><td>Now, on an unseen pattern</td><td>${C.hidden[0].toFixed(3)}</td><td class="good">${pc(C.hidden[1])}</td><td>${pc(C.hidden[2])}</td></tr>`;
  $("#mBand").innerHTML = `<tr><th>Band</th><th>Requests</th><th>Rejected</th><th>Reject rate</th><th>Confirmed fraud</th></tr>` +
    D.band_r.map(b => `<tr><td>${esc(b.b)}<span class="rng">${b.lo}–${b.lo + 20}%</span></td><td>${fmt(b.n)}</td><td>${fmt(b.rej)}</td><td>${pct1(b.rej, b.n)}%</td><td>${b.fraud}</td></tr>`).join("");
  $("#mUpd").innerHTML = `<tr><th>Unusual-behaviour model</th><th>${esc(A.old_v)}</th><th>${esc(A.new_v)}</th></tr>
    <tr><td>Fraud caught with the pattern hidden</td><td>${A.old.pakde}/${A.old.total}</td><td class="good">${A.new.pakde}/${A.new.total}</td></tr>
    <tr><td>Caught only by the unusual-behaviour or group check</td><td>${A.old.sirf_L23}/${A.old.sirf_L23_total}</td><td class="good">${A.new.sirf_L23}/${A.new.sirf_L23_total}</td></tr>
    <tr><td>False alarms on genuine requests</td><td>${pp(A.old.fa_L2)}</td><td class="good">${pp(A.new.fa_L2)}</td></tr>
    <tr><td>Alerts per day</td><td>~${Math.round(A.old.bojh_per_din)}</td><td class="good">~${Math.round(A.new.bojh_per_din)}</td></tr>`;
  if (A.tried) {
    const inUse = A.new_v.split(" ")[0];
    $("#mTried").innerHTML = `<strong>Newer version not adopted:</strong> ${esc(A.tried.v)} was trained on the latest data, but in the hidden-pattern test it caught ${A.tried.new.pakde} of ${A.tried.new.total} fraud cases, while ${esc(inUse)} caught ${A.tried.old.pakde} of ${A.tried.old.total} on the same data. A new version is used only when it is at least as good, so ${esc(inUse)} stays in use.`;
    $("#mTried").hidden = false;
  }
  $("#mPat").innerHTML = `<strong>Pattern model:</strong> ${P.fraud[0]} confirmed fraud examples (${Object.entries(P.by).map(([k, v]) => k + " " + v).join(", ")}), and its rules fire on ${P.fraud[1]} of them. When each case is left out of training, ${P.loo[0]} of ${P.loo[1]} are still caught. On genuine requests, the rules fire on ${fmt(P.genuine[1])} of ${fmt(P.genuine[0])} (${(100 * P.genuine[1] / P.genuine[0]).toFixed(2)}%). The unusual-behaviour model learned from ${fmt(A.genuine)} genuine requests.`;
  const maxW = Math.max(...D.weights.map(w => w[1]));
  $("#mW").innerHTML = D.weights.map(([f, w]) => `<div class="wbar"><span>${esc(f)}</span><div class="tr"><div class="fl" style="width:${100 * w / maxW}%"></div></div><span class="n">${w}</span></div>`).join("");
  const wbar = (label, p, cls) => `<div class="wbar"><span>${label}</span><div class="tr"><div class="fl ${cls}" style="width:${p}%"></div></div><span class="n">${p}%</span></div>`;
  $("#mMap").innerHTML = `<div class="wgroup">Account up to ${D.old.days} days old</div>` + D.pmap.map(([s, p]) => wbar(`Pattern score ${s}`, p, "crit")).join("")
    + `<div class="wgroup">Account older than ${D.old.days} days</div>` + D.pmap.map(([s, , p]) => wbar(`Pattern score ${s}`, p, "old")).join("");
  $("#mOldH").textContent = `Rule for accounts older than ${D.old.days} days`;
  $("#mOldTxt").textContent = `Fraud is much rarer in older accounts. So for an account older than ${D.old.days} days, the behaviour part of the score is lowered, and the score stays at ${D.old.cap}% or below unless the user strongly matches a known pattern. To reach 80% or more, an older account needs a known-pattern score of ${D.old.p80_old} or higher, compared with ${D.old.p80_new} for a newer account.`;
  $("#mAge").innerHTML = `<tr><th>Account age</th><th>Requests</th><th>Scored 80%+</th><th>Rejected in 80%+</th><th>Reject rate in 80%+</th><th>Confirmed fraud</th><th>Confirmed fraud at 80%+</th></tr>` +
    D.age_r.map(a => `<tr><td>${esc(a.b)}</td><td>${fmt(a.n)}</td><td>${fmt(a.hi)}</td><td>${fmt(a.hi_rej)}</td><td>${pct1(a.hi_rej, a.hi)}%</td><td>${a.fraud}</td><td>${a.fraud_hi}</td></tr>`).join("");

  // ---------------------------------------------------------------- note, footer, start
  $("#noteRate").innerHTML = `<strong>How it compares with real outcomes.</strong> In Section 1, agents rejected 1 in every ${fmt(Math.round(r80.n / Math.max(1, r80.rej)))} requests scored 80% or higher, and 1 in every ${fmt(Math.round(r0.n / Math.max(1, r0.rej)))} requests scored below 20%.`;
  $("#noteCov").innerHTML = `<strong>Data coverage.</strong> ${fmt(T.nodata)} requests from 15 Sep onward came without bets or statements, so they have no score. The exports also hold ${fmt(T.pre)} requests from before 15 Sep. Only ${T.pre_scored} of them had betting data, so they are not part of either section.`;
  $("#fS1").textContent = `Section 1: ${T.from} – ${T.to}`;
  $("#fModel").textContent = `Model: known patterns + unusual behaviour ${A.new_v.split(" ")[0]} + fraud %`;
  // ---------------------------------------------------------------- confirmed-fraud ticks
  let lastTick = null, msgTimer = 0;
  function onTicks() {
    renderReview();
    if (!$("#pane-data").hidden) draw();
    if (lastTick != null) {
      const cb = document.querySelector(`#tbody input.tick[data-uid="${lastTick}"]`);
      if (cb && !cb.disabled) { cb.focus({preventScroll: true}); lastTick = null; }
    }
  }
  function renderReview() {
    const n = TK.count(), mode = TK.mode();
    $("#rvBar").classList.toggle("zero", n === 0);
    $("#rvN").textContent = fmt(n);
    $("#rvT").innerHTML = mode === "loading" ? "Loading confirmed fraud ticks…"
      : n === 0 ? "No player has been marked as <b>confirmed fraud</b> yet. Use the tick in the last column of a table."
      : `${n === 1 ? "player is" : "players are"} marked as <b>confirmed fraud</b>. ${mode === "saved" ? "Every reviewer sees the same list." : "They are saved in this browser only."}`;
    $("#rvCopy").disabled = $("#rvClear").disabled = n === 0;
    const pills = [];
    if (mode === "local") pills.push('<span class="dbpill warn">This browser only</span>');
    if (TK.error()) pills.push(`<span class="dbpill bad">${esc(TK.error())}</span>`);
    $("#rvDb").innerHTML = pills.join("");
    $("#rvDb").hidden = !pills.length;
    $("#rvLocal").hidden = mode !== "local";
  }
  function confirmedTSV() {
    const seen = new Map();
    const scan = (sec, S) => {
      for (const r of S.rows) {
        const id = S.uid(r);
        if (id == null || !TK.has(id)) continue;
        let x = seen.get(id);
        if (!x) seen.set(id, x = {code: r[0], sec: new Set(), pct: -1, age: null, why: ""});
        x.sec.add(sec);
        if (S.pct(r) > x.pct) { x.pct = S.pct(r); x.age = S.age(r); x.why = S.why(r); }
      }
    };
    scan("Section 1", SETS.withdrawals);
    scan("Section 2", SETS.july);
    const head = ["User ID", "User code", "Seen in", "Highest fraud %", "Account age (days)", "Main reasons", "Marked by", "Marked at"].join("\t");
    const lines = TK.entries().map(([id, t]) => {
      const x = seen.get(id);
      return [id, x ? x.code : t.code || "", x ? [...x.sec].join(" + ") : "Not in current data", x ? Math.round(x.pct) : "",
        x && x.age != null ? x.age : "", x ? x.why.split("; ").join(", ") : "", t.by || "", t.at ? t.at.slice(0, 16).replace("T", " ") : ""].join("\t");
    });
    return [head, ...lines].join("\n");
  }
  function copyText(text) {
    const legacy = () => new Promise((res, rej) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        ok ? res() : rej(new Error("copy-blocked"));
      } catch (e) { rej(e); }
    });
    return navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text).catch(legacy) : legacy();
  }
  const say = t => { $("#rvMsg").textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => { $("#rvMsg").textContent = ""; }, 3000); };
  $("#rvWho").value = loadReviewer();
  $("#rvWho").addEventListener("input", e => saveReviewer(e.target.value));
  $("#rvCopy").onclick = () => {
    const tsv = confirmedTSV(), n = TK.count();
    $("#rvFall").hidden = true;
    copyText(tsv).then(() => say(`Copied ${plural(n, "player", "players")}`)).catch(() => {
      $("#rvFallText").value = tsv;
      $("#rvFall").hidden = false;
      say("Clipboard blocked. Copy from the box below.");
    });
  };
  $("#rvClear").onclick = () => {
    const n = TK.count();
    if (n && window.confirm(`Remove all ${plural(n, "tick", "ticks")} for every reviewer? This cannot be undone.`)) { $("#rvFall").hidden = true; TK.clear(); }
  };
  $("#rvFallClose").onclick = () => { $("#rvFall").hidden = true; };
  $("#rvFallText").addEventListener("focus", e => e.target.select());

  // ---------------------------------------------------------------- start
  loading.hidden = true;
  $("#app").hidden = false;
  $("#review").hidden = false;
  renderReview();
  TK.load();
  const hash = (location.hash || "").slice(1);
  show(VIEWS[ALIAS[hash] || hash] ? hash : (lsGet("fpc_view") || lsGet("fpc_tab") || "requests"));
}
