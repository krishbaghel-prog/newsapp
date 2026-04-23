const axios = require("axios");
const NodeCache = require("node-cache");
const { clampWords } = require("../srclib/text");
const { grokSummarize } = require("./grok");

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

const VALID_CATEGORIES = [
  "all", "world", "technology", "business", "politics",
  "sports", "entertainment", "health", "science", "war"
];

function normalizeCategory(category) {
  const c = String(category || "all").toLowerCase();
  if (VALID_CATEGORIES.includes(c)) return c;
  return "all";
}

function newsApiCategory(category) {
  // NewsAPI native categories: business, entertainment, general, health, science, sports, technology
  const direct = { technology: "technology", business: "business", sports: "sports", entertainment: "entertainment", health: "health", science: "science" };
  if (direct[category]) return { category: direct[category] };
  if (category === "world") return { category: "general" };
  if (category === "politics") return { q: "politics OR election OR government OR parliament" };
  if (category === "war") return { q: "war OR conflict OR military" };
  return {};
}

function gnewsCategory(category) {
  // GNews topics: breaking-news, world, nation, business, technology, entertainment, sports, science, health
  const direct = { technology: "technology", business: "business", sports: "sports", entertainment: "entertainment", health: "health", science: "science", world: "world" };
  if (direct[category]) return { topic: direct[category] };
  if (category === "politics") return { q: "politics OR election OR government" };
  if (category === "war") return { q: "war OR conflict OR military" };
  return {};
}

function pickProvider() {
  const providers = [];
  if (process.env.NEWSAPI_KEY) providers.push("newsapi");
  if (process.env.GNEWS_KEY) providers.push("gnews");
  if (process.env.CURRENTS_API_KEY) providers.push("currents");
  if (process.env.MEDIASTACK_KEY) providers.push("mediastack");
  // Inshorts "API" is typically unofficial; we support it without a key.
  providers.push("inshorts");
  return providers;
}

async function summarizeMaybe({ title, text, fallback }) {
  const mode = (process.env.SUMMARY_MODE || "auto").toLowerCase();
  if (mode === "none") return clampWords(fallback || text || "", 50, 70);

  if (mode === "grok" || mode === "auto") {
    try {
      const s = await grokSummarize({ title, text: text || fallback || "" });
      if (s) return s;
    } catch (_e) {
      // fall back below
    }
  }

  return clampWords(fallback || text || "", 50, 70);
}

async function fetchFromNewsApi({ category, page = 1, pageSize = 20, lang = "en" }) {
  const key = `newsapi:${category}:${page}:${pageSize}:${lang}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const apiKey = process.env.NEWSAPI_KEY;
  const baseUrl = "https://newsapi.org/v2/top-headlines";
  const c = normalizeCategory(category);

  const mapped = newsApiCategory(c);
  const params = {
    apiKey,
    language: lang,
    page,
    pageSize,
    ...mapped
  };

  // If no category/q, use general headlines.
  const res = await axios.get(baseUrl, { params, timeout: 15000 });
  const articles = Array.isArray(res.data?.articles) ? res.data.articles : [];

  const out = await Promise.all(
    articles
      .filter((a) => a?.url && a?.title)
      .map(async (a) => {
        const text = a?.content || a?.description || "";
        const summary = await summarizeMaybe({
          title: a.title,
          text,
          fallback: a.description || a.content || ""
        });
        return {
          title: a.title,
          summary,
          image: a.urlToImage || "",
          category: c,
          source: a?.source?.name || "",
          url: a.url,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
          provider: "external"
        };
      })
  );

  cache.set(key, out);
  return out;
}

async function fetchFromGNews({ category, page = 1, pageSize = 20, lang = "en" }) {
  const key = `gnews:${category}:${page}:${pageSize}:${lang}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const apiKey = process.env.GNEWS_KEY;
  const baseUrl = "https://gnews.io/api/v4/top-headlines";
  const c = normalizeCategory(category);

  const mapped = gnewsCategory(c);
  const params = {
    token: apiKey,
    lang: lang,
    max: pageSize,
    page,
    ...mapped
  };

  const res = await axios.get(baseUrl, { params, timeout: 15000 });
  const articles = Array.isArray(res.data?.articles) ? res.data.articles : [];

  const out = await Promise.all(
    articles
      .filter((a) => a?.url && a?.title)
      .map(async (a) => {
        const text = a?.content || a?.description || "";
        const summary = await summarizeMaybe({
          title: a.title,
          text,
          fallback: a.description || a.content || ""
        });
        return {
          title: a.title,
          summary,
          image: a.image || "",
          category: c,
          source: a?.source?.name || "",
          url: a.url,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
          provider: "external"
        };
      })
  );

  cache.set(key, out);
  return out;
}

function inshortsCategory(category) {
  // Inshorts categories: all, national, business, sports, world, politics, technology, startup, entertainment, miscellaneous, hatke, science, automobile
  const direct = { technology: "technology", business: "business", sports: "sports", entertainment: "entertainment", science: "science", politics: "politics", world: "world" };
  if (direct[category]) return direct[category];
  if (category === "health") return "miscellaneous";
  if (category === "war") return "world";
  return "all";
}

async function fetchFromInshorts({ category, pageSize = 20 }) {
  const c = normalizeCategory(category);
  const cat = inshortsCategory(c);
  const key = `inshorts:${cat}:${pageSize}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Public community endpoint (no key). If it changes, swap to your own proxy or RapidAPI.
  const baseUrl = "https://inshortsapi.vercel.app/news";
  const res = await axios.get(baseUrl, { params: { category: cat }, timeout: 15000 });
  const data = Array.isArray(res.data?.data) ? res.data.data : [];

  const out = await Promise.all(
    data
      .filter((a) => a?.readMoreUrl && a?.title)
      .slice(0, pageSize)
      .map(async (a) => {
        const text = a?.content || "";
        const summary = await summarizeMaybe({
          title: a.title,
          text,
          fallback: a.content || ""
        });
        return {
          title: a.title,
          summary,
          image: a.imageUrl || "",
          category: c,
          source: a.author || a.source || "Inshorts",
          url: a.readMoreUrl,
          publishedAt: a.date ? new Date(a.date) : new Date(),
          provider: "external"
        };
      })
  );

  cache.set(key, out);
  return out;
}

async function fetchFromCurrents({ category, pageSize = 20, lang = "en" }) {
  const apiKey = process.env.CURRENTS_API_KEY;
  if (!apiKey) return [];
  const c = normalizeCategory(category);
  const key = `currents:${c}:${pageSize}:${lang}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = {
    apiKey,
    language: lang,
    page_size: Math.max(1, Math.min(50, pageSize))
  };
  // Currents categories: regional, technology, lifestyle, business, general, programming, science, entertainment, world, sports, finance, academia, politics, health, opinion, food, game
  const currentsMap = { technology: "technology", business: "business", sports: "sports", entertainment: "entertainment", health: "health", science: "science", politics: "politics", world: "world" };
  if (currentsMap[c]) params.category = currentsMap[c];
  else if (c === "war") params.keywords = "war OR conflict OR military";

  const res = await axios.get("https://api.currentsapi.services/v1/latest-news", {
    params,
    timeout: 15000
  });
  const news = Array.isArray(res.data?.news) ? res.data.news : [];

  const out = await Promise.all(
    news
      .filter((a) => a?.url && a?.title)
      .slice(0, pageSize)
      .map(async (a) => {
        const text = a?.description || "";
        const summary = await summarizeMaybe({ title: a.title, text, fallback: a.description || "" });
        return {
          title: a.title,
          summary,
          image: a?.image || "",
          category: c,
          source: a?.author || "",
          url: a.url,
          publishedAt: a.published ? new Date(a.published) : new Date(),
          provider: "external"
        };
      })
  );

  cache.set(key, out);
  return out;
}

async function fetchFromMediastack({ category, page = 1, pageSize = 20, lang = "en" }) {
  const access_key = process.env.MEDIASTACK_KEY;
  if (!access_key) return [];
  const c = normalizeCategory(category);
  const key = `mediastack:${c}:${page}:${pageSize}:${lang}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = {
    access_key,
    languages: lang,
    limit: Math.max(1, Math.min(100, pageSize)),
    offset: (Math.max(1, page) - 1) * pageSize
  };
  if (c !== "all") {
    // mediastack categories: general, business, entertainment, health, science, sports, technology
    const msMap = { technology: "technology", business: "business", sports: "sports", entertainment: "entertainment", health: "health", science: "science" };
    if (msMap[c]) params.categories = msMap[c];
    else if (c === "world" || c === "war" || c === "politics") params.categories = "general";
  }

  const res = await axios.get("http://api.mediastack.com/v1/news", { params, timeout: 15000 });
  const data = Array.isArray(res.data?.data) ? res.data.data : [];

  const out = await Promise.all(
    data
      .filter((a) => a?.url && a?.title)
      .map(async (a) => {
        const text = a?.description || "";
        const summary = await summarizeMaybe({ title: a.title, text, fallback: a.description || "" });
        return {
          title: a.title,
          summary,
          image: a?.image || "",
          category: c,
          source: a?.source || "",
          url: a.url,
          publishedAt: a.published_at ? new Date(a.published_at) : new Date(),
          provider: "external"
        };
      })
  );

  cache.set(key, out);
  return out;
}

function googleNewsTopicPath(category) {
  const map = {
    technology: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB",
    business: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB",
    sports: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB",
    entertainment: "CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB",
    health: "CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ",
    science: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB",
    world: "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB"
  };
  return map[category] || null;
}

async function fetchFromGoogleNewsRSS({ category, pageSize = 20, lang = "en" }) {
  const c = normalizeCategory(category);
  const key = `googlenews:${c}:${pageSize}:${lang}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Build Google News RSS URL
  let rssUrl;
  if (c === "all") {
    rssUrl = `https://news.google.com/rss?hl=${lang}&gl=US&ceid=US:${lang}`;
  } else if (c === "war" || c === "politics") {
    const q = c === "war" ? "war+OR+conflict+OR+military" : "politics+OR+election+OR+government";
    rssUrl = `https://news.google.com/rss/search?q=${q}&hl=${lang}&gl=US&ceid=US:${lang}`;
  } else {
    const topicId = googleNewsTopicPath(c);
    if (topicId) {
      rssUrl = `https://news.google.com/rss/topics/${topicId}?hl=${lang}&gl=US&ceid=US:${lang}`;
    } else {
      rssUrl = `https://news.google.com/rss/search?q=${c}&hl=${lang}&gl=US&ceid=US:${lang}`;
    }
  }

  const res = await axios.get(rssUrl, { timeout: 10000, responseType: "text" });
  const xml = res.data || "";

  // Simple XML parsing for RSS items
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < pageSize) {
    const block = match[1];
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/) || [])[1] || 
                  (block.match(/<title>(.*?)<\/title>/) || [])[1] || "";
    const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || "";
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
    const sourceMatch = block.match(/<source[^>]*>(.*?)<\/source>/);
    const source = sourceMatch ? sourceMatch[1] : "Google News";
    const descMatch = block.match(/<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/);
    const description = descMatch ? (descMatch[1] || descMatch[2] || "") : "";

    // Clean HTML from title and description
    const cleanTitle = title.replace(/<[^>]+>/g, "").trim();
    const cleanDesc = description.replace(/<[^>]+>/g, "").trim();

    if (cleanTitle && link) {
      items.push({
        title: cleanTitle,
        summary: clampWords(cleanDesc || cleanTitle, 20, 50),
        image: "",
        category: c,
        source: source.replace(/<[^>]+>/g, "").trim() || "Google News",
        url: link.trim(),
        publishedAt: pubDate ? new Date(pubDate) : new Date(),
        provider: "external"
      });
    }
  }

  cache.set(key, items);
  return items;
}

async function fetchExternalNews({ category, page, pageSize, lang = "en" }) {
  const providers = pickProvider();
  const tasks = providers.map(async (p) => {
    try {
      if (p === "newsapi" && process.env.NEWSAPI_KEY)
        return await fetchFromNewsApi({ category, page, pageSize, lang });
      if (p === "gnews" && process.env.GNEWS_KEY)
        return await fetchFromGNews({ category, page, pageSize, lang });
      if (p === "currents" && process.env.CURRENTS_API_KEY)
        return await fetchFromCurrents({ category, pageSize, lang });
      if (p === "mediastack" && process.env.MEDIASTACK_KEY)
        return await fetchFromMediastack({ category, page, pageSize, lang });
      if (p === "inshorts") return await fetchFromInshorts({ category, pageSize });
      return [];
    } catch (providerErr) {
      console.warn(`[NewsProvider] ${p} failed:`, providerErr?.response?.status || providerErr?.code || providerErr?.message);
      return [];
    }
  });

  const all = (await Promise.all(tasks)).flat();

  // If paid providers returned nothing, fall back to Google News RSS (free, no key needed)
  if (all.length === 0) {
    try {
      console.log("[NewsProvider] All paid providers failed, falling back to Google News RSS");
      const rssArticles = await fetchFromGoogleNewsRSS({ category, pageSize, lang });
      if (rssArticles.length > 0) return rssArticles;
    } catch (rssErr) {
      console.warn("[NewsProvider] Google News RSS fallback also failed:", rssErr?.message);
    }
  }

  // Also supplement with Google News RSS if we got very few results
  if (all.length < 5) {
    try {
      const rssArticles = await fetchFromGoogleNewsRSS({ category, pageSize: 15, lang });
      all.push(...rssArticles);
    } catch {
      // ignore supplementation failures
    }
  }

  if (all.length === 0) {
    const err = new Error(
      "No news provider returned results. Check your API keys or internet connection."
    );
    err.status = 400;
    throw err;
  }
  return all;
}

module.exports = { fetchExternalNews, normalizeCategory };

