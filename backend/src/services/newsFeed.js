const mongoose = require("mongoose");
const News = require("../models/News");
const { fetchExternalNews, normalizeCategory } = require("./newsProviders");

const ARTICLE_PROJECTION = {
  _id: 1,
  title: 1,
  summary: 1,
  image: 1,
  category: 1,
  source: 1,
  url: 1,
  publishedAt: 1,
  provider: 1
};

function sortByPublishedDesc(a, b) {
  const left = new Date(a?.publishedAt || 0).getTime();
  const right = new Date(b?.publishedAt || 0).getTime();
  return right - left;
}

/**
 * Normalize a title into a set of meaningful lowercase words
 * for fuzzy similarity comparison.
 */
function titleWords(title) {
  if (!title) return new Set();
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\u0900-\u097F\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/**
 * Compute Jaccard similarity between two word sets.
 * Returns 0..1 where 1 = identical.
 */
function titleSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Pick the "better" article of two: prefer the one with an image,
 * longer summary, and more recent publish date.
 */
function pickBetter(a, b) {
  const scoreA =
    (a.image ? 2 : 0) + (a.summary?.length || 0) / 100;
  const scoreB =
    (b.image ? 2 : 0) + (b.summary?.length || 0) / 100;
  return scoreB > scoreA ? b : a;
}

/**
 * Merge articles from multiple provider lists, deduplicating by:
 * 1. Exact URL match
 * 2. Title similarity (>55% word overlap → same story, keep best version)
 * This replaces the need for a separate Compare page — comparison
 * happens automatically.
 */
function mergeUniqueArticles(lists) {
  const urlMap = new Map();
  const all = [];

  // First pass: dedup by URL
  for (const list of lists || []) {
    for (const article of list || []) {
      if (!article?.url) continue;
      if (urlMap.has(article.url)) continue;
      urlMap.set(article.url, true);
      all.push(article);
    }
  }

  // Second pass: dedup by title similarity
  const results = [];
  const used = new Set();

  for (let i = 0; i < all.length; i++) {
    if (used.has(i)) continue;

    let best = all[i];
    const wordsI = titleWords(best.title);

    for (let j = i + 1; j < all.length; j++) {
      if (used.has(j)) continue;

      const wordsJ = titleWords(all[j].title);
      if (titleSimilarity(wordsI, wordsJ) > 0.55) {
        best = pickBetter(best, all[j]);
        used.add(j);
      }
    }

    results.push(best);
  }

  return results.sort(sortByPublishedDesc);
}

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

async function fetchDbNews({ category = "all", skip = 0, limit = 20 }) {
  if (!isDbConnected()) return [];

  try {
    const filter = category === "all" ? {} : { category };
    return await News.find(filter, ARTICLE_PROJECTION)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  } catch {
    return [];
  }
}

async function safeFetchExternalNews({ category = "all", page = 1, pageSize = 20, lang = "en" }) {
  try {
    return await fetchExternalNews({ category, page, pageSize, lang });
  } catch {
    return [];
  }
}

async function getMergedNews({
  category = "all",
  page = 1,
  pageSize = 20,
  skip = 0,
  source = "all",
  lang = "en"
}) {
  const normalizedCategory = normalizeCategory(category);
  const normalizedSource = String(source || "all").toLowerCase();
  const wantExternal = normalizedSource === "external" || normalizedSource === "all";
  const wantDb = normalizedSource === "db" || normalizedSource === "all";

  const [db, external] = await Promise.all([
    wantDb ? fetchDbNews({ category: normalizedCategory, skip, limit: pageSize }) : [],
    wantExternal
      ? safeFetchExternalNews({ category: normalizedCategory, page, pageSize, lang })
      : []
  ]);

  return {
    category: normalizedCategory,
    db,
    external,
    items: mergeUniqueArticles([db, external])
  };
}

module.exports = {
  ARTICLE_PROJECTION,
  fetchDbNews,
  getMergedNews,
  isDbConnected,
  mergeUniqueArticles,
  safeFetchExternalNews,
  sortByPublishedDesc
};
