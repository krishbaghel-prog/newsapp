const admin = require("firebase-admin");

let initialized = false;

function initFirebaseAdmin() {
  if (initialized) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // Uses GOOGLE_APPLICATION_CREDENTIALS if set, otherwise will throw on verify.
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
  initialized = true;
}

async function verifyIdToken(idToken) {
  initFirebaseAdmin();
  return await admin.auth().verifyIdToken(idToken);
}

module.exports = { verifyIdToken };

