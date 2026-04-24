/**
 * Source Bias Data — static mapping of news source names to political bias.
 * Based on widely-referenced media bias ratings (AllSides, Ad Fontes Media).
 */

export const BIAS_MAP = {
  // Left
  "msnbc": { label: "Left", color: "#3b82f6" },
  "huffpost": { label: "Left", color: "#3b82f6" },
  "huffington post": { label: "Left", color: "#3b82f6" },
  "slate": { label: "Left", color: "#3b82f6" },
  "mother jones": { label: "Left", color: "#3b82f6" },
  "vox": { label: "Left", color: "#3b82f6" },
  "the nation": { label: "Left", color: "#3b82f6" },
  // Center-Left
  "cnn": { label: "Slight Left", color: "#60a5fa" },
  "new york times": { label: "Slight Left", color: "#60a5fa" },
  "nyt": { label: "Slight Left", color: "#60a5fa" },
  "washington post": { label: "Slight Left", color: "#60a5fa" },
  "the guardian": { label: "Slight Left", color: "#60a5fa" },
  "guardian": { label: "Slight Left", color: "#60a5fa" },
  "nbc": { label: "Slight Left", color: "#60a5fa" },
  "nbc news": { label: "Slight Left", color: "#60a5fa" },
  "abc": { label: "Slight Left", color: "#60a5fa" },
  "abc news": { label: "Slight Left", color: "#60a5fa" },
  "npr": { label: "Slight Left", color: "#60a5fa" },
  "politico": { label: "Slight Left", color: "#60a5fa" },
  "time": { label: "Slight Left", color: "#60a5fa" },
  "the atlantic": { label: "Slight Left", color: "#60a5fa" },
  "bloomberg": { label: "Slight Left", color: "#60a5fa" },
  // Neutral / Center
  "reuters": { label: "Neutral", color: "#10b981" },
  "associated press": { label: "Neutral", color: "#10b981" },
  "ap": { label: "Neutral", color: "#10b981" },
  "ap news": { label: "Neutral", color: "#10b981" },
  "bbc": { label: "Neutral", color: "#10b981" },
  "bbc news": { label: "Neutral", color: "#10b981" },
  "usa today": { label: "Neutral", color: "#10b981" },
  "axios": { label: "Neutral", color: "#10b981" },
  "the hill": { label: "Neutral", color: "#10b981" },
  "pbs": { label: "Neutral", color: "#10b981" },
  "pbs newshour": { label: "Neutral", color: "#10b981" },
  "al jazeera": { label: "Neutral", color: "#10b981" },
  "c-span": { label: "Neutral", color: "#10b981" },
  "business insider": { label: "Neutral", color: "#10b981" },
  "forbes": { label: "Neutral", color: "#10b981" },
  "techcrunch": { label: "Neutral", color: "#10b981" },
  "wired": { label: "Neutral", color: "#10b981" },
  "the verge": { label: "Neutral", color: "#10b981" },
  // Center-Right
  "wall street journal": { label: "Slight Right", color: "#f97316" },
  "wsj": { label: "Slight Right", color: "#f97316" },
  "the economist": { label: "Slight Right", color: "#f97316" },
  "national review": { label: "Slight Right", color: "#f97316" },
  "new york post": { label: "Slight Right", color: "#f97316" },
  "ny post": { label: "Slight Right", color: "#f97316" },
  "the telegraph": { label: "Slight Right", color: "#f97316" },
  "daily mail": { label: "Slight Right", color: "#f97316" },
  "reason": { label: "Slight Right", color: "#f97316" },
  // Right
  "fox news": { label: "Right", color: "#ef4444" },
  "fox": { label: "Right", color: "#ef4444" },
  "breitbart": { label: "Far Right", color: "#dc2626" },
  "newsmax": { label: "Right", color: "#ef4444" },
  "one america news": { label: "Far Right", color: "#dc2626" },
  "oan": { label: "Far Right", color: "#dc2626" },
  "the blaze": { label: "Right", color: "#ef4444" },
  "daily wire": { label: "Right", color: "#ef4444" },
  "the federalist": { label: "Right", color: "#ef4444" },
};

/**
 * Get bias info for a news source.
 * Returns { label, color } or null if unknown.
 */
export function getBiasForSource(sourceName) {
  if (!sourceName) return null;
  const key = String(sourceName).toLowerCase().trim();
  // Exact match first
  if (BIAS_MAP[key]) return BIAS_MAP[key];
  // Partial match (e.g. "CNN International" → "cnn")
  for (const [mapKey, bias] of Object.entries(BIAS_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return bias;
  }
  return null;
}

/** Crisis-mode keywords — filtered when crisis mode is active */
export const CRISIS_KEYWORDS = [
  "earthquake", "tsunami", "hurricane", "tornado", "flood", "flooding",
  "wildfire", "war", "conflict", "attack", "bombing", "explosion",
  "shooting", "terror", "terrorist", "missile", "nuclear", "invasion",
  "troops", "military", "casualties", "death toll", "disaster",
  "emergency", "crisis", "evacuation", "refugees", "famine", "pandemic",
  "outbreak", "epidemic", "cyclone", "volcano", "avalanche",
];

export function matchesCrisis(article) {
  const text = `${article.title || ""} ${article.summary || ""}`.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => text.includes(kw));
}
