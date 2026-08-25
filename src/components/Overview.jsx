import { inr, num } from "../format.js";

export default function Overview({ rules, meta, ticks, onOpen }) {
  const maxD = Math.max(...meta.dist.map((d) => d[1]));

  return (
    <div>
      <h3 className="sec">Saat rules — ek nazar me</h3>
      <p className="sub">
        Har card par click karke us rule ke players, threshold aur poori detail
        dekhiye. Number = us rule me kitne players flag hue.
      </p>

      <div className="ovgrid">
        {rules.map((r) => {
          const mi = r.cols.findIndex((c) => c.l === r.money);
          const top = r.rows.reduce((a, x) => {
            const v = mi < 0 ? 0 : x.v[mi];
            return typeof v === "number" && v > a ? v : a;
          }, 0);
          const nw = r.rows.filter((x) => x.nw).length;
          const done = r.rows.filter((x) => ticks[x.id]).length;

          return (
            <button key={r.id} className="ovcard" onClick={() => onOpen(r.id)}>
              <div className="ovhead">
                <span className="ovid">
                  {r.id} · NewRules #{r.num}
                </span>
                <span className="ovn">{r.rows.length}</span>
              </div>
              <h4 className="ovt">{r.short}</h4>
              <p className="ovg">{r.gist}</p>
              <div className="ovfoot">
                <span>naye account: {nw}</span>
                <span>{done > 0 ? done + " confirm" : "top " + inr(top)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <h3 className="sec">Kitne players ek se zyada rule tod rahe hain</h3>
      <p className="sub">
        Ek rule tootna sanyog ho sakta hai. Jo player <strong>alag-alag tareeke se</strong>{" "}
        pakda jaye — wo sabse pakka case hai. Ye ginti data se hai, koi anumaan nahi.
      </p>
      <div className="olap">
        {meta.dist.map((d) => (
          <div key={d[0]} className={"olrow" + (d[0] >= 2 ? " hot" : "")}>
            <span className="ollab">
              {d[0]} rule{d[0] === 1 ? "" : "s"} toote
            </span>
            <span className="olbar">
              <i style={{ width: (d[1] / maxD) * 100 + "%" }} />
            </span>
            <span className="olct">{num(d[1])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
