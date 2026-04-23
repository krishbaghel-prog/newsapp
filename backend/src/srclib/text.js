function countWords(str) {
  return (str || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function clampWords(str, minWords = 50, maxWords = 70) {
  const words = (str || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const target = Math.min(Math.max(words.length, minWords), maxWords);
  const sliced = words.slice(0, target);
  let out = sliced.join(" ");
  if (!/[.!?]$/.test(out)) out += ".";
  return out;
}

module.exports = { countWords, clampWords };

