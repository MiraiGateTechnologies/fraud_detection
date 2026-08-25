export function inr(n) {
  if (n === null || n === undefined || n === "") return "—";
  if (typeof n !== "number") return String(n);
  const abs = Math.abs(n);
  const s =
    abs >= 1000
      ? Math.round(abs).toLocaleString("en-IN")
      : (Math.round(abs * 100) / 100).toLocaleString("en-IN");
  return (n < 0 ? "−₹" : "₹") + s;
}

export function num(n) {
  if (n === null || n === undefined || n === "") return "—";
  if (typeof n !== "number") return String(n);
  return n.toLocaleString("en-IN");
}

export const fmt = (v, money) => (money ? inr(v) : num(v));

export const cls = (v) =>
  typeof v === "number" ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : "";

/** Sabse lambi contiguous run nikaalne jaisa kuch nahi — sirf W/L ko blocks me todta hai. */
export function wlBlocks(s) {
  const out = [];
  let run = "";
  let last = "";
  for (const ch of String(s || "")) {
    if (ch !== last && run) {
      out.push([last, run]);
      run = "";
    }
    last = ch;
    run += ch;
  }
  if (run) out.push([last, run]);
  return out;
}
