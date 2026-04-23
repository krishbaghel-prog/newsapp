const express = require("express");

const { isAdminEmail, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  res.json({
    id: req.user?.uid || "",
    email: req.user?.email || "",
    displayName: req.user?.name || "",
    photoURL: req.user?.photoURL || "",
    isAdmin: isAdminEmail(req.user?.email),
    authMode: String(process.env.AUTH_MODE || "firebase").toLowerCase().trim()
  });
});

module.exports = router;
