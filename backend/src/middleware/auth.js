const { verifyIdToken } = require("../srclib/firebase");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  return token || null;
}

function getDemoUser() {
  return {
    uid: process.env.DEV_USER_ID || "dev",
    email: process.env.DEV_USER_EMAIL || "dev@example.com",
    name: process.env.DEV_USER_NAME || "Demo User",
    photoURL: process.env.DEV_USER_PHOTO_URL || ""
  };
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email) {
  if (!email) return false;
  return getAdminEmails().includes(String(email).trim().toLowerCase());
}

/**
 * Decode JWT payload WITHOUT verification — used as fallback when
 * Firebase Admin SDK is not configured on the server. This lets real
 * logged-in users post/bookmark with their actual email/name.
 * Security note: the signature is NOT checked here; use only as fallback.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64URL decode the payload section
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json);
    // Must have at minimum a subject (uid) or email to be useful
    if (!payload.sub && !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

const FIREBASE_UNAVAILABLE_PHRASES = [
  "temporarily unavailable",
  "credentials not configured",
  "configuration error",
  "Authentication service"
];

function isFirebaseUnavailable(msg) {
  return FIREBASE_UNAVAILABLE_PHRASES.some((p) => msg.includes(p));
}

async function requireAuth(req, res, next) {
  try {
    const mode = String(process.env.AUTH_MODE || "firebase").toLowerCase().trim();
    if (mode === "none") {
      req.user = getDemoUser();
      return next();
    }

    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing auth token. Please sign in." });

    // ── Attempt full Firebase Admin token verification ──────────────────────
    try {
      const decoded = await verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        photoURL: decoded.picture || ""
      };
      return next();
    } catch (firebaseErr) {
      const firebaseMsg = String(firebaseErr?.message || "");

      // ── Firebase Admin not configured — fall back to JWT payload decode ──
      // This lets real users post with their actual identity even when the
      // server-side Firebase credentials are missing (e.g. on Render free tier).
      if (isFirebaseUnavailable(firebaseMsg)) {
        const payload = decodeJwtPayload(token);
        if (payload) {
          req.user = {
            uid: payload.sub || payload.user_id || payload.email || "unknown",
            email: payload.email || "",
            name: payload.name || payload.email || "User",
            photoURL: payload.picture || ""
          };
          // eslint-disable-next-line no-console
          console.warn("[auth] Firebase Admin unavailable — using unverified JWT payload for:", req.user.email);
          return next();
        }
        // JWT decode also failed — surface a clean error
        return res.status(503).json({
          error: "Authentication service is unavailable. Please try again later."
        });
      }

      // Re-throw all other Firebase errors to be handled below
      throw firebaseErr;
    }
  } catch (err) {
    const msg = String(err?.message || "");

    // Sanitize internal infrastructure errors
    if (
      msg.includes("Failed to determine project ID") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("metadata.google.internal") ||
      msg.includes("getaddrinfo") ||
      msg.includes("Error while making request") ||
      msg.includes("ECONNREFUSED")
    ) {
      return res.status(503).json({ error: "Authentication service is temporarily unavailable. Please try again later." });
    }

    if (
      err.code === "auth/argument-error" ||
      err.code === "auth/id-token-expired" ||
      err.code === "auth/id-token-revoked"
    ) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }

    return res.status(401).json({ error: "Authentication failed. Please sign in and try again." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.email) return res.status(401).json({ error: "Unauthorized" });
  const emails = getAdminEmails();
  if (emails.length === 0) {
    return res.status(403).json({
      error: "Admin access disabled (set ADMIN_EMAILS)"
    });
  }
  if (!isAdminEmail(req.user.email)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}

module.exports = { requireAuth, requireAdmin, isAdminEmail, getDemoUser };
