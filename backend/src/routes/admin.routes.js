const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");

const News = require("../models/News");
const LiveUpdate = require("../models/LiveUpdate");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { aiSummarize } = require("../services/aiClient");
const { clampWords } = require("../srclib/text");

const router = express.Router();

router.use(requireAuth, requireAdmin);

function dbReady() {
  return mongoose.connection.readyState === 1;
}

// POST /api/admin/summarize
// body: { title?: string, text: string }
router.post("/summarize", async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().optional().default(""),
      text: z.string().min(1)
    });
    const body = schema.parse(req.body);

    const maxChars = 14000;
    const text = body.text.slice(0, maxChars);

    const summary = await aiSummarize({
      title: body.title,
      text,
      fallback: text
    });

    res.json({ summary: clampWords(summary, 50, 70) });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/news?category=&page=&limit=
router.get("/news", async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.json({ page: 1, limit: 20, total: 0, items: [] });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const category = String(req.query.category || "all").toLowerCase();
    const filter =
      category && category !== "all"
        ? { category }
        : {};

    const [items, total] = await Promise.all([
      News.find(filter, {
        title: 1,
        summary: 1,
        image: 1,
        category: 1,
        source: 1,
        url: 1,
        publishedAt: 1,
        provider: 1,
        createdAt: 1,
        updatedAt: 1
      })
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      News.countDocuments(filter)
    ]);

    res.json({ page, limit, total, items });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/news
router.post("/news", async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.status(503).json({ error: "Database is not connected. Publishing requires MongoDB." });
    }

    const schema = z.object({
      title: z.string().min(1),
      summary: z.string().min(1),
      image: z.string().optional().default(""),
      category: z.enum(["all", "world", "technology", "business", "politics", "sports", "entertainment", "health", "science", "war"]),
      source: z.string().optional().default(""),
      url: z.string().url(),
      publishedAt: z.string().datetime().optional()
    });

    const body = schema.parse(req.body);
    const publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();

    const doc = await News.findOneAndUpdate(
      { url: body.url },
      {
        $set: {
          title: body.title,
          summary: body.summary,
          image: body.image || "",
          category: body.category,
          source: body.source || "",
          url: body.url,
          publishedAt,
          provider: "admin"
        }
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ item: doc });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/news/:id
router.put("/news/:id", async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.status(503).json({ error: "Database is not connected." });
    }

    const schema = z.object({
      title: z.string().min(1).optional(),
      summary: z.string().min(1).optional(),
      image: z.string().optional(),
      category: z.enum(["all", "world", "technology", "business", "politics", "sports", "entertainment", "health", "science", "war"]).optional(),
      source: z.string().optional(),
      url: z.string().url().optional(),
      publishedAt: z.string().datetime().optional()
    });
    const body = schema.parse(req.body);

    const update = { ...body };
    if (body.publishedAt) update.publishedAt = new Date(body.publishedAt);
    update.provider = "admin";

    const doc = await News.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!doc) return res.status(404).json({ error: "News not found" });
    res.json({ item: doc });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/news/:id
router.delete("/news/:id", async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.status(503).json({ error: "Database is not connected." });
    }

    const id = req.params.id;
    await News.deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/live?page=&limit=
router.get("/live", async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.json({ page: 1, limit: 50, total: 0, items: [] });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      LiveUpdate.find({}, { content: 1, timestamp: 1, createdAt: 1, updatedAt: 1 })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LiveUpdate.countDocuments({})
    ]);

    res.json({ page, limit, total, items });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/live
router.post("/live", async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.status(503).json({ error: "Database is not connected." });
    }

    const schema = z.object({
      content: z.string().min(1),
      timestamp: z.string().datetime().optional()
    });
    const body = schema.parse(req.body);
    const doc = await LiveUpdate.create({
      content: body.content,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date()
    });
    res.status(201).json({ item: doc });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/live/:id
router.put("/live/:id", async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.status(503).json({ error: "Database is not connected." });
    }

    const schema = z.object({
      content: z.string().min(1).optional(),
      timestamp: z.string().datetime().optional()
    });
    const body = schema.parse(req.body);

    const update = { ...body };
    if (body.timestamp) update.timestamp = new Date(body.timestamp);

    const doc = await LiveUpdate.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!doc) return res.status(404).json({ error: "Live update not found" });
    res.json({ item: doc });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/live/:id
router.delete("/live/:id", async (req, res, next) => {
  try {
    if (!dbReady()) {
      return res.status(503).json({ error: "Database is not connected." });
    }

    await LiveUpdate.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
