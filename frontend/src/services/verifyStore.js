/**
 * Local verification store — manages articles the user wants to verify.
 * Uses localStorage so it persists across sessions without requiring auth.
 */

const VERIFY_KEY = "newsflow_verified_articles";

/** Get all articles pending / completed verification */
export function getVerifiedArticles() {
  try {
    return JSON.parse(localStorage.getItem(VERIFY_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Add an article to the verification queue */
export function addToVerify(article) {
  const existing = getVerifiedArticles();
  // Prevent duplicates by URL
  if (existing.some((a) => a.url === article.url)) return false;

  existing.unshift({
    title: article.title || "",
    summary: article.summary || "",
    image: article.image || "",
    category: article.category || "all",
    source: article.source || article.provider || "",
    url: article.url,
    publishedAt: article.publishedAt || "",
    verifiedAt: new Date().toISOString(),
    status: "pending" // pending | verified | caution
  });

  localStorage.setItem(VERIFY_KEY, JSON.stringify(existing));
  return true;
}

/** Check if an article is already in the verify queue */
export function isInVerifyQueue(url) {
  return getVerifiedArticles().some((a) => a.url === url);
}

/** Update the status of an article after AI analysis */
export function updateVerifyStatus(url, status, reason, confidence) {
  const articles = getVerifiedArticles();
  const idx = articles.findIndex((a) => a.url === url);
  if (idx === -1) return;

  articles[idx].status = status;
  articles[idx].reason = reason || "";
  articles[idx].confidence = confidence || "medium";
  articles[idx].analyzedAt = new Date().toISOString();
  localStorage.setItem(VERIFY_KEY, JSON.stringify(articles));
}

/** Remove an article from the verification list */
export function removeFromVerified(url) {
  const articles = getVerifiedArticles().filter((a) => a.url !== url);
  localStorage.setItem(VERIFY_KEY, JSON.stringify(articles));
}

/** Clear all verified articles */
export function clearAllVerified() {
  localStorage.removeItem(VERIFY_KEY);
}

/** Count of articles in the verify queue */
export function getVerifyCount() {
  return getVerifiedArticles().length;
}
