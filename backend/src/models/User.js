const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    email: { type: String, index: true },
    savedArticles: [{ type: mongoose.Schema.Types.ObjectId, ref: "News" }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

