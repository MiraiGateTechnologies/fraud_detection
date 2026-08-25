import { useEffect, useState } from "react";
import DATA from "./data.json";
import { num } from "./format.js";
import { loadReviewer, saveReviewer, useTicks } from "./useTicks.js";
import Overview from "./components/Overview.jsx";
import ReviewBar from "./components/ReviewBar.jsx";
import RulePanel from "./components/RulePanel.jsx";

const RULES = DATA.rules;
const META = DATA.meta;

function Stat({ n, l, hl }) {
  return (
    <div className={"stat" + (hl ? " hl" : "")}>
      <div className="n">{n}</div>
      <div className="l" dangerouslySetInnerHTML={{ __html: l }} />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("OV");
  const [reviewer, setReviewerState] = useState(loadReviewer);
  const { ticks, mode, error, busy, toggle, clear } = useTicks();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);

  const setReviewer = (v) => {
    setReviewerState(v);
    saveReviewer(v);
  };

  const rule = RULES.find((r) => r.id === tab);

  return (
    <>
      <header>
        <p className="eyebrow">{META.org} · Fraud Detection</p>
        <h1>Seven Rules Fraud Console</h1>
        <p className="lede">
          Saat rules ki <strong>final</strong> lists — jaisa har rule me likha hai theek
          waisa hi lagaya gaya, uske upar kuch joda nahi. Har player ke saath wahi numbers
          hain jinki wajah se wo flag hua.
        </p>

        <div className="stats">
          <Stat n={num(META.usersUnique)} l="<b>players</b> flagged, saare rules milakar" />
          <Stat n={num(META.hitsTotal)} l="<b>rule-hits</b> — ek player 2 rules me ho sakta hai" />
          <Stat n={META.rules} l="<b>rules</b> jo is data par chal sakte the" />
          <Stat
            hl
            n={num(META.multi)}
            l="players <b>2 ya zyada rules</b> tod rahe hain — sabse pakke case"
          />
        </div>

        <ReviewBar
          rules={RULES}
          ticks={ticks}
          mode={mode}
          error={error}
          reviewer={reviewer}
          setReviewer={setReviewer}
          onClear={clear}
        />

        {mode === "local" ? (
          <div className="banner amber">
            <h4>Ticks sirf isi browser me save ho rahe hain</h4>
            <p>
              Abhi ye doosre laptop ya doosre browser me nahi dikhenge, aur incognito
              window band karte hi chale jayenge. Kaam khatam hone par{" "}
              <strong>"Confirmed list copy karo"</strong> se list nikaal lijiye.
            </p>
          </div>
        ) : null}

        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "OV" ? "true" : "false"}
            onClick={() => setTab("OV")}
          >
            Overview
          </button>
          {RULES.map((r) => {
            const done = r.rows.filter((x) => ticks[x.id]).length;
            return (
              <button
                key={r.id}
                role="tab"
                aria-selected={tab === r.id ? "true" : "false"}
                onClick={() => setTab(r.id)}
              >
                {r.id} {r.short}
                <span className="c">
                  {done > 0 ? done + "/" + r.rows.length : r.rows.length}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {mode === "loading" ? (
        <div className="loading">Ticks load ho rahe hain…</div>
      ) : tab === "OV" ? (
        <Overview rules={RULES} meta={META} ticks={ticks} onOpen={setTab} />
      ) : (
        <RulePanel
          key={tab}
          rule={rule}
          ticks={ticks}
          busy={busy}
          onToggle={(player) => toggle(player, reviewer)}
        />
      )}

      <div className="note">
        <h3>Ek zaroori baat</h3>
        <p>
          <strong>Flagged ka matlab "review karo" hai — confirmed fraud nahi.</strong> Har
          list us rule ke apne exact threshold se bani hai. Koi verdict ya score upar se
          nahi joda gaya.
        </p>
        <p>
          Sabse pehle un <strong>{num(META.multi)} players</strong> ko dekhiye jo{" "}
          <strong>2 ya zyada rules</strong> tod rahe hain — kisi bhi rule tab me "2+ rules
          toote" filter se. Ek rule sanyog ho sakta hai, do nahi.
        </p>
        <p>
          Rule ka apna profit aur player ka <strong>overall P&amp;L alag cheezein hain</strong>.
          Rule ka profit sirf us market/session ka hai. Dono column me diye hain — faisla
          dono dekhkar lijiye.
        </p>
        <p>
          <strong>"Fraud confirm" tick player ke saath juda hai, rule ke saath nahi</strong> —
          ek jagah tick karoge to har rule tab me wahi player ticked milega.
        </p>
      </div>

      <footer>
        <span>{META.org}</span>
        <span>{META.rules} rules · final lists</span>
        <span>{num(META.usersUnique)} unique players</span>
        <span>{META.window}</span>
      </footer>
    </>
  );
}
