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

async function requireAuth(req, res, next) {
  try {
    const mode = String(process.env.AUTH_MODE || "firebase").toLowerCase().trim();
    if (mode === "none") {
      req.user = getDemoUser();
      return next();
    }

    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const decoded = await verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      photoURL: decoded.picture || ""
    };
    return next();
  } catch (err) {
    const msg = String(err?.message || "");
    // Sanitize any internal infrastructure or Firebase errors
    if (
      msg.includes("Failed to determine project ID") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("metadata.google.internal") ||
      msg.includes("getaddrinfo") ||
      msg.includes("Error while making request") ||
      msg.includes("ECONNREFUSED")
    ) {
      err.message = "Authentication service is temporarily unavailable. Please try again later.";
    } else if (
      err.code === "auth/argument-error" ||
      err.code === "auth/id-token-expired" ||
      err.code === "auth/id-token-revoked"
    ) {
      err.message = "Your session has expired. Please sign in again.";
    } else if (msg.includes("Firebase credentials not configured") || msg.includes("Authentication service")) {
      // Already sanitized by firebase.js — pass through as-is
    } else {
      err.message = "Authentication failed. Please sign in and try again.";
    }
    err.status = 401;
    return next(err);
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

