/**
 * "Confirmed fraud" ticks.
 *
 * First choice is the shared database behind /api/ticks, so every reviewer sees the
 * same list on every device, even in an incognito window. If the API has no database,
 * the ticks fall back to this browser's localStorage and the page says so clearly,
 * so work is never lost without warning.
 *
 * The page never shows which database is used or why a request failed. Those details
 * stay in the server log (Vercel -> Logs).
 *
 * A tick belongs to the player (numeric platform user ID), not to a single request:
 * ticking a user marks every request from that user, in both sections.
 */
const LS_KEY = "miraigate_fraud_confirmed_v1";
const LS_WHO = "miraigate_reviewer_name";

function readLocal() {
  const map = new Map();
  try {
    const arr = JSON.parse(window.localStorage.getItem(LS_KEY) || "[]");
    if (Array.isArray(arr)) {
      for (const x of arr) {
        const id = Number(x);
        if (Number.isInteger(id)) map.set(id, {});
      }
    }
  } catch {
    /* storage blocked or corrupt */
  }
  return map;
}

function writeLocal(map) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify([...map.keys()].map(String)));
  } catch {
    /* storage full or blocked */
  }
}

export function loadReviewer() {
  try {
    return window.localStorage.getItem(LS_WHO) || "";
  } catch {
    return "";
  }
}

export function saveReviewer(value) {
  try {
    window.localStorage.setItem(LS_WHO, value);
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

/** onChange is called after every change of ticks, mode, busy state or error. */
export function createTicks(onChange) {
  let ids = new Map(); // user id -> { code, by, at }
  let mode = "loading"; // loading | saved | local
  let error = "";
  const busy = new Set();
  const emit = () => onChange();

  const goLocal = () => {
    ids = readLocal();
    mode = "local";
  };

  async function load() {
    try {
      const r = await api("GET");
      if (r.ok && r.persistent) {
        ids = new Map();
        for (const row of r.ticks || []) {
          ids.set(Number(row.user_id), { code: row.user_code || "", by: row.marked_by || "", at: row.marked_at || "" });
        }
        mode = "saved";
        error = "";
      } else {
        goLocal();
      }
    } catch {
      goLocal();
    }
    emit();
  }

  async function toggle(id, code, by) {
    if (busy.has(id) || mode === "loading") return;
    const on = !ids.has(id);
    const before = ids.get(id);

    // update the screen at once; undo it if the save fails
    if (on) ids.set(id, { code, by: by || "", at: new Date().toISOString() });
    else ids.delete(id);

    if (mode === "local") {
      writeLocal(ids);
      emit();
      return;
    }

    busy.add(id);
    emit();
    try {
      const r = await api("POST", { userId: id, userCode: code, name: "", on, markedBy: by || "" });
      if (!r.ok) throw new Error("save-failed");
      error = "";
    } catch {
      if (on) ids.delete(id);
      else ids.set(id, before || {});
      error = "The tick was not saved. Please try again.";
    } finally {
      busy.delete(id);
      emit();
    }
  }

  async function clear() {
    const before = ids;
    ids = new Map();
    if (mode === "local") {
      writeLocal(ids);
      emit();
      return;
    }
    emit();
    try {
      const r = await api("DELETE");
      if (!r.ok) throw new Error("clear-failed");
      error = "";
    } catch {
      ids = before;
      error = "The ticks were not removed. Please try again.";
    }
    emit();
  }

  // a tick added in another tab shows here too (browser-only mode)
  window.addEventListener("storage", (e) => {
    if (mode === "local" && e.key === LS_KEY) {
      ids = readLocal();
      emit();
    }
  });

  return {
    load,
    toggle,
    clear,
    has: (id) => ids.has(id),
    get: (id) => ids.get(id),
    entries: () => [...ids.entries()],
    count: () => ids.size,
    isBusy: (id) => busy.has(id),
    mode: () => mode,
    error: () => error,
  };
}
