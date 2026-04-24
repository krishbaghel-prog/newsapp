import React, { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import NewsCard from "../components/NewsCard";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";

export default function Saved() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    let cancelled = false;

    async function run() {
      setBusy(true);
      setErr("");

      try {
        const response = await api.get("/saved");
        if (!cancelled) setItems(response.data?.items || []);
      } catch (e) {
        if (!cancelled) {
          const msg = e?.response?.data?.error || "";
          // Suppress auth-service errors — show generic message only
          const isAuthErr = msg.toLowerCase().includes("auth") ||
            msg.toLowerCase().includes("unavailable") ||
            e?.response?.status === 401 ||
            e?.response?.status === 503;
          if (!isAuthErr) setErr("Could not load saved articles. Please try again.");
          // If auth error — silently show empty state (user sees "no saves yet")
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="pb-24">
      <TopBar title="Saved Articles" />

      <main className="page-container py-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</span>
          </div>
        ) : null}

        {!loading && !user ? (
          <div className="glass-card p-6 text-center animate-fade-in">
            <div className="mx-auto mb-3 text-4xl">🔖</div>
            <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
              Sign in to access your bookmarked articles.
            </div>
            <GoogleSignInButton className="mx-auto max-w-xs" />
          </div>
        ) : null}

        {err ? (
          <div className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-500/10 dark:bg-red-500/5 dark:text-red-200">
            {err}
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((item) => (
            <NewsCard
              key={item._id || item.url}
              item={item}
              initiallySaved
              onSavedChange={(nextSaved, changedItem) => {
                if (!nextSaved) {
                  setItems((current) =>
                    current.filter((entry) => entry._id !== changedItem._id)
                  );
                }
              }}
            />
          ))}
        </div>

        {!busy && user && items.length === 0 ? (
          <div className="py-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 text-5xl">📚</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No saved articles yet. Tap "Save" on any news card to bookmark it.
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
