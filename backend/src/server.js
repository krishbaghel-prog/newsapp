require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { connectDb, getDbState } = require("./srclib/db");
const { errorHandler, notFound } = require("./srclib/errors");

const newsRoutes = require("./routes/news.routes");
const liveRoutes = require("./routes/live.routes");
const savedRoutes = require("./routes/saved.routes");
const adminRoutes = require("./routes/admin.routes");
const videoRoutes = require("./routes/video.routes");
const chatRoutes = require("./routes/chat.routes");
const authRoutes = require("./routes/auth.routes");
const storiesRoutes = require("./routes/stories.routes");
const discussionRoutes = require("./routes/discussion.routes");

const app = express();
const configuredOrigins = String(process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (configuredOrigins.length === 0) return true;
  const normalizedOrigin = origin.replace(/\/+$/, "");
  if (configuredOrigins.includes(normalizedOrigin)) return true;
  return isLocalOrigin(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120
  })
);

app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    authMode: String(process.env.AUTH_MODE || "firebase").toLowerCase().trim(),
    dbState: getDbState()
  })
);

app.use("/api/news", newsRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/saved", savedRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/discussions", discussionRoutes);

// Back-compat aliases (as requested paths without /api)
app.use("/news", newsRoutes);
app.use("/live", liveRoutes);
app.use("/saved", savedRoutes);
app.use("/admin", adminRoutes);
app.use("/auth", authRoutes);
app.use("/stories", storiesRoutes);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 4000);

async function startServer() {
  try {
    await connectDb();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("MongoDB connection failed — starting without database:", err.message);
    // eslint-disable-next-line no-console
    console.warn("External news APIs, videos, and chat will still work.");
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on :${port}`);
    // eslint-disable-next-line no-console
    console.log(`DB state: ${getDbState()}`);
  });
}

startServer();
