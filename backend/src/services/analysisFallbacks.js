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

function buildFallbackChatAnswer({ message, baseline, latest, mode }) {
  const articles = sortArticles(latest).slice(0, 5);
  if (!articles.length) {
    return "No recent articles are available yet. Add news from the admin panel or configure a news provider key in backend/.env.";
  }

  const keywords = topKeywordsFromArticles(articles, 5);
  const lines = [
    "AI analysis is unavailable right now, so this answer is based directly on the latest fetched articles.",
    ""
  ];

  if (mode === "compare" && baseline) {
    lines.push(`Baseline topic: ${baseline}`);
    lines.push("");
  }

  lines.push("Latest headlines:");
  for (const [index, article] of articles.entries()) {
    const source = article?.source || "Unknown source";
    lines.push(`${index + 1}. ${article?.title || "Untitled"} (${source})`);
    if (article?.url) lines.push(`   ${article.url}`);
  }

  if (keywords.length) {
    lines.push("");
    lines.push(`Themes showing up repeatedly: ${keywords.join(", ")}.`);
  }

  if (message) {
    lines.push("");
    lines.push(`Question received: ${message}`);
  }

  lines.push("");
  lines.push(
    mode === "compare" && baseline
      ? "Compare the baseline against the headlines above by checking which people, places, outcomes, or timelines overlap."
      : "Open the linked sources for full details or citations."
  );

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
