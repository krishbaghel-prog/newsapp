const admin = require("firebase-admin");

let initialized = false;
let initError = null;

function initFirebaseAdmin() {
  if (initialized || initError) return;

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Only use applicationDefault() if explicitly configured
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    } else {
      // No credentials configured — mark as unavailable
      initError = new Error("Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON.");
      initError.status = 503;
      return;
    }
    initialized = true;
  } catch (err) {
    initError = new Error("Authentication service configuration error.");
    initError.status = 503;
  }
}

async function verifyIdToken(idToken) {
  initFirebaseAdmin();

  if (initError) {
    const err = new Error("Authentication service is temporarily unavailable.");
    err.status = 503;
    throw err;
  }

  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    // Sanitize any Google internal errors before they propagate
    const msg = err?.message || "";
    if (
      msg.includes("Failed to determine project ID") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("metadata.google.internal") ||
      msg.includes("getaddrinfo")
    ) {
      const sanitized = new Error("Authentication service is temporarily unavailable. Please try again later.");
      sanitized.status = 503;
      throw sanitized;
    }
    throw err;
  }
}

module.exports = { verifyIdToken };

