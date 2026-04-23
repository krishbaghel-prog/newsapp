const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "be",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "after",
  "before",
  "over",
  "into",
  "about",
  "than",
  "then",
  "also",
  "not",
  "no",
  "yes",
  "how",
  "what",
  "when",
  "where",
  "why",
  "who",
  "which",
  "latest",
  "breaking",
  "news",
  "report",
  "reports",
  "says",
  "say"
]);

function tokenize(text) {
  return String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}

function storyKey(title) {
  const signature = tokenize(title)
    .filter((word) => !STOP_WORDS.has(word) && word.length > 1)
    .slice(0, 8);

  return signature.join("_") || "misc";
}

function groupByStoryKey(items) {
  return (items || []).reduce((acc, item) => {
    const key = storyKey(item?.title || "");
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function topKeywordsFromArticles(articles, limit = 6) {
  const counts = new Map();

  for (const article of articles || []) {
    const seen = new Set();
    const text = `${article?.title || ""} ${article?.summary || ""}`.trim();

    for (const token of tokenize(text)) {
      if (STOP_WORDS.has(token) || token.length < 3 || seen.has(token)) continue;
      seen.add(token);
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

module.exports = {
  groupByStoryKey,
  storyKey,
  topKeywordsFromArticles
};
