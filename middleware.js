/**
 * Vercel Edge Middleware — Basic Auth for the whole site.
 *
 * Vercel's own "Password Protection" is a Pro plan feature. This does the same job
 * on the free Hobby plan.
 *
 * Set two environment variables in Vercel:
 *     BASIC_AUTH_USER
 *     BASIC_AUTH_PASS
 *
 * If either is missing, the middleware lets every request through and the site opens
 * WITHOUT a password.
 */
export const config = {
  matcher: "/((?!_vercel|favicon\\.ico).*)",
};

export default function middleware(request) {
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASS;

  // Not configured -> let the request through
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
      if (timingSafeEqual(u, USER) && timingSafeEqual(p, PASS)) return; // allow
    }
  }

  return new Response("Login required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="MiraiGate Fraud Detection", charset="UTF-8"',
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
