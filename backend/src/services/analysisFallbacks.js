const { groupByStoryKey, topKeywordsFromArticles } = require("../srclib/storyCluster");

function sortArticles(articles) {
  return [...(articles || [])].sort(
    (a, b) => new Date(b?.publishedAt || 0).getTime() - new Date(a?.publishedAt || 0).getTime()
  );
}

function uniqueSources(articles) {
  return Array.from(
    new Set(
      (articles || [])
        .map((article) => String(article?.source || "").trim())
        .filter(Boolean)
    )
  );
}

function formatTimeRange(articles) {
  const sorted = sortArticles(articles);
  if (!sorted.length) return "";

  const newest = sorted[0]?.publishedAt ? new Date(sorted[0].publishedAt) : null;
  const oldest = sorted[sorted.length - 1]?.publishedAt
    ? new Date(sorted[sorted.length - 1].publishedAt)
    : null;

  if (!newest || Number.isNaN(newest.getTime())) return "";
  if (!oldest || Number.isNaN(oldest.getTime())) return newest.toLocaleString();

  return `${oldest.toLocaleString()} to ${newest.toLocaleString()}`;
}

/**
 * Score an article for relevance to the user's question.
 * Returns a numeric score — higher means more relevant.
 */
function scoreRelevance(article, queryWords) {
  const text = `${article?.title || ""} ${article?.summary || ""}`.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    if (word.length < 3) continue;
    if (text.includes(word)) score += 2;
    // Bonus for title match
    if ((article?.title || "").toLowerCase().includes(word)) score += 1;
  }
  return score;
}

/**
 * Extract meaningful words from the query for keyword matching.
 */
function queryKeywords(message) {
  const STOP_WORDS = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "what", "which", "who", "whom", "whose", "when", "where",
    "why", "how", "and", "but", "or", "nor", "for", "yet", "so",
    "in", "on", "at", "to", "for", "of", "with", "by", "from",
    "about", "as", "into", "through", "during", "before", "after",
    "above", "below", "between", "each", "than", "news", "latest",
    "today", "tell", "give", "me", "us", "any", "all", "this", "that",
    "these", "those", "my", "your", "his", "her", "its", "our", "their"
  ]);
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Smart fallback chat answer — uses keyword matching to find relevant
 * articles and constructs a coherent natural-language answer.
 */
function buildFallbackChatAnswer({ message, baseline, latest, mode }) {
  const articles = sortArticles(latest);
  if (!articles.length) {
    return "No recent articles are available yet. Add news from the admin panel or configure a news provider key in backend/.env.";
  }

  const queryWords = queryKeywords(message || "");

  // Find articles relevant to the question
  const scored = articles
    .map((article) => ({ article, score: scoreRelevance(article, queryWords) }))
    .sort((a, b) => b.score - a.score);

  const relevant = scored.filter((item) => item.score > 0).map((item) => item.article);
  const topArticles = relevant.length >= 2 ? relevant.slice(0, 5) : articles.slice(0, 5);

  const sources = uniqueSources(topArticles);
  const keywords = topKeywordsFromArticles(topArticles, 4);

  const lines = [];

  // Direct answer section
  if (relevant.length > 0) {
    lines.push(`📰 Here's what the latest news says about "${message}":`);
    lines.push("");

    for (const [index, article] of topArticles.slice(0, 4).entries()) {
      const source = article?.source || "Unknown source";
      const summary = article?.summary
        ? article.summary.slice(0, 160) + (article.summary.length > 160 ? "..." : "")
        : "";
      lines.push(`${index + 1}. **${article?.title || "Untitled"}**`);
      lines.push(`   Source: ${source}`);
      if (summary) lines.push(`   ${summary}`);
      if (article?.url) lines.push(`   🔗 ${article.url}`);
      lines.push("");
    }

    if (sources.length > 1) {
      lines.push(`📊 Coverage from ${sources.length} sources: ${sources.slice(0, 4).join(", ")}.`);
    }
    if (keywords.length) {
      lines.push(`🔑 Key themes: ${keywords.join(", ")}.`);
    }
  } else {
    // No relevant articles found — show recent headlines
    lines.push(`ℹ️ No articles directly matching "${message}" found in the current feed.`);
    lines.push("");
    lines.push("📰 Here are the latest available headlines:");
    lines.push("");

    for (const [index, article] of articles.slice(0, 5).entries()) {
      const source = article?.source || "Unknown source";
      lines.push(`${index + 1}. ${article?.title || "Untitled"} (${source})`);
      if (article?.url) lines.push(`   🔗 ${article.url}`);
    }

    const topKeywords = topKeywordsFromArticles(articles.slice(0, 8), 5);
    if (topKeywords.length) {
      lines.push("");
      lines.push(`💡 Trending topics right now: ${topKeywords.join(", ")}.`);
    }
  }

  if (mode === "compare" && baseline) {
    lines.push("");
    lines.push(`📌 Baseline: "${baseline}"`);
    lines.push("Compare this against the articles above to spot overlapping or diverging coverage.");
  }

  lines.push("");
  lines.push("⚡ Tip: Try being more specific — e.g. ask about a country, person, or event.");

  return lines.join("\n");
}

function buildFallbackTrustFeed(latest) {
  const sorted = sortArticles(latest);
  const grouped = Object.entries(groupByStoryKey(sorted)).sort(
    (a, b) => b[1].length - a[1].length
  );

  const verified = grouped
    .filter(([, articles]) => articles.length >= 2)
    .slice(0, 4)
    .map(([, articles]) => {
      const first = sortArticles(articles)[0];
      const sources = uniqueSources(articles);
      return {
        title: first?.title || "Untitled",
        reason: `${articles.length} items in the current feed point to the same story across ${Math.max(
          1,
          sources.length
        )} source(s).`,
        confidence: articles.length >= 3 ? "high" : "medium",
        url: first?.url || ""
      };
    });

  const caution = grouped
    .filter(([, articles]) => articles.length === 1)
    .flatMap(([, articles]) => articles)
    .slice(0, 4)
    .map((article) => ({
      title: article?.title || "Untitled",
      reason: "Only one matching article is available in the current feed, so this claim is not yet cross-checked here.",
      confidence: "low",
      url: article?.url || ""
    }));

  return { verified, caution };
}

function buildFallbackStoryAnalysis(articles) {
  const sorted = sortArticles(articles).slice(0, 15);
  const sources = uniqueSources(sorted);
  const keywords = topKeywordsFromArticles(sorted, 6);
  const uniqueTitles = new Set(
    sorted.map((article) => String(article?.title || "").trim()).filter(Boolean)
  );
  const leadTitle = sorted[0]?.title || "this story";

  const agreements = [];
  const disagreements = [];

  if (sources.length > 1) {
    agreements.push(
      `This cluster includes ${sorted.length} articles from ${sources.length} sources: ${sources.join(", ")}.`
    );
  }
  if (keywords.length) {
    agreements.push(`Shared themes across the headlines and summaries include ${keywords.join(", ")}.`);
  }

  const timeRange = formatTimeRange(sorted);
  if (timeRange) {
    agreements.push(`Coverage in this cluster spans ${timeRange}.`);
  }

  if (sources.length < 2) {
    disagreements.push(
      "Only one source is available here, so the story cannot be cross-checked inside this app yet."
    );
  } else {
    disagreements.push(
      "Different outlets may emphasize different angles, timelines, or named actors, so read the linked reports before treating every detail as settled."
    );
  }

  if (uniqueTitles.size > 1) {
    disagreements.push(
      "Headlines are not identical across publishers, which suggests framing differences even when the core event overlaps."
    );
  }

  const overview =
    sources.length > 1
      ? `This cluster groups ${sorted.length} articles from ${sources.length} sources about "${leadTitle}". Repeated themes include ${keywords.join(", ") || "the same core event"}.`
      : `Only one article is currently available for "${leadTitle}", so this comparison is limited.`;

  const citations = sorted.slice(0, 6).map((article) => ({
    url: article?.url || "",
    title: article?.title || "",
    source: article?.source || "",
    note: article?.summary || ""
  }));

  return { overview, agreements, disagreements, citations };
}

module.exports = {
  buildFallbackChatAnswer,
  buildFallbackStoryAnalysis,
  buildFallbackTrustFeed
};
