const express = require("express");
const { isDbConnected } = require("../services/newsFeed");
const { getPaging } = require("../srclib/pagination");
const { getMergedNews } = require("../services/newsFeed");
const { normalizeCategory } = require("../services/newsProviders");

const router = express.Router();

// GET /api/news?category=&page=&limit=&source=external|db|all
router.get("/", async (req, res, next) => {
  try {
    const category = normalizeCategory(req.query.category);
    const source = String(req.query.source || "all").toLowerCase();
    const lang = String(req.query.lang || "en").toLowerCase().slice(0, 5);
    const { page, limit, skip } = getPaging(req.query, {
      defaultLimit: 20,
      maxLimit: 50
    });

    const { items } = await getMergedNews({
      category,
      page,
      pageSize: limit,
      skip,
      source,
      lang
    });

    res.json({
      page,
      limit,
      category,
      items,
      warning:
        items.length === 0
          ? "No articles available yet. Add API keys in backend/.env or publish articles from the admin panel."
          : undefined
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/news/changes?since=ISO_DATE
router.get("/changes", async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.json({ count: 0, latestCreatedAt: null });
    }

    const News = require("../models/News");
    const sinceRaw = String(req.query.since || "");
    const since = sinceRaw ? new Date(sinceRaw) : null;
    if (!since || Number.isNaN(since.getTime())) {
      return res.status(400).json({ error: "Invalid since" });
    }

    const count = await News.countDocuments({ createdAt: { $gt: since } });
    const latest = await News.findOne({}, { createdAt: 1 })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      count,
      latestCreatedAt: latest?.createdAt || null
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/news/notify?since=ISO_DATE
router.get("/notify", async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.json({ hasNew: false, count: 0, latestCreatedAt: null });
    }

    const News = require("../models/News");
    const sinceRaw = String(req.query.since || "");
    const since = sinceRaw ? new Date(sinceRaw) : null;
    if (!since || Number.isNaN(since.getTime())) {
      return res.status(400).json({ error: "Invalid since" });
    }

    const count = await News.countDocuments({ createdAt: { $gt: since } });
    const latest = await News.findOne({}, { createdAt: 1 })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      hasNew: count > 0,
      count,
      latestCreatedAt: latest?.createdAt || null
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/news/search?q=term&lang=en&limit=20
router.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json({ items: [] });
    }

    const lang = String(req.query.lang || "en").toLowerCase().slice(0, 5);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));

    const results = [];

    // 1) Search database by title regex
    if (isDbConnected()) {
      try {
        const News = require("../models/News");
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const dbResults = await News.find(
          { $or: [{ title: regex }, { summary: regex }] },
          { title: 1, summary: 1, image: 1, category: 1, source: 1, url: 1, publishedAt: 1, provider: 1 }
        )
          .sort({ publishedAt: -1 })
          .limit(limit)
          .lean();
        results.push(...dbResults);
      } catch {}
    }

    // 2) Search external via providers — use q as search query
    try {
      const { fetchExternalNews } = require("../services/newsProviders");
      const external = await fetchExternalNews({ category: "all", page: 1, pageSize: limit, lang, q });
      results.push(...(external || []));
    } catch {}

    // Dedup by URL
    const { mergeUniqueArticles } = require("../services/newsFeed");
    const items = mergeUniqueArticles([results]).slice(0, limit);

    res.json({ items, query: q });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
