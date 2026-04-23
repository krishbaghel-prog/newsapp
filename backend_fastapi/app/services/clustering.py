import re

_STOP = {
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
}


def story_key(title: str) -> str:
    words = re.findall(r"[a-z0-9]+", (title or "").lower())
    sig = [w for w in words if w not in _STOP and len(w) > 1][:8]
    return "_".join(sig) if sig else "misc"


def group_by_story_key(items: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for it in items:
        key = story_key(it.get("title") or "")
        grouped.setdefault(key, []).append(it)
    return grouped
