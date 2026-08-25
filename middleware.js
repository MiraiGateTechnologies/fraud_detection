/**
 * Vercel Edge Middleware — poori site par Basic Auth.
 *
 * Vercel ka apna "Password Protection" Pro plan ka feature hai. Ye wahi kaam
 * free Hobby plan par kar deta hai.
 *
 * Chalane ke liye Vercel me do env vars set karo:
 *     BASIC_AUTH_USER
 *     BASIC_AUTH_PASS
 *
 * Dono set nahi honge to middleware kuch nahi rokega aur site BINA PASSWORD ke
 * khulegi — us soorat me dashboard par laal banner dikhta hai.
 */
export const config = {
  matcher: "/((?!_vercel|favicon\\.ico).*)",
};

export default function middleware(request) {
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASS;

  // Env set nahi -> aage jaane do (app khud banner dikha dega)
  if (!USER || !PASS) return;

  const header = request.headers.get("authorization") || "";
  const sp = header.indexOf(" ");
  const scheme = sp > 0 ? header.slice(0, sp) : "";
  const encoded = sp > 0 ? header.slice(sp + 1) : "";

  if (scheme.toLowerCase() === "basic" && encoded) {
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      decoded = "";
    }
    const i = decoded.indexOf(":");
    if (i > -1) {
      const u = decoded.slice(0, i);
      const p = decoded.slice(i + 1);
      if (timingSafeEqual(u, USER) && timingSafeEqual(p, PASS)) return; // andar jaane do
    }
  }

  return new Response("Login zaroori hai.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="MiraiGate Fraud Console", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
