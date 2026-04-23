const express = require("express");
const { z } = require("zod");

const { aiChat, getProvider } = require("../services/aiClient");
const { buildFallbackStoryAnalysis } = require("../services/analysisFallbacks");
const { getMergedNews } = require("../services/newsFeed");
const { parseJsonLoose } = require("../srclib/json");
const { groupByStoryKey, storyKey } = require("../srclib/storyCluster");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const category = String(req.query.category || "all");
    const minSize = Math.max(2, Math.min(10, Number(req.query.min_size || 2)));
    const merged = await getMergedNews({
      category,
      page: 1,
      pageSize: 60,
      source: "all"
    });

    const grouped = groupByStoryKey(merged.items);
    const items = Object.entries(grouped)
      .filter(([, articles]) => articles.length >= minSize)
      .map(([key, articles]) => {
        const sorted = [...articles].sort(
          (a, b) =>
            new Date(b?.publishedAt || 0).getTime() - new Date(a?.publishedAt || 0).getTime()
        );

        return {
          story_key: key,
          headline: sorted[0]?.title || key,
          sources_count: sorted.length,
          sources: Array.from(
            new Set(sorted.map((article) => String(article?.source || "").trim()).filter(Boolean))
          ).sort((left, right) => left.localeCompare(right)),
          articles: sorted.slice(0, 12)
        };
      })
      .sort((a, b) => b.sources_count - a.sources_count);

    res.json({
      category: merged.category,
      items
    });
  } catch (err) {
    next(err);
  }
});

router.post("/analyze", async (req, res, next) => {
  try {
    const schema = z.object({
      story_key: z.string().min(1),
      category: z.string().optional().default("all")
    });
    const body = schema.parse(req.body);

    const merged = await getMergedNews({
      category: body.category,
      page: 1,
      pageSize: 60,
      source: "all"
    });
    const grouped = groupByStoryKey(merged.items);
    const articles = grouped[body.story_key];

    if (!articles?.length) {
      return res.status(404).json({
        error: "Story cluster not found for this category. Load some news first and try again."
      });
    }

    const context = [...articles]
      .sort((a, b) => new Date(b?.publishedAt || 0).getTime() - new Date(a?.publishedAt || 0).getTime())
      .slice(0, 15)
      .map((article, index) =>
        [
          `#${index + 1}`,
          `title: ${article?.title || ""}`,
          `summary: ${article?.summary || ""}`,
          `source: ${article?.source || ""}`,
          `url: ${article?.url || ""}`
        ].join("\n")
      )
      .join("\n\n");

    const system =
      "You compare multiple news reports about the same developing story. " +
      "You cannot know absolute truth; infer agreement versus disagreement from the supplied excerpts. " +
      "Respond ONLY with valid JSON using this schema: " +
      '{ "overview": string, "agreements": [string], "disagreements": [string], "citations": [{ "url": string, "title": string, "source": string, "note": string }] }. ' +
      "Keep the output concise and cite only URLs present in the provided context.";

    let raw = "";
    let provider = "fallback";
    let modelJson = buildFallbackStoryAnalysis(articles);

    try {
      raw = await aiChat({
        system,
        messages: [
          {
            role: "user",
            content: `STORY_KEY: ${body.story_key}\n\nARTICLES:\n\n${context}`
          }
        ],
        temperature: 0.2
      });
      provider = getProvider();
      modelJson = parseJsonLoose(raw) || modelJson;
    } catch {
      raw = "";
    }

    res.json({
      story_key: body.story_key,
      provider,
      model_json: modelJson,
      raw,
      articles: articles.slice(0, 15)
    });
  } catch (err) {
    next(err);
  }
});

router.get("/lookup", async (req, res, next) => {
  try {
    const title = String(req.query.title || "").trim();
    const category = String(req.query.category || "all");

    if (title.length < 3) {
      return res.status(400).json({ error: "title must be at least 3 characters" });
    }

    const merged = await getMergedNews({
      category,
      page: 1,
      pageSize: 60,
      source: "all"
    });
    const key = storyKey(title);
    const grouped = groupByStoryKey(merged.items);
    const articles = grouped[key] || [];

    res.json({
      story_key: key,
      found: articles.length > 0,
      articles: articles.slice(0, 20)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
