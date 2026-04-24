import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { addToVerify, isInVerifyQueue, getVerifiedArticles } from "../services/verifyStore";
import { getBiasForSource } from "../services/biasData";

function toIso(value) {
  try { return new Date(value).toISOString(); } catch { return ""; }
}

function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (["www.youtube.com", "youtube.com", "m.youtube.com"].includes(parsed.hostname)) {
      return parsed.searchParams.get("v") || null;
    }
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
  } catch { /* not a valid URL */ }
  return null;
}

function timeSince(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch { return ""; }
}

/** Get a 2-sentence quick summary from an article's summary text */
function getQuickSummary(summary) {
  if (!summary) return "No summary available.";
  const sentences = summary.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length <= 2) return summary;
  return sentences.slice(0, 3).join(" ").trim();
}

/* ── Icons ─────────────────────────────────────────────────────────── */
const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
);
const SavedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
);
const RemoveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const VerifyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const VerifiedCheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" fill="none" stroke="#fff" strokeWidth="2.5" />
  </svg>
);
const SummaryIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

/* ── Bias Badge ─────────────────────────────────────────────────────── */
function BiasBadge({ source }) {
  const bias = useMemo(() => getBiasForSource(source), [source]);
  if (!bias) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border"
      style={{
        color: bias.color,
        borderColor: bias.color + "40",
        background: bias.color + "15"
      }}
      title={`Media bias: ${bias.label}`}
    >
      ⚖️ {bias.label}
    </span>
  );
}

/* ── Verified Status Badge ──────────────────────────────────────────── */
function VerifiedBadge({ url }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!url) return;
    const articles = getVerifiedArticles();
    const found = articles.find((a) => a.url === url);
    if (found && found.status !== "pending") setStatus(found.status);
  }, [url]);

  if (!status) return null;

  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
        ✅ Verified
      </span>
    );
  }
  if (status === "caution" || status === "misleading" || status === "fake") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/30">
        ⚠️ Misleading
      </span>
    );
  }
  return null;
}

/* ── Main NewsCard Component ────────────────────────────────────────── */
export default function NewsCard({
  item,
  initiallySaved = false,
  allowSave = true,
  onSavedChange
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(Boolean(initiallySaved));
  const [err, setErr] = useState("");
  const [playingVideo, setPlayingVideo] = useState(false);
  const [shareToast, setShareToast] = useState("");
  const [imgError, setImgError] = useState(false);
  const [inVerifyQueue, setInVerifyQueue] = useState(false);
  const [verifyToast, setVerifyToast] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => { setSaved(Boolean(initiallySaved)); }, [initiallySaved, item?._id, item?.url]);

  useEffect(() => {
    if (item?.url) setInVerifyQueue(isInVerifyQueue(item.url));
  }, [item?.url]);

  const timeAgo = useMemo(() => timeSince(item?.publishedAt), [item?.publishedAt]);
  const youtubeId = useMemo(() => extractYouTubeId(item?.url), [item?.url]);
  const quickSummary = useMemo(() => getQuickSummary(item?.summary), [item?.summary]);
  const canUnsave = saved && Boolean(item?._id);
  const sourceName = item?.source || item?.provider || "";

  async function handleSaveToggle() {
    if (!user || busy) return;
    setBusy(true);
    setErr("");
    try {
      if (canUnsave) {
        await api.post("/saved/unsave", { newsId: item._id });
        setSaved(false);
        onSavedChange?.(false, item);
        return;
      }
      await api.post("/saved/save", {
        article: {
          title: item.title,
          summary: item.summary,
          image: item.image || "",
          category: item.category || "all",
          source: item.source || "",
          url: item.url,
          publishedAt: toIso(item.publishedAt)
        }
      });
      setSaved(true);
      onSavedChange?.(true, item);
    } catch (e) {
      const msg = e?.response?.data?.error || "Could not update saved articles.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  function handleVerify() {
    if (inVerifyQueue) return;
    const added = addToVerify(item);
    if (added) {
      setInVerifyQueue(true);
      setVerifyToast("Sent for AI verification!");
      setTimeout(() => setVerifyToast(""), 2500);
    } else {
      setVerifyToast("Already in verification queue");
      setTimeout(() => setVerifyToast(""), 2000);
    }
  }

  async function handleShare() {
    const shareData = { title: item.title, text: item.summary || item.title, url: item.url };
    try {
      if (navigator.share) { await navigator.share(shareData); return; }
    } catch (e) {
      if (e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(item.url);
      setShareToast("Link copied!");
      setTimeout(() => setShareToast(""), 2000);
    } catch {
      setShareToast("Copy failed");
      setTimeout(() => setShareToast(""), 2000);
    }
  }

  return (
    <article className="news-card group">
      {/* ── Media section ── */}
      {youtubeId ? (
        <div className="news-card-media">
          {playingVideo ? (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
              title={item.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="news-card-video-iframe"
            />
          ) : (
            <button type="button" className="news-card-video-thumb" onClick={() => setPlayingVideo(true)}>
              <img
                src={item.image || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                referrerPolicy="no-referrer"
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <span className="news-card-img-badge" data-cat={item.category?.toLowerCase?.()}>
                {item.category?.toUpperCase?.() || "ALL"}
              </span>
              <div className="news-card-play-overlay">
                <div className="news-card-play-btn">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
            </button>
          )}
        </div>
      ) : item.image && !imgError ? (
        <div className="news-card-media">
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
          <span className="news-card-img-badge" data-cat={item.category?.toLowerCase?.()}>
            {item.category?.toUpperCase?.() || "ALL"}
          </span>
          <span className="news-card-read-time">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            3 min
          </span>
        </div>
      ) : null}

      {/* ── Content ── */}
      <div className="news-card-body">
        {/* Bias + Verified badges row */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <BiasBadge source={sourceName} />
          <VerifiedBadge url={item?.url} />
        </div>

        {/* Title */}
        <h2 className="news-card-title">{item.title}</h2>

        {/* Summary */}
        <p className="news-card-summary">{item.summary}</p>

        {/* ── AI Summary Panel ── */}
        {showSummary && (
          <div className="mb-3 rounded-xl border border-indigo-200/60 bg-indigo-50/80 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10 animate-slide-down">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              <SummaryIcon /> AI Quick Summary
            </div>
            <p className="text-sm leading-relaxed text-indigo-900 dark:text-indigo-200">
              {quickSummary}
            </p>
            <div className="mt-2 text-[10px] text-indigo-500 dark:text-indigo-400 italic">
              ⚡ Summarized from article content
            </div>
          </div>
        )}

        {/* Bottom: source info + actions */}
        <div className="news-card-actions">
          <div className="news-card-source">
            <div className="news-card-avatar" data-cat={item.category?.toLowerCase?.()}>
              {(sourceName || "N")?.charAt(0)?.toUpperCase()}
            </div>
            <div className="news-card-source-info">
              <span className="news-card-source-name">{sourceName || "News"}</span>
              {timeAgo && <span className="news-card-time">{timeAgo}</span>}
            </div>
          </div>

          <div className="news-card-buttons">
            {/* Summary toggle */}
            <button
              type="button"
              onClick={() => setShowSummary((s) => !s)}
              className={clsx(
                "news-card-action-btn",
                showSummary && "!bg-indigo-100 !text-indigo-700 dark:!bg-indigo-500/20 dark:!text-indigo-300"
              )}
              title="Quick AI Summary"
            >
              <SummaryIcon />
            </button>

            {/* Verify button */}
            <button
              type="button"
              onClick={handleVerify}
              disabled={inVerifyQueue}
              className={clsx("news-card-action-btn", inVerifyQueue && "news-card-action-btn--verified")}
              title={inVerifyQueue ? "In verification queue" : "Verify with AI"}
            >
              {inVerifyQueue ? <VerifiedCheckIcon /> : <VerifyIcon />}
            </button>

            {/* Share button */}
            <button type="button" onClick={handleShare} className="news-card-action-btn" title="Share article">
              <ShareIcon />
            </button>

            {/* Save/Unsave button */}
            {user && allowSave && (
              <button
                type="button"
                onClick={handleSaveToggle}
                disabled={busy || (saved && !canUnsave)}
                className={clsx("news-card-action-btn", saved && "news-card-action-btn--saved")}
                title={saved ? (canUnsave ? "Remove from saved" : "Saved") : "Save article"}
              >
                {busy ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : saved ? (
                  canUnsave ? <RemoveIcon /> : <SavedIcon />
                ) : (
                  <SaveIcon />
                )}
              </button>
            )}

            {/* Read button */}
            <a href={item.url} target="_blank" rel="noreferrer" className="news-card-read-btn">
              Read →
            </a>
          </div>
        </div>

        {/* Verify toast */}
        {verifyToast && (
          <div className="news-card-verify-toast animate-slide-up">🛡️ {verifyToast}</div>
        )}

        {/* Share toast */}
        {shareToast && (
          <div className="news-card-share-toast animate-slide-up">{shareToast}</div>
        )}

        {/* Error (only non-sensitive) */}
        {err && (
          <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        )}
      </div>
    </article>
  );
}
