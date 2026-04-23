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

// POST /api/chat/verify-articles
// body: { articles: [{ title, summary, source, url, publishedAt, category }] }
// Returns per-article verification results.
router.post("/verify-articles", async (req, res, next) => {
  try {
    const schema = z.object({
      articles: z.array(z.object({
        title: z.string().optional().default(""),
        summary: z.string().optional().default(""),
        source: z.string().optional().default(""),
        url: z.string().optional().default(""),
        publishedAt: z.string().optional().default(""),
        category: z.string().optional().default("")
      })).min(1).max(20)
    });
    const body = schema.parse(req.body);
    const userArticles = body.articles;

    const system =
      "You are a strict fact-checking assistant. " +
      "Analyze each article for credibility based on the headline, summary, and source. " +
      "Compare across the provided set for corroboration. " +
      "Respond ONLY in valid JSON with shape: " +
      "{ results: [{ url, status, reason, confidence }] }. " +
      "status must be one of: verified, caution. " +
      "confidence must be one of: high, medium, low. " +
      "Provide a brief reason for each classification.";

    const context = `ARTICLES TO VERIFY:\n\n${formatArticles(userArticles)}`;

    let results = [];
    let provider = "fallback";

    try {
      const answer = await aiChat({
        system,
        messages: [
          {
            role: "user",
            content:
              "Verify each of these articles for credibility.\n" +
              "Classify as 'verified' if it appears credible from a reputable source.\n" +
              "Classify as 'caution' if the claim is uncertain or from an unreliable source.\n\n" +
              context
          }
        ],
        temperature: 0.1
      });

      const parsed = parseJsonLoose(answer);
      provider = getProvider();

      if (Array.isArray(parsed?.results)) {
        results = parsed.results;
      }
    } catch {
      // AI unavailable — use heuristic fallback
      provider = "fallback";
    }

    // If AI returned no results, apply heuristic fallback
    if (results.length === 0) {
      // Clickbait / suspicious patterns
      const suspiciousPatterns = [
        /you won't believe/i, /shocking/i, /this one trick/i,
        /doctors hate/i, /make money fast/i, /click here/i,
        /\$\$\$/i, /free iphone/i, /act now/i
      ];

      results = userArticles.map((article) => {
        const title = (article.title || "").trim();
        const summary = (article.summary || "").trim();
        const source = (article.source || "").trim();
        const url = (article.url || "").trim();

        // Check for red flags
        const hasTitle = title.length > 10;
        const hasSummary = summary.length > 20;
        const hasSource = source.length > 0;
        const hasUrl = url.startsWith("http");
        const isClickbait = suspiciousPatterns.some((p) => p.test(title) || p.test(summary));
        const titleAllCaps = title === title.toUpperCase() && title.length > 20;

        // Score-based: real articles score high
        let score = 0;
        if (hasTitle) score += 2;
        if (hasSummary) score += 2;
        if (hasSource) score += 2;
        if (hasUrl) score += 1;
        if (summary.length > 80) score += 1;   // detailed summary
        if (title.length > 25) score += 1;      // descriptive headline
        if (isClickbait) score -= 4;
        if (titleAllCaps) score -= 2;
        if (!hasSource) score -= 2;

        const isVerified = score >= 4;

        return {
          url: article.url,
          status: isVerified ? "verified" : "caution",
          reason: isVerified
            ? `Article from ${source || "news outlet"} has a detailed headline and summary consistent with legitimate reporting.`
            : isClickbait
              ? "Headline contains patterns commonly associated with clickbait or misleading content."
              : `Limited information available for full verification. ${!hasSource ? "No source attribution found." : ""} ${!hasSummary ? "Summary is too brief for analysis." : ""}`.trim(),
          confidence: isVerified ? (hasSummary && summary.length > 80 ? "high" : "medium") : "low"
        };
      });
    }

    res.json({ provider, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

