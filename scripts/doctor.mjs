import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const rootDir = process.cwd();

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return acc;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      acc[key] = value;
      return acc;
    }, {});
}

function isLocalMongoUri(uri) {
  return /mongodb(\+srv)?:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(uri);
}

function parseMongoSocketTarget(uri) {
  const match = uri.match(
    /^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?(?<host>[^:/?,]+)(?::(?<port>\d+))?/i
  );

  if (!match?.groups?.host) return null;

  return {
    host: match.groups.host,
    port: Number(match.groups.port || 27017)
  };
}

function checkPortOpen({ host, port }, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    function finish(open) {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    }

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

function addMissingKeys(target, keys, issues) {
  const missing = keys.filter((key) => !target[key]);
  if (missing.length) {
    issues.push(`Missing ${missing.join(", ")}`);
  }
}

async function main() {
  const backendEnv = readEnvFile(path.join(rootDir, "backend", ".env"));
  const frontendEnv = readEnvFile(path.join(rootDir, "frontend", ".env"));

  const issues = [];
  const notes = [];

  const backendAuth = String(backendEnv.AUTH_MODE || "none").toLowerCase().trim();
  const frontendAuth = String(frontendEnv.VITE_AUTH_MODE || "none").toLowerCase().trim();

  if (!backendEnv.MONGODB_URI) {
    issues.push("Missing backend MONGODB_URI");
  } else if (isLocalMongoUri(backendEnv.MONGODB_URI)) {
    const target = parseMongoSocketTarget(backendEnv.MONGODB_URI);
    if (target) {
      const isOpen = await checkPortOpen(target);
      if (!isOpen) {
        issues.push(
          `MongoDB is not reachable at ${target.host}:${target.port}. Start MongoDB or switch MONGODB_URI to Atlas.`
        );
      }
    }
  } else {
    notes.push("Backend is configured to use a hosted MongoDB connection.");
  }

  if (!frontendEnv.VITE_API_BASE_URL) {
    issues.push("Missing frontend VITE_API_BASE_URL");
  } else if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(frontendEnv.VITE_API_BASE_URL)) {
    notes.push("VITE_API_BASE_URL is local. Replace it with your deployed backend URL for production.");
  }

  if (!backendEnv.CLIENT_ORIGIN) {
    issues.push("Missing backend CLIENT_ORIGIN");
  } else if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:,|$)/i.test(backendEnv.CLIENT_ORIGIN)) {
    notes.push("CLIENT_ORIGIN is local. Replace it with your deployed frontend URL on Render.");
  }

  if (backendAuth !== frontendAuth) {
    issues.push(
      `Auth mode mismatch: backend AUTH_MODE=${backendAuth} but frontend VITE_AUTH_MODE=${frontendAuth}`
    );
  }

  if (backendAuth === "firebase") {
    if (!backendEnv.FIREBASE_SERVICE_ACCOUNT_JSON) {
      notes.push("Backend Firebase auth is enabled. Set FIREBASE_SERVICE_ACCOUNT_JSON in deployment.");
    }
    addMissingKeys(
      frontendEnv,
      [
        "VITE_FIREBASE_API_KEY",
        "VITE_FIREBASE_AUTH_DOMAIN",
        "VITE_FIREBASE_PROJECT_ID",
        "VITE_FIREBASE_APP_ID",
        "VITE_FIREBASE_MESSAGING_SENDER_ID"
      ],
      issues
    );
  }

  const prefix = issues.length === 0 ? "Release doctor: PASS" : "Release doctor: ACTION NEEDED";
  console.log(prefix);

  if (issues.length) {
    console.log("");
    console.log("Blocking items:");
    for (const issue of issues) {
      console.log(`- ${issue}`);
    }
  }

  if (notes.length) {
    console.log("");
    console.log("Notes:");
    for (const note of notes) {
      console.log(`- ${note}`);
    }
  }
}

main().catch((error) => {
  console.error("Release doctor failed:", error);
  process.exit(1);
});
