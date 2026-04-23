const express = require("express");
const { z } = require("zod");

const { aiChat, getProvider } = require("../services/aiClient");
const {
  buildFallbackChatAnswer,
  buildFallbackTrustFeed
} = require("../services/analysisFallbacks");
const { getMergedNews } = require("../services/newsFeed");
const { normalizeCategory } = require("../services/newsProviders");
const { parseJsonLoose } = require("../srclib/json");

const router = express.Router();

function formatArticles(articles, max = 12) {
  const items = (articles || []).slice(0, max);
  return items
    .map((a, i) => {
      const ts = a?.publishedAt ? new Date(a.publishedAt).toISOString() : "";
      return [
        `#${i + 1}`,
        `title: ${a?.title || ""}`,
        `summary: ${a?.summary || ""}`,
        `source: ${a?.source || ""}`,
        `url: ${a?.url || ""}`,
        `publishedAt: ${ts}`,
        `category: ${a?.category || ""}`
      ].join("\n");
    })
    .join("\n\n");
}

// POST /api/chat/news
// body: { message: string, category?: string, baseline?: string, mode?: "latest"|"compare" }
router.post("/news", async (req, res, next) => {
  try {
    const schema = z.object({
      message: z.string().min(1),
      category: z.string().optional().default("all"),
      baseline: z.string().optional().default(""),
      mode: z.enum(["latest", "compare"]).optional().default("latest")
    });
    const body = schema.parse(req.body);
    const category = normalizeCategory(body.category);

    const merged = await getMergedNews({
      category,
      page: 1,
      pageSize: 12,
      source: "all"
    });
    const latest = merged.items.slice(0, 12);

    const system =
      "You are a news assistant. Use the provided 'LATEST_NEWS' context when answering. " +
      "If asked for sources, include URLs from the context. " +
      "Keep answers concise, structured, and up-to-date. " +
      "If information isn't in the context, say so and suggest what to search for.";

    const context = `LATEST_NEWS (category=${category}):\n\n${formatArticles(latest)}\n`;

    const userMsg =
      body.mode === "compare"
        ? `BASELINE:\n${body.baseline || "(none)"}\n\nREQUEST:\n${body.message}\n\n${context}`
        : `REQUEST:\n${body.message}\n\n${context}`;

    let answer = "";
    let provider = "fallback";

    try {
      answer = await aiChat({
        system,
        messages: [{ role: "user", content: userMsg }],
        temperature: 0.2
      });
      provider = getProvider();
    } catch {
      answer = buildFallbackChatAnswer({
        message: body.message,
        baseline: body.baseline,
        latest,
        mode: body.mode
      });
    }

    res.json({
      category,
      provider,
      used: latest.map((a) => ({ title: a.title, url: a.url, source: a.source })),
      answer
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/trust-feed?category=
// Returns "likely true" highlights plus caution flags for uncertain claims.
router.get("/trust-feed", async (req, res, next) => {
  try {
    const category = normalizeCategory(req.query.category);
    const merged = await getMergedNews({
      category,
      page: 1,
      pageSize: 12,
      source: "all"
    });
    const latest = merged.items.slice(0, 12);

    if (!latest.length) {
      return res.json({
        category,
        generatedAt: new Date().toISOString(),
        verified: [],
        caution: []
      });
    }

    const system =
      "You are a strict fact-checking assistant for a news app. " +
      "You MUST compare headlines/summaries across available items, identify likely true points, and mark uncertain claims conservatively. " +
      "Respond ONLY in valid JSON with shape: " +
      "{ verified: [{ title, reason, confidence, url }], caution: [{ title, reason, confidence, url }] }. " +
      "confidence must be one of: high, medium, low. Keep arrays short (max 4 each).";

    const context = `LATEST_NEWS (category=${category}):\n\n${formatArticles(latest)}\n`;
    const answer = await aiChat({
      system,
      messages: [
        {
          role: "user",
          content:
            "Create a trusted feed for app-open screen.\n" +
            "Rule: classify as verified only if corroborated by multiple reputable signals in this context.\n\n" +
            context
        }
      ],
      temperature: 0.1
    });

    const parsed = parseJsonLoose(answer);
    let provider = getProvider();
    let verified = Array.isArray(parsed?.verified) ? parsed.verified.slice(0, 4) : [];
    let caution = Array.isArray(parsed?.caution) ? parsed.caution.slice(0, 4) : [];

    if (!verified.length && !caution.length) {
      const fallback = buildFallbackTrustFeed(latest);
      verified = fallback.verified;
      caution = fallback.caution;
      provider = "fallback";
    }

    res.json({
      category,
      provider,
      generatedAt: new Date().toISOString(),
      verified,
      caution
    });
  } catch (err) {
    try {
      const category = normalizeCategory(req.query.category);
      const merged = await getMergedNews({
        category,
        page: 1,
        pageSize: 12,
        source: "all"
      });
      const fallback = buildFallbackTrustFeed(merged.items.slice(0, 12));
      res.json({
        category,
        provider: "fallback",
        generatedAt: new Date().toISOString(),
        verified: fallback.verified,
        caution: fallback.caution
      });
    } catch (fallbackErr) {
      next(fallbackErr);
    }
  }
});

module.exports = router;

