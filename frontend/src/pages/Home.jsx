import React, { useCallback, useEffect, useRef, useState } from "react";
import CategoryTabs from "../components/CategoryTabs";
import NewsCard from "../components/NewsCard";
import TopBar from "../components/TopBar";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { api } from "../services/api";

/* ── Search Icon SVG ── */
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function useInfiniteLoad({ enabled, onLoadMore }) {
  const ref = useRef(null);
  const cbRef = useRef(onLoadMore);
  cbRef.current = onLoadMore;

  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) cbRef.current?.();
      },
      { rootMargin: "600px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

export default function Home() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [category, setCategory] = useState("all");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [err, setErr] = useState("");
  const [warning, setWarning] = useState("");
  const [lastChecked, setLastChecked] = useState(() => new Date().toISOString());
  const [newCount, setNewCount] = useState(0);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);

  const loadMore = useCallback(() => {
    if (!busy && hasMore) setPage((current) => current + 1);
  }, [busy, hasMore]);

  const sentinelRef = useInfiniteLoad({
    enabled: !busy && hasMore && items.length > 0 && !searchQuery,
    onLoadMore: loadMore
  });

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setErr("");
    setWarning("");
  }, [category, language]);

  useEffect(() => {
    if (searchQuery) return;
    let cancelled = false;

    async function run() {
      setBusy(true);
      setErr("");

      try {
        const response = await api.get("/news", {
          params: { category, page, limit: 20, source: "all", lang: language }
        });
        if (cancelled) return;

        if (page === 1) {
          setWarning(response.data?.warning || "");
        }

        const newItems = response.data?.items || [];
        if (newItems.length < 10) setHasMore(false);

        setItems((current) => {
          const merged = [...current, ...newItems];
          const deduped = new Map();
          for (const article of merged) {
            if (!article?.url) continue;
            if (!deduped.has(article.url)) deduped.set(article.url, article);
          }
          return Array.from(deduped.values());
        });
      } catch (e) {
        if (!cancelled) {
          setErr(e?.response?.data?.error || "Failed to load news.");
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [category, page, language, searchQuery]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await api.get("/news/notify", { params: { since: lastChecked } });
        setNewCount(Number(response.data?.count || 0));
      } catch {
        // Ignore polling failures
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [lastChecked]);

  function handleSearchInput(value) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) { setSearchResults([]); return; }

    searchTimerRef.current = setTimeout(async () => {
      setSearchBusy(true);
      try {
        const response = await api.get("/news/search", {
          params: { q: value.trim(), lang: language, limit: 20 }
        });
        setSearchResults(response.data?.items || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchBusy(false);
      }
    }, 400);
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  const displayItems = searchQuery.trim() ? searchResults : items;

  return (
    <div className="pb-24">
      <TopBar
        title="Top Stories"
        right={
          <div className="flex items-center gap-2">
            {newCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setLastChecked(new Date().toISOString());
                  setNewCount(0);
                  setItems([]);
                  setPage(1);
                  setHasMore(true);
                }}
                className="btn-primary !rounded-full !px-4 !py-1.5 !text-xs"
                title="Refresh to load new admin posts"
              >
                ✨ {newCount} new
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              className="theme-toggle-btn"
              title="Search news"
            >
              <SearchIcon />
            </button>
          </div>
        }
      />

      {searchOpen && (
        <div className="search-bar animate-slide-down">
          <div className="search-bar-inner">
            <span className="search-bar-icon"><SearchIcon /></span>
            <input
              ref={searchRef}
              className="search-input"
              placeholder="Search headlines, topics, sources..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") clearSearch(); }}
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="search-clear">
                <CloseIcon />
              </button>
            )}
            {searchBusy && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            )}
          </div>
          {searchQuery.trim() && (
            <div className="search-results-count">
              {searchBusy ? "Searching..." : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} found`}
            </div>
          )}
        </div>
      )}

      <main className="page-container">
        {!searchQuery && <CategoryTabs value={category} onChange={setCategory} />}

        {!user && !searchQuery ? (
          <div className="glass-card mb-4 p-4 text-sm text-zinc-600 dark:text-zinc-300">
            💡 Sign in to save bookmarks. In demo mode, this works without Google setup.
          </div>
        ) : null}

        {warning && !searchQuery ? (
          <div className="mb-4 rounded-2xl border border-amber-200/60 bg-amber-50/80 p-4 text-sm text-amber-800 backdrop-blur dark:border-amber-500/10 dark:bg-amber-500/5 dark:text-amber-200">
            ⚠️ {warning}
          </div>
        ) : null}

        {err ? (
          <div className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur dark:border-red-500/10 dark:bg-red-500/5 dark:text-red-200">
            {err}
          </div>
        ) : null}

        <div className="news-grid">
          {displayItems.map((item) => (
            <NewsCard key={item.url} item={item} />
          ))}
        </div>

        {!busy && !err && displayItems.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 text-5xl">{searchQuery ? "🔍" : "📰"}</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {searchQuery
                ? `No results found for "${searchQuery}". Try a different search term.`
                : "No stories available yet. Add articles from the admin panel or configure a news provider key."}
            </div>
          </div>
        ) : null}

        {!searchQuery && <div ref={sentinelRef} className="h-10" />}

        {busy ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading stories...</span>
          </div>
        ) : null}
      </main>
    </div>
  );
}
