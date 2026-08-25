import { useEffect, useMemo, useState } from "react";
import { cls, fmt, inr, num, wlBlocks } from "../format.js";

const PAGE = 25;
const CODE_LABEL = /threshold|kaise|galat|logic|shart|round|continue/i;

function WLStrip({ s }) {
  return (
    <div className="wl">
      <h4>Casino rounds — jeet (W) / haar (L), time order me</h4>
      <code>
        {wlBlocks(s).map((seg, i) =>
          seg[0] === "W" ? <b key={i}>{seg[1]}</b> : <i key={i}>{seg[1]}</i>
        )}
      </code>
    </div>
  );
}

export default function RulePanel({ rule: r, ticks, busy, onToggle }) {
  const mi = r.cols.findIndex((c) => c.l === r.metric);
  const vi = r.cols.findIndex((c) => c.l === r.money);
  const wlIdx = r.cols.findIndex((c) => c.l === "W/L pattern");

  const [q, setQ] = useState("");
  const [newOnly, setNewOnly] = useState(false);
  const [multiOnly, setMultiOnly] = useState(false);
  const [tickOnly, setTickOnly] = useState(false);
  const [minM, setMinM] = useState(0);
  const [sort, setSort] = useState({ k: "metric", dir: -1 });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    setQ("");
    setNewOnly(false);
    setMultiOnly(false);
    setTickOnly(false);
    setMinM(0);
    setSort({ k: "metric", dir: -1 });
    setPage(0);
    setOpen(null);
  }, [r.id]);

  const metricMax = useMemo(() => {
    if (mi < 0) return 0;
    return r.rows.reduce((a, x) => {
      const v = x.v[mi];
      return typeof v === "number" && v > a ? v : a;
    }, 0);
  }, [r.id, mi]);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const out = r.rows.filter((x) => {
      if (
        qq &&
        !x.c.toLowerCase().includes(qq) &&
        !x.n.toLowerCase().includes(qq) &&
        !String(x.id).includes(qq)
      )
        return false;
      if (newOnly && !x.nw) return false;
      if (multiOnly && x.hits.length < 2) return false;
      if (tickOnly && !ticks[x.id]) return false;
      if (minM > 0 && mi >= 0 && !(typeof x.v[mi] === "number" && x.v[mi] >= minM))
        return false;
      return true;
    });

    const { k, dir } = sort;
    out.sort((a, b) => {
      let av, bv;
      if (k === "user") {
        av = a.c.toLowerCase();
        bv = b.c.toLowerCase();
      } else if (k === "age") {
        av = a.a;
        bv = b.a;
      } else if (k === "hits") {
        av = a.hits.length;
        bv = b.hits.length;
      } else if (k === "metric") {
        av = mi < 0 ? 0 : a.v[mi];
        bv = mi < 0 ? 0 : b.v[mi];
      } else {
        av = vi < 0 ? 0 : a.v[vi];
        bv = vi < 0 ? 0 : b.v[vi];
      }
      if (av === null || av === undefined) av = -Infinity;
      if (bv === null || bv === undefined) bv = -Infinity;
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
    return out;
  }, [r.id, q, newOnly, multiOnly, tickOnly, minM, sort, ticks, mi, vi]);

  useEffect(() => {
    setPage(0);
    setOpen(null);
  }, [q, newOnly, multiOnly, tickOnly, minM, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pg = Math.min(page, pages - 1);
  const slice = rows.slice(pg * PAGE, pg * PAGE + PAGE);
  const moneySum =
    vi < 0
      ? null
      : rows.reduce((a, x) => a + (typeof x.v[vi] === "number" ? x.v[vi] : 0), 0);

  const th = (key, label, right) => {
    const active = sort.k === key;
    return (
      <th
        className={right ? "r" : ""}
        data-active={active ? "1" : "0"}
        onClick={() => setSort({ k: key, dir: active ? -sort.dir : -1 })}
      >
        {label}
        <span className="arw">{active ? (sort.dir > 0 ? "▲" : "▼") : "↕"}</span>
      </th>
    );
  };

  return (
    <div>
      <div className="rulebox">
        <div className="top">
          <h2>
            {r.id} · {r.short}{" "}
            <span
              className="mono"
              style={{ fontSize: ".7em", color: "var(--muted)", fontWeight: 400 }}
            >
              NewRules #{r.num}
            </span>
          </h2>
          <p>{r.gist}</p>
        </div>
        <div className="body">
          {r.info.map((kv, i) => (
            <div key={i} className="blk">
              <span className="lbl">{kv[0]}</span>
              {CODE_LABEL.test(kv[0]) ? (
                <code className="th">{kv[1]}</code>
              ) : (
                <p>{kv[1]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <h3 className="sec">Players — {r.rows.length}</h3>
      <p className="sub">
        Kisi bhi row par click karo, us player ki poori detail khul jayegi. Column
        heading par click karke sort kar sakte ho.
      </p>

      <div className="filters">
        <div className="fgroup" style={{ flex: "1 1 190px" }}>
          <label className="flab" htmlFor="q">
            Player search
          </label>
          <input
            type="search"
            id="q"
            placeholder="user code, naam ya ID…"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {mi >= 0 ? (
          <div className="fgroup">
            <label className="flab" htmlFor="mm">
              Minimum {r.metric}
              <span className="rangeval">{num(minM)}</span>
            </label>
            <input
              type="range"
              id="mm"
              min={0}
              max={metricMax}
              value={minM}
              step={1}
              onChange={(e) => setMinM(Number(e.target.value))}
            />
          </div>
        ) : null}

        <div className="fgroup">
          <span className="flab">Account</span>
          <button
            className="chip"
            aria-pressed={newOnly ? "true" : "false"}
            onClick={() => setNewOnly(!newOnly)}
          >
            {"Sirf naye (<30 din)"}
          </button>
        </div>

        <div className="fgroup">
          <span className="flab">Rules</span>
          <button
            className="chip"
            aria-pressed={multiOnly ? "true" : "false"}
            onClick={() => setMultiOnly(!multiOnly)}
          >
            2+ rules toote
          </button>
        </div>

        <div className="fgroup">
          <span className="flab">Review</span>
          <button
            className="chip"
            aria-pressed={tickOnly ? "true" : "false"}
            onClick={() => setTickOnly(!tickOnly)}
          >
            Sirf ticked dikhao
          </button>
        </div>

        <div className="fgroup">
          <span className="flab">{" "}</span>
          <button
            className="reset"
            onClick={() => {
              setQ("");
              setNewOnly(false);
              setMultiOnly(false);
              setTickOnly(false);
              setMinM(0);
            }}
          >
            Filters hatayein
          </button>
        </div>
      </div>

      <div className="resbar">
        <span className="rescount">
          <b>{num(rows.length)}</b> players dikh rahe hain
          {rows.length !== r.rows.length ? ` (kul ${num(r.rows.length)} me se)` : ""}
        </span>
        {moneySum !== null ? (
          <span className="resmoney">
            {r.money}: <b>{inr(moneySum)}</b>
          </span>
        ) : null}
      </div>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              {th("user", "Player")}
              {th("age", "Account", true)}
              {mi >= 0 ? th("metric", r.metric, true) : null}
              {vi >= 0 ? th("money", r.money, true) : null}
              {th("hits", "Rules", true)}
              <th className="r" />
              <th className="tickhead r">Fraud confirm</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty">
                    <b>Koi player nahi mila</b>
                    Filters thode dheele karke dekhiye.
                  </div>
                </td>
              </tr>
            ) : null}

            {slice.map((x) => {
              const isOpen = open === x.id;
              const on = !!ticks[x.id];
              const frag = [
                <tr
                  key={x.id}
                  className={"row" + (isOpen ? " open" : "") + (on ? " confirmed" : "")}
                  onClick={() => setOpen(isOpen ? null : x.id)}
                >
                  <td>
                    <span className="pid">{x.c}</span>
                    <span className="pname">{x.n}</span>
                    {x.nw ? <span className="newpill">NAYA ACCOUNT</span> : null}
                  </td>
                  <td className="r">
                    <span className="num">{num(x.a)}</span>
                    <span className="pname">din purana</span>
                  </td>
                  {mi >= 0 ? (
                    <td className="r">
                      <span className={"num " + cls(x.v[mi])}>
                        {fmt(x.v[mi], r.cols[mi].m)}
                      </span>
                    </td>
                  ) : null}
                  {vi >= 0 ? (
                    <td className="r">
                      <span className={"num " + cls(x.v[vi])}>
                        {fmt(x.v[vi], r.cols[vi].m)}
                      </span>
                    </td>
                  ) : null}
                  <td className="r">
                    <span
                      className={
                        "hits" +
                        (x.hits.length >= 3 ? " h3" : x.hits.length === 2 ? " h2" : "")
                      }
                    >
                      {x.hits.length}
                    </span>
                    {x.hits.length > 1 ? (
                      <div className="tags">
                        {x.hits.map((t) => (
                          <span key={t} className={"tag" + (t === r.id ? " self" : "")}>
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="r exp">{isOpen ? "−" : "+"}</td>
                  <td className="tickcell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="tick"
                      checked={on}
                      disabled={!!busy[x.id]}
                      aria-label={"Fraud confirm karo: " + x.c}
                      onChange={() => onToggle(x)}
                    />
                  </td>
                </tr>,
              ];

              if (isOpen) {
                frag.push(
                  <tr key={x.id + "-d"} className="detail">
                    <td colSpan={7}>
                      <div className="dwrap">
                        <div className="dgrp">
                          <h4>Player</h4>
                          <dl>
                            <dt>User ID</dt>
                            <dd>{x.id}</dd>
                            <dt>User code</dt>
                            <dd>{x.c}</dd>
                            <dt>Account bana</dt>
                            <dd>{x.cr}</dd>
                            <dt>Account age</dt>
                            <dd>{num(x.a)} din</dd>
                            <dt>{"Naya (<30 din)"}</dt>
                            <dd className={x.nw ? "neg" : ""}>{x.nw ? "haan" : "nahi"}</dd>
                            <dt>Rules toote</dt>
                            <dd>{x.hits.join(", ")}</dd>
                          </dl>
                        </div>

                        <div className="dgrp">
                          <h4>{r.id} ke apne numbers</h4>
                          <dl>
                            {r.cols.map((c, i) =>
                              c.l === "W/L pattern" ? null : (
                                <div key={i} style={{ display: "contents" }}>
                                  <dt>{c.l}</dt>
                                  <dd className={c.m ? cls(x.v[i]) : ""}>
                                    {fmt(x.v[i], c.m)}
                                  </dd>
                                </div>
                              )
                            )}
                          </dl>
                        </div>

                        {wlIdx >= 0 && x.v[wlIdx] ? <WLStrip s={x.v[wlIdx]} /> : null}

                        {x.hits.length > 1 ? (
                          <p className="dnote">
                            Ye player <b>{x.hits.length} alag rules</b> tod raha hai —{" "}
                            <b>{x.hits.join(", ")}</b>. Alag-alag tareeke se ek hi baat
                            saabit ho rahi hai, isliye ye single-rule wale cases se zyada
                            pakka hai.
                          </p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              }
              return frag;
            })}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span className="pginfo">
          Page {pg + 1} / {pages} · {num(rows.length)} players
        </span>
        <div className="pgbtns">
          <button disabled={pg === 0} onClick={() => setPage(0)}>
            « Pehla
          </button>
          <button disabled={pg === 0} onClick={() => setPage(pg - 1)}>
            ‹ Pichla
          </button>
          <button disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>
            Agla ›
          </button>
          <button disabled={pg >= pages - 1} onClick={() => setPage(pages - 1)}>
            Aakhri »
          </button>
        </div>
      </div>
    </div>
  );
}
