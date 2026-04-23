const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");

const News = require("../models/News");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { upsertUserFromAuth } = require("../srclib/user");

const router = express.Router();

function dbReady() {
  return mongoose.connection.readyState === 1;
}

// POST /api/saved/save
// body: { newsId?: string, article?: { title, summary, image, category, source, url, publishedAt } }
router.post("/save", requireAuth, async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.status(503).json({ error: "Database is not connected. Bookmarks require MongoDB." });
    }

    const schema = z.object({
      newsId: z.string().optional(),
      article: z
        .object({
          title: z.string().min(1),
          summary: z.string().min(1),
          image: z.string().optional().default(""),
          category: z
            .enum(["all", "technology", "business", "sports", "war"])
            .default("all"),
          source: z.string().optional().default(""),
          url: z.string().url(),
          publishedAt: z.string().datetime().optional()
        })
        .optional()
    });

    const body = schema.parse(req.body);
    const user = await upsertUserFromAuth(req.user);

    let newsDoc = null;
    if (body.newsId) {
      newsDoc = await News.findById(body.newsId);
      if (!newsDoc) return res.status(404).json({ error: "News not found" });
    } else if (body.article) {
      const a = body.article;
      const publishedAt = a.publishedAt ? new Date(a.publishedAt) : new Date();

      newsDoc = await News.findOneAndUpdate(
        { url: a.url },
        {
          $setOnInsert: {
            title: a.title,
            summary: a.summary,
            image: a.image || "",
            category: a.category || "all",
            source: a.source || "",
            url: a.url,
            publishedAt,
            provider: "external"
          }
        },
        { upsert: true, new: true }
      );
    } else {
      return res.status(400).json({ error: "Missing newsId or article" });
    }

    const already = user.savedArticles.some((id) => String(id) === String(newsDoc._id));
    if (!already) {
      user.savedArticles.push(newsDoc._id);
      await user.save();
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/saved/unsave
router.post("/unsave", requireAuth, async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.status(503).json({ error: "Database is not connected." });
    }

    const schema = z.object({ newsId: z.string().min(1) });
    const body = schema.parse(req.body);
    const user = await upsertUserFromAuth(req.user);

    await User.updateOne(
      { _id: user._id },
      { $pull: { savedArticles: body.newsId } }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/saved
router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.json({ items: [] });
    }

    const user = await upsertUserFromAuth(req.user);
    const doc = await User.findById(user._id)
      .populate({
        path: "savedArticles",
        select: "title summary image category source url publishedAt provider"
      })
      .lean();

    res.json({ items: doc?.savedArticles || [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
