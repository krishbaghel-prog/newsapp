import React, { useEffect, useState, useCallback } from "react";
import TopBar from "../components/TopBar";
import { api } from "../services/api";

function VideoModal({ videoId, title, onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="video-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="video-modal-content animate-scale-in">
        <div className="video-modal-header">
          <h3 className="video-modal-title">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="video-modal-close"
            title="Close player"
          >
            ✕
          </button>
        </div>
        <div className="video-modal-player">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="video-iframe"
          />
        </div>
      </div>
    </div>
  );
}

function VideoCard({ item, index, onTheater }) {
  const [inlinePlay, setInlinePlay] = useState(false);

  return (
    <div
      className="video-card group animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="video-card-thumb" onClick={() => !inlinePlay && setInlinePlay(true)}>
        {inlinePlay ? (
          <iframe
            src={`https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0&modestbranding=1`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <>
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
                referrerPolicy="no-referrer"
              />
            ) : null}
            {/* Play overlay — always visible */}
            <div className="video-card-play-overlay video-card-play-overlay--always">
              <div className="video-card-play-btn">
                <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            {/* Duration-like badge */}
            <div className="video-card-badge">
              ▶ Watch
            </div>
          </>
        )}
      </div>
      <div className="p-3.5">
        <div className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-zinc-800 dark:text-zinc-100">
          {item.title}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
            ▶ YouTube
          </span>
          <span className="truncate">{item.channelTitle}</span>
        </div>
        {/* Theater mode button */}
        {inlinePlay && (
          <button
            type="button"
            onClick={() => onTheater(item)}
            className="mt-2.5 w-full rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md"
          >
            🔲 Theater Mode
          </button>
        )}
      </div>
    </div>
  );
}

export default function Videos() {
  const [query, setQuery] = useState("latest news");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [warning, setWarning] = useState("");
  const [activeVideo, setActiveVideo] = useState(null);
  const [nextPageToken, setNextPageToken] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  async function search(nextQuery) {
    setBusy(true);
    setErr("");

    try {
      const response = await api.get("/videos", {
        params: { q: nextQuery, maxResults: 12 }
      });
      setItems(response.data?.items || []);
      setNextPageToken(response.data?.nextPageToken || "");
      setWarning(response.data?.warning || "");
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to load videos.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await api.get("/videos", {
        params: { q: query, maxResults: 12, pageToken: nextPageToken }
      });
      setItems((prev) => [...prev, ...(response.data?.items || [])]);
      setNextPageToken(response.data?.nextPageToken || "");
    } catch (e) {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    search(query);
  }, []);

  const handleCloseModal = useCallback(() => setActiveVideo(null), []);

  const quickSearches = [
    "breaking news today",
    "technology news",
    "sports highlights",
    "world politics",
    "Iran Israel US",
    "business finance"
  ];

  return (
    <div className="pb-24">
      <TopBar title="Video News" />

      <main className="page-container py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="mb-3 flex gap-2"
        >
          <input
            className="w-full rounded-xl border-zinc-200/60 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-brand-400 focus:ring-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:ring-brand-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for news videos..."
          />
          <button
            type="submit"
            className="btn-primary shrink-0"
            disabled={busy}
          >
            🔍 Search
          </button>
        </form>

        {/* Quick search chips */}
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
          {quickSearches.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setQuery(q);
                search(q);
              }}
              className="shrink-0 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all hover:bg-brand-50 hover:text-brand-600 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
            >
              {q}
            </button>
          ))}
        </div>

        {warning ? (
          <div className="mb-4 rounded-2xl border border-amber-200/60 bg-amber-50/80 p-4 text-sm text-amber-800 dark:border-amber-500/10 dark:bg-amber-500/5 dark:text-amber-200">
            ⚠️ {warning}
          </div>
        ) : null}

        {err ? (
          <div className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-500/10 dark:bg-red-500/5 dark:text-red-200">
            {err}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <VideoCard
              key={item.id}
              item={item}
              index={index}
              onTheater={setActiveVideo}
            />
          ))}
        </div>

        {!busy && !err && items.length === 0 ? (
          <div className="py-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 text-5xl">🎬</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No videos found yet. Try a different search query.
            </div>
          </div>
        ) : null}

        {busy ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading videos...</span>
          </div>
        ) : null}

        {!busy && nextPageToken && items.length > 0 ? (
          <div className="mt-8 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn-primary"
            >
              {loadingMore ? "Loading..." : "Load More Videos"}
            </button>
          </div>
        ) : null}
      </main>

      {/* Theater Mode Video Player Modal */}
      {activeVideo ? (
        <VideoModal
          videoId={activeVideo.id}
          title={activeVideo.title}
          onClose={handleCloseModal}
        />
      ) : null}
    </div>
  );
}
