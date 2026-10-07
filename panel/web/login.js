// Sign-in page of the review panel.

const $ = (id) => document.getElementById(id);
const form = $("loginForm");
const nameIn = $("name");
const passIn = $("password");
const btn = $("loginBtn");
const err = $("loginErr");

const NOTICE = {
  ended: "Your session has ended. Sign in again to continue.",
  replaced: "You were signed out because this account signed in on another browser. An account can be signed in on one browser at a time.",
  out: "You have signed out.",
};
const params = new URLSearchParams(location.search);
for (const [key, text] of Object.entries(NOTICE)) {
  if (params.has(key)) { $("loginMsg").textContent = text; $("loginMsg").hidden = false; }
}

function showError(text) {
  $("loginMsg").hidden = true;
  err.textContent = text;
  err.hidden = false;
}

$("pwToggle").onclick = () => {
  const show = passIn.type === "password";
  passIn.type = show ? "text" : "password";
  $("pwToggle").textContent = show ? "Hide" : "Show";
  $("pwToggle").setAttribute("aria-pressed", String(show));
  passIn.focus();
};

const caps = (e) => { $("caps").hidden = !(e.getModifierState && e.getModifierState("CapsLock")); };
passIn.addEventListener("keydown", caps);
passIn.addEventListener("keyup", caps);
passIn.addEventListener("blur", () => { $("caps").hidden = true; });

form.onsubmit = async (e) => {
  e.preventDefault();
  const name = nameIn.value.trim();
  const password = passIn.value;
  if (!name) { showError("Enter your user name."); nameIn.focus(); return; }
  if (!password) { showError("Enter your password."); passIn.focus(); return; }
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = "Signing in…";
  let msg;
  try {
    const res = await fetch("/api/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password }),
    });
    if (res.ok) {
      location.replace("/" + location.hash);
      return;
    }
    msg = res.status === 429 ? "Too many attempts. Wait a few minutes and try again." : "Sign-in failed. Try again.";
    try { const j = await res.json(); if (typeof j.detail === "string") msg = j.detail; } catch (x) { /* not json */ }
  } catch (x) {
    msg = "The panel could not be reached. Check your connection and try again.";
  }
  btn.disabled = false;
  btn.textContent = "Sign in";
  showError(msg);
  passIn.value = "";
  passIn.focus();
};
