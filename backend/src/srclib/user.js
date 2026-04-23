const User = require("../models/User");

async function upsertUserFromAuth(authUser) {
  const firebaseUid = authUser.uid;
  const update = {
    firebaseUid,
    name: authUser.name || "",
    email: authUser.email || ""
  };

  return await User.findOneAndUpdate(
    { firebaseUid },
    { $set: update, $setOnInsert: { savedArticles: [] } },
    { new: true, upsert: true }
  );
}

module.exports = { upsertUserFromAuth };

