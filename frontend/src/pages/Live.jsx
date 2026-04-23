import React, { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import { api } from "../services/api";

export default function Live() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setBusy(true);
      setErr("");

      try {
        const response = await api.get("/live", { params: { page: 1, limit: 60 } });
        if (!cancelled) setItems(response.data?.items || []);
      } catch (e) {
        if (!cancelled) {
          setErr(e?.response?.data?.error || "Failed to load live updates.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    run();
    const timer = setInterval(run, 20000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="pb-24">
      <TopBar
        title="Live Feed"
        right={
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <span className="status-dot live !bg-red-500" />
            LIVE
          </span>
        }
      />

      <main className="page-container py-4">
        {err ? (
          <div className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-500/10 dark:bg-red-500/5 dark:text-red-200">
            {err}
          </div>
        ) : null}

        <div className="relative space-y-0">
          {/* Timeline line */}
          {items.length > 0 ? (
            <div className="absolute left-5 top-3 bottom-3 w-px bg-gradient-to-b from-brand-500/40 via-brand-500/20 to-transparent dark:from-brand-400/30 dark:via-brand-400/10" />
          ) : null}

          {items.map((item, index) => {
            const date = item.timestamp ? new Date(item.timestamp) : null;
            const label = date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "";

            return (
              <div
                key={item._id || `${item.content}_${item.timestamp}`}
                className="relative flex gap-4 py-3 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Timeline dot */}
                <div className="relative z-10 mt-1.5 flex h-10 w-10 shrink-0 items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-brand-500 shadow-glow dark:bg-brand-400" />
                </div>

                <div className="glass-card flex-1 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                    {label}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                    {item.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!busy && !err && items.length === 0 ? (
          <div className="py-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 text-5xl">📡</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No live updates yet. Add one from the admin panel to start the timeline.
            </div>
          </div>
        ) : null}

        {busy ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading updates...</span>
          </div>
        ) : null}
      </main>
    </div>
  );
}
