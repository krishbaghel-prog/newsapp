function parseIntSafe(v, fallback) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function getPaging(query, { defaultLimit = 20, maxLimit = 50 } = {}) {
  const page = Math.max(1, parseIntSafe(query.page, 1));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseIntSafe(query.limit, defaultLimit))
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

module.exports = { getPaging };

