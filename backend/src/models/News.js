const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    summary: { type: String, required: true },
    image: { type: String },
    category: {
      type: String,
      required: true,
      index: true,
      enum: ["all", "world", "technology", "business", "politics", "sports", "entertainment", "health", "science", "war"]
    },
    source: { type: String },
    url: { type: String, required: true, unique: true, index: true },
    publishedAt: { type: Date, required: true, index: true },
    provider: { type: String, default: "external", index: true }
  },
  { timestamps: true }
);

newsSchema.index({ category: 1, publishedAt: -1 });

module.exports = mongoose.model("News", newsSchema);

