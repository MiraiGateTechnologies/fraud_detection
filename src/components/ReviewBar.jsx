import { useState } from "react";
import { num } from "../format.js";

function tickedRows(rules, ticks) {
  const seen = new Set();
  const out = [];
  for (const r of rules) {
    for (const x of r.rows) {
      if (ticks[x.id] && !seen.has(x.id)) {
        seen.add(x.id);
        out.push(x);
      }
    }
  }
  return out;
}

function toTSV(rules, ticks) {
  const head = [
    "User ID",
    "User Code",
    "Name",
    "Account created",
    "Account age (days)",
    "Naya (<30 din)",
    "Rules toote",
  ].join("\t");
  const lines = tickedRows(rules, ticks).map((x) =>
    [x.id, x.c, x.n, x.cr, x.a, x.nw ? "haan" : "nahi", x.hits.join(" ")].join("\t")
  );
  return [head, ...lines].join("\n");
}

function copyText(text) {
  const legacy = () =>
    new Promise((res, rej) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        ok ? res() : rej(new Error("execCommand ne mana kar diya"));
      } catch (e) {
        rej(e);
      }
    });
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(legacy);
  }
  return legacy();
}

export default function ReviewBar({ rules, ticks, mode, error, reviewer, setReviewer, onClear }) {
  const n = Object.keys(ticks).length;
  const [msg, setMsg] = useState("");
  const [fallback, setFallback] = useState("");
  const say = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="reviewwrap">
      <div className={"reviewbar" + (n === 0 ? " zero" : "")}>
        <span className="rvn">{num(n)}</span>
        <span className="rvt">
          {n === 0 ? (
            <>
              Abhi tak kisi player ko <b>fraud confirm</b> nahi kiya. Table ke aakhri
              column me tick karke mark kijiye.
            </>
          ) : (
            <>
              players <b>fraud confirm</b> ho chuke hain.
              {mode === "saved"
                ? " Ye har device par dikhenge."
                : " Ye sirf isi browser me hain."}
            </>
          )}
        </span>

        <input
          type="search"
          value={reviewer}
          placeholder="Aapka naam (optional)"
          style={{ minWidth: 150 }}
          onChange={(e) => setReviewer(e.target.value)}
          aria-label="Reviewer ka naam"
        />

        {msg ? <span className="rvmsg">{msg}</span> : null}

        <button
          className="rvbtn"
          disabled={n === 0}
          onClick={() => {
            const tsv = toTSV(rules, ticks);
            setFallback("");
            copyText(tsv)
              .then(() => say("✓ " + n + " players copy ho gaye"))
              .catch(() => {
                setFallback(tsv);
                say("clipboard block hai — neeche se copy kijiye");
              });
          }}
        >
          Confirmed list copy karo
        </button>

        <button
          className="rvbtn danger"
          disabled={n === 0}
          onClick={() => {
            if (window.confirm("Saare " + n + " ticks hata dein? Ye wapas nahi aayenge.")) {
              setFallback("");
              onClear();
            }
          }}
        >
          Sab ticks hatao
        </button>
      </div>

      {mode === "local" || error ? (
        <div className="dbline">
          {mode === "local" ? (
            <span className="dbpill warn">Sirf is browser me</span>
          ) : null}
          {error ? <span className="dbpill bad">{error}</span> : null}
        </div>
      ) : null}

      {fallback ? (
        <div className="rvfall">
          <p>
            Browser ne clipboard block kar diya. Neeche wale box me click karke{" "}
            <b>Ctrl+A</b> phir <b>Ctrl+C</b> dabaiye — Excel me seedha paste ho jayega.
          </p>
          <textarea
            readOnly
            value={fallback}
            rows={8}
            onFocus={(e) => e.target.select()}
          />
          <button className="rvbtn" onClick={() => setFallback("")}>
            Band karo
          </button>
        </div>
      ) : null}
    </div>
  );
}
