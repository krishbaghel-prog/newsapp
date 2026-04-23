const express = require("express");
const mongoose = require("mongoose");
const LiveUpdate = require("../models/LiveUpdate");
const { getPaging } = require("../srclib/pagination");

const router = express.Router();

// GET /api/live?page=&limit=
router.get("/", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ page: 1, limit: 30, items: [] });
    }

    const { page, limit, skip } = getPaging(req.query, {
      defaultLimit: 30,
      maxLimit: 100
    });

    const items = await LiveUpdate.find({}, { content: 1, timestamp: 1 })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ page, limit, items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
