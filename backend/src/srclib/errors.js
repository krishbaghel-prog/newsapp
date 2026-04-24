// Patterns that are internal infrastructure errors — never expose to users
const INTERNAL_ERROR_PATTERNS = [
  "Failed to determine project ID",
  "ENOTFOUND",
  "metadata.google.internal",
  "getaddrinfo",
  "ECONNREFUSED",
  "socket hang up",
  "serviceAccount",
  "applicationDefault",
  "FIREBASE_SERVICE_ACCOUNT",
  "Error while making request"
];

function isSensitiveError(text) {
  const str = String(text || "").toLowerCase();
  return INTERNAL_ERROR_PATTERNS.some((p) => str.toLowerCase().includes(p.toLowerCase()));
}

function notFound(req, res, _next) {
  res.status(404).json({ error: "Not found", path: req.path });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const status = Number(err.status || 500);
  const rawMessage =
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    "Server error";

  // Gather full error text to scan for sensitive patterns
  let fullText = rawMessage;
  try {
    fullText += " " + String(err?.stack || "") + " " + JSON.stringify(err);
  } catch (_) {}

  let message = rawMessage;
  if (isSensitiveError(fullText)) {
    if (status === 401 || status === 403) {
      message = "Authentication failed. Please sign in and try again.";
    } else {
      message = "A service error occurred. Please try again later.";
    }
  }

  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
