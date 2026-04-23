const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const Discussion = require("../models/Discussion");
const { requireAuth } = require("../middleware/auth");
const { getPaging } = require("../srclib/pagination");

const router = express.Router();

function dbReady() {
  return mongoose.connection.readyState === 1;
}

// GET /api/discussions?category=&page=&limit=
router.get("/", async (req, res, next) => {
  try {
    if (!dbReady()) return res.json({ page: 1, limit: 20, total: 0, items: [] });

    const { page, limit, skip } = getPaging(req.query, { defaultLimit: 20, maxLimit: 50 });
    const category = String(req.query.category || "all").toLowerCase();
    const filter = category && category !== "all" ? { category } : {};

    const [items, total] = await Promise.all([
      Discussion.find(filter, {
        title: 1,
        content: 1,
        category: 1,
        authorName: 1,
        authorEmail: 1,
        authorPhoto: 1,
        likes: 1,
        replies: { $slice: -3 },
        replyCount: { $size: "$replies" },
        createdAt: 1
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Discussion.countDocuments(filter)
    ]);

    // Add reply count since $size in projection doesn't work in all Mongo versions
    const mapped = items.map((item) => ({
      ...item,
      replyCount: Array.isArray(item.replies) ? item.replies.length : 0,
      likeCount: Array.isArray(item.likes) ? item.likes.length : 0
    }));

    res.json({ page, limit, total, items: mapped });
  } catch (err) {
    next(err);
  }
});

// GET /api/discussions/:id
router.get("/:id", async (req, res, next) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: "Database not connected." });

    const doc = await Discussion.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Discussion not found" });

    res.json({
      item: {
        ...doc,
        replyCount: Array.isArray(doc.replies) ? doc.replies.length : 0,
        likeCount: Array.isArray(doc.likes) ? doc.likes.length : 0
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/discussions
router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: "Database not connected." });

    const schema = z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(5000),
      category: z.enum(["general", "technology", "business", "sports", "war", "feedback"]).default("general")
    });

    const body = schema.parse(req.body);

    const doc = await Discussion.create({
      title: body.title,
      content: body.content,
      category: body.category,
      authorName: req.user.name || req.user.email || "Anonymous",
      authorEmail: req.user.email || "",
      authorPhoto: req.user.photoURL || ""
    });

    res.status(201).json({ item: doc });
  } catch (err) {
    next(err);
  }
});

// POST /api/discussions/:id/reply
router.post("/:id/reply", requireAuth, async (req, res, next) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: "Database not connected." });

    const schema = z.object({
      content: z.string().min(1).max(2000)
    });
    const body = schema.parse(req.body);

    const doc = await Discussion.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          replies: {
            authorName: req.user.name || req.user.email || "Anonymous",
            authorEmail: req.user.email || "",
            authorPhoto: req.user.photoURL || "",
            content: body.content,
            createdAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: "Discussion not found" });
    res.json({ ok: true, replyCount: doc.replies.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/discussions/:id/like
router.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: "Database not connected." });

    const userId = req.user.uid || req.user.email;
    const doc = await Discussion.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Discussion not found" });

    const index = doc.likes.indexOf(userId);
    if (index >= 0) {
      doc.likes.splice(index, 1);
    } else {
      doc.likes.push(userId);
    }
    await doc.save();

    res.json({ liked: index < 0, likeCount: doc.likes.length });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/discussions/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: "Database not connected." });

    const doc = await Discussion.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Discussion not found" });

    // Only author or admin can delete
    if (doc.authorEmail !== req.user.email) {
      return res.status(403).json({ error: "Only the author can delete this discussion." });
    }

    await Discussion.deleteOne({ _id: doc._id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
