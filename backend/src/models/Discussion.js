const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  authorName: { type: String, required: true },
  authorEmail: { type: String, required: true },
  authorPhoto: { type: String, default: "" },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const discussionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: {
      type: String,
      default: "general",
      enum: ["general", "technology", "business", "sports", "war", "feedback"]
    },
    authorName: { type: String, required: true },
    authorEmail: { type: String, required: true },
    authorPhoto: { type: String, default: "" },
    likes: [{ type: String }],
    replies: [replySchema]
  },
  { timestamps: true }
);

discussionSchema.index({ category: 1, createdAt: -1 });
discussionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Discussion", discussionSchema);
