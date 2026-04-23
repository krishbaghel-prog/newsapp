import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { addToVerify, isInVerifyQueue } from "../services/verifyStore";

function toIso(value) {
  try {
    return new Date(value).toISOString();
  } catch {
    return "";
  }
}

/**
 * Extract a YouTube video ID from common URL patterns.
 * Returns null if the URL is not a YouTube link.
 */
function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com" ||
      parsed.hostname === "m.youtube.com"
    ) {
      return parsed.searchParams.get("v") || null;
    }
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
  } catch {
    // not a valid URL
  }
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
  } catch {
    return "";
  }
}

/** SVG icons used in the card */
const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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

  useEffect(() => {
    setSaved(Boolean(initiallySaved));
  }, [initiallySaved, item?._id, item?.url]);

  // Check if already in verify queue
  useEffect(() => {
    if (item?.url) {
      setInVerifyQueue(isInVerifyQueue(item.url));
    }
  }, [item?.url]);

  const timeAgo = useMemo(() => timeSince(item?.publishedAt), [item?.publishedAt]);
  const youtubeId = useMemo(() => extractYouTubeId(item?.url), [item?.url]);

  const canUnsave = saved && Boolean(item?._id);

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
      setErr(e?.response?.data?.error || "Could not update saved articles.");
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
    const shareData = {
      title: item.title,
      text: item.summary || item.title,
      url: item.url
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch (e) {
      // User cancelled or share failed — fall through to clipboard
      if (e.name === "AbortError") return;
    }

    // Fallback: copy link to clipboard
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
      {/* Media section — image or embedded video */}
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
            <button
              type="button"
              className="news-card-video-thumb"
              onClick={() => setPlayingVideo(true)}
            >
              <img
                src={item.image || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                referrerPolicy="no-referrer"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              {/* Category badge on image */}
              <span className="news-card-img-badge" data-cat={item.category?.toLowerCase?.()}>
                {item.category?.toUpperCase?.() || "ALL"}
              </span>
              <div className="news-card-play-overlay">
                <div className="news-card-play-btn">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                    <path d="M8 5v14l11-7z" />
                  </svg>
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
          {/* Category badge on image */}
          <span className="news-card-img-badge" data-cat={item.category?.toLowerCase?.()}>
            {item.category?.toUpperCase?.() || "ALL"}
          </span>
          {/* Read time estimate */}
          <span className="news-card-read-time">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            3 min
          </span>
        </div>
      ) : null}

      {/* Content */}
      <div className="news-card-body">
        {/* Title */}
        <h2 className="news-card-title">{item.title}</h2>

        {/* Summary */}
        <p className="news-card-summary">{item.summary}</p>

        {/* Bottom: source info + actions */}
        <div className="news-card-actions">
          <div className="news-card-source">
            {/* Source avatar */}
            <div className="news-card-avatar" data-cat={item.category?.toLowerCase?.()}>
              {(item.source || item.provider || "N")?.charAt(0)?.toUpperCase()}
            </div>
            <div className="news-card-source-info">
              <span className="news-card-source-name">{item.source || item.provider || "News"}</span>
              {timeAgo && <span className="news-card-time">{timeAgo}</span>}
            </div>
          </div>

          <div className="news-card-buttons">
            {/* Verify button */}
            <button
              type="button"
              onClick={handleVerify}
              disabled={inVerifyQueue}
              className={clsx(
                "news-card-action-btn",
                inVerifyQueue && "news-card-action-btn--verified"
              )}
              title={inVerifyQueue ? "In verification queue" : "Verify with AI"}
            >
              {inVerifyQueue ? <VerifiedCheckIcon /> : <VerifyIcon />}
            </button>

            {/* Share button */}
            <button
              type="button"
              onClick={handleShare}
              className="news-card-action-btn"
              title="Share article"
            >
              <ShareIcon />
            </button>

            {/* Save/Unsave button */}
            {user && allowSave && (
              <button
                type="button"
                onClick={handleSaveToggle}
                disabled={busy || (saved && !canUnsave)}
                className={clsx(
                  "news-card-action-btn",
                  saved && "news-card-action-btn--saved"
                )}
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
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="news-card-read-btn"
            >
              Read →
            </a>
          </div>
        </div>

        {/* Verify toast */}
        {verifyToast && (
          <div className="news-card-verify-toast animate-slide-up">
            🛡️ {verifyToast}
          </div>
        )}

        {/* Share toast */}
        {shareToast && (
          <div className="news-card-share-toast animate-slide-up">
            {shareToast}
          </div>
        )}

        {err && (
          <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        )}
      </div>
    </article>
  );
}
