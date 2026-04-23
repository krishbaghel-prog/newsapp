import React, { useEffect, useState } from "react";
import CategoryTabs from "../components/CategoryTabs";
import TopBar from "../components/TopBar";
import { api } from "../services/api";

export default function Compare() {
  const [category, setCategory] = useState("all");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [analysisByKey, setAnalysisByKey] = useState({});
  const [analyzeBusy, setAnalyzeBusy] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setBusy(true);
      setErr("");

      try {
        const response = await api.get("/stories", {
          params: { category, min_size: 2 }
        });
        if (!cancelled) setItems(response.data?.items || []);
      } catch (e) {
        if (!cancelled) {
          setErr(
            e?.response?.data?.detail ||
              e?.response?.data?.error ||
              "Failed to load story clusters."
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [category]);

  async function analyze(storyKeyValue) {
    setAnalyzeBusy(storyKeyValue);
    setErr("");

    try {
      const response = await api.post("/stories/analyze", {
        story_key: storyKeyValue,
        category
      });
      setAnalysisByKey((current) => ({ ...current, [storyKeyValue]: response.data }));
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.response?.data?.error || "Analysis failed.");
    } finally {
      setAnalyzeBusy(null);
    }
  }

  return (
    <div className="pb-24">
      <TopBar title="Compare Sources" />

      <main className="page-container py-4">
        <CategoryTabs value={category} onChange={setCategory} />

        <p className="mb-4 rounded-xl bg-brand-50/50 px-4 py-3 text-sm text-brand-800 dark:bg-brand-500/5 dark:text-brand-300">
          ⚖️ Stories are grouped by recurring headline keywords. AI analysis helps compare coverage across sources.
        </p>

        {err ? (
          <div className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-500/10 dark:bg-red-500/5 dark:text-red-200">
            {typeof err === "string" ? err : JSON.stringify(err)}
          </div>
        ) : null}

        {busy ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading clusters...</span>
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((item, index) => {
            const storyKeyValue = item.story_key;
            const analysis = analysisByKey[storyKeyValue];
            const modelJson = analysis?.model_json || {};

            return (
              <section
                key={storyKeyValue}
                className="glass-card overflow-hidden p-5 animate-slide-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
                      {item.headline}
                    </h2>
                    <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                        {item.sources_count} articles
                      </span>
                      {Array.isArray(item.sources) ? item.sources.join(", ") : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={analyzeBusy === storyKeyValue}
                    onClick={() => analyze(storyKeyValue)}
                    className="btn-primary shrink-0 !text-xs disabled:opacity-50"
                  >
                    {analyzeBusy === storyKeyValue ? "⏳ Analyzing..." : "🔍 Analyze"}
                  </button>
                </div>

                <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
                  {(item.articles || []).slice(0, 6).map((article) => (
                    <li key={article.url} className="flex flex-wrap items-baseline gap-2 rounded-lg px-3 py-2 transition hover:bg-zinc-50 dark:hover:bg-white/5">
                      <span className="font-semibold text-zinc-600 dark:text-zinc-400">{article.source || "Source"}:</span>
                      <a
                        className="text-brand-600 transition-colors hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {article.title}
                      </a>
                    </li>
                  ))}
                </ul>

                {analysis ? (
                  <div className="mt-5 rounded-xl border border-brand-100/50 bg-gradient-to-br from-brand-50/30 to-purple-50/30 p-4 text-sm dark:border-brand-500/10 dark:from-brand-500/5 dark:to-purple-500/5">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                      <span>🤖</span> AI Comparison
                      <span className="rounded-full bg-white/50 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-white/5">{analysis.provider}</span>
                    </div>

                    {modelJson.overview ? (
                      <p className="mb-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
                        {modelJson.overview}
                      </p>
                    ) : null}

                    {Array.isArray(modelJson.agreements) && modelJson.agreements.length ? (
                      <div className="mb-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <span>✅</span> Agreements
                        </div>
                        <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-300">
                          {modelJson.agreements.map((entry, index) => (
                            <li key={`agreement_${index}`}>{entry}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {Array.isArray(modelJson.disagreements) && modelJson.disagreements.length ? (
                      <div className="mb-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <span>⚠️</span> Disagreements
                        </div>
                        <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-300">
                          {modelJson.disagreements.map((entry, index) => (
                            <li key={`disagreement_${index}`}>{entry}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {Array.isArray(modelJson.citations) && modelJson.citations.length ? (
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                          <span>📎</span> Citations
                        </div>
                        <ul className="space-y-2">
                          {modelJson.citations.map((citation, index) => (
                            <li key={`citation_${index}`} className="text-sm">
                              <a
                                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                                href={citation.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {citation.title || citation.url}
                              </a>
                              {citation.source ? (
                                <span className="text-zinc-400"> — {citation.source}</span>
                              ) : null}
                              {citation.note ? (
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {citation.note}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {!modelJson.overview &&
                    !(Array.isArray(modelJson.agreements) && modelJson.agreements.length) &&
                    !(Array.isArray(modelJson.citations) && modelJson.citations.length) ? (
                      <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
                        {analysis.raw || "No structured output returned."}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {!busy && items.length === 0 ? (
          <div className="py-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 text-5xl">🔎</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No multi-source clusters found yet. Load news on Home first or try another category.
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
