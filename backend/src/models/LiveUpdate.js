const mongoose = require("mongoose");

const liveUpdateSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    timestamp: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

liveUpdateSchema.index({ timestamp: -1 });

module.exports = mongoose.model("LiveUpdate", liveUpdateSchema);

