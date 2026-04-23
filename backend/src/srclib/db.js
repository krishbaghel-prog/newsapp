const mongoose = require("mongoose");

let isConnected = false;
let connectPromise = null;

const READY_STATE_LABELS = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting"
};

async function connectDb() {
  if (isConnected) return;
  if (connectPromise) return connectPromise;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    // eslint-disable-next-line no-console
    console.warn("MONGODB_URI not set — running without database (external APIs only).");
    return;
  }

  mongoose.set("strictQuery", true);
  connectPromise = mongoose
    .connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: Number(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000
      ),
      connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 10000)
    })
    .then(() => {
      isConnected = true;
      // eslint-disable-next-line no-console
      console.log("MongoDB connected successfully.");
    })
    .finally(() => {
      connectPromise = null;
    });

  await connectPromise;
}

function getDbState() {
  return READY_STATE_LABELS[mongoose.connection.readyState] || "unknown";
}

module.exports = { connectDb, getDbState };
