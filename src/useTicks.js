import { useCallback, useEffect, useState } from "react";

/**
 * "Fraud confirm" ticks.
 *
 * Pehli pasand: server par save (sabko ek hi list dikhti hai, incognito me bhi
 * nahi udti). Wo na mile to app localStorage par chalta rehta hai — aur screen
 * par saaf likha aata hai ki ticks sirf isi browser me hain, taaki kaam chup-chap
 * na khoye.
 *
 * UI ko kabhi ye nahi bataya jaata ki peeche kaunsa database hai ya kya galat
 * hua — wo sirf server log me jaata hai.
 */
const LS_KEY = "miraigate_fraud_confirmed_v1";
const LS_WHO = "miraigate_reviewer_name";

function loadLocal() {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return {};
    const o = {};
    for (const x of arr) o[x] = 1;
    return o;
  } catch {
    return {};
  }
}

function saveLocal(o) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(Object.keys(o)));
  } catch {
    /* storage full ya blocked */
  }
}

export function loadReviewer() {
  try {
    return window.localStorage.getItem(LS_WHO) || "";
  } catch {
    return "";
  }
}

export function saveReviewer(v) {
  try {
    window.localStorage.setItem(LS_WHO, v);
  } catch {
    /* ignore */
  }
}

async function api(method, body) {
  const res = await fetch("/api/ticks", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({ ok: false }));
}

export function useTicks() {
  const [ticks, setTicks] = useState({});
  const [mode, setMode] = useState("loading"); // loading | saved | local
  const [error, setError] = useState("");
  const [busy, setBusy] = useState({});

  const goLocal = useCallback(() => {
    setTicks(loadLocal());
    setMode("local");
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api("GET");
        if (!alive) return;
        if (r.ok && r.persistent) {
          const o = {};
          for (const row of r.ticks || []) o[row.user_id] = 1;
          setTicks(o);
          setMode("saved");
          setError("");
        } else {
          goLocal();
        }
      } catch {
        if (alive) goLocal();
      }
    })();
    return () => {
      alive = false;
    };
  }, [goLocal]);

  /* doosre browser tab me tick lage to yahan bhi dikhe (local mode) */
  useEffect(() => {
    if (mode !== "local") return undefined;
    const sync = (e) => {
      if (e.key === LS_KEY) setTicks(loadLocal());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [mode]);

  const toggle = useCallback(
    async (player, markedBy) => {
      const id = player.id;
      const on = !ticks[id];

      // turant UI update — save fail hua to wapas palat denge
      setTicks((prev) => {
        const next = { ...prev };
        if (on) next[id] = 1;
        else delete next[id];
        if (mode === "local") saveLocal(next);
        return next;
      });

      if (mode !== "saved") return;

      setBusy((b) => ({ ...b, [id]: 1 }));
      try {
        const r = await api("POST", {
          userId: id,
          userCode: player.c,
          name: player.n,
          on,
          markedBy: markedBy || "",
        });
        if (!r.ok) throw new Error("save-failed");
        setError("");
      } catch {
        setTicks((prev) => {
          const next = { ...prev };
          if (on) delete next[id];
          else next[id] = 1;
          return next;
        });
        setError("Tick save nahi hua. Dobara koshish kijiye.");
      } finally {
        setBusy((b) => {
          const n = { ...b };
          delete n[id];
          return n;
        });
      }
    },
    [ticks, mode]
  );

  const clear = useCallback(async () => {
    const before = ticks;
    setTicks({});
    if (mode === "local") {
      saveLocal({});
      return;
    }
    try {
      const r = await api("DELETE");
      if (!r.ok) throw new Error("clear-failed");
      setError("");
    } catch {
      setTicks(before);
      setError("Ticks hat nahi paye. Dobara koshish kijiye.");
    }
  }, [ticks, mode]);

  return { ticks, mode, error, busy, toggle, clear };
}
