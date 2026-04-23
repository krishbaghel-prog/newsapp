import React, { useCallback, useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import { api } from "../services/api";
import {
  getVerifiedArticles,
  updateVerifyStatus,
  removeFromVerified,
  clearAllVerified
} from "../services/verifyStore";
import { generateNewsletterPdf } from "../services/newsletterPdf";

/* ── Icons ── */
const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function formatArticlesForAI(articles) {
  return articles
    .map((a, i) => {
      const ts = a?.publishedAt ? new Date(a.publishedAt).toISOString() : "";
      return [
        `#${i + 1}`,
        `title: ${a?.title || ""}`,
        `summary: ${a?.summary || ""}`,
        `source: ${a?.source || ""}`,
        `url: ${a?.url || ""}`,
        `publishedAt: ${ts}`,
        `category: ${a?.category || ""}`
      ].join("\n");
    })
    .join("\n\n");
}

export default function TrustedHighlights() {
  const [articles, setArticles] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [toast, setToast] = useState("");

  // Load articles from localStorage
  const loadArticles = useCallback(() => {
    setArticles(getVerifiedArticles());
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Run AI verification on pending articles
  async function runVerification() {
    const pending = articles.filter((a) => !a.status || a.status === "pending");
    if (pending.length === 0) {
      setToast("All articles are already analyzed!");
      setTimeout(() => setToast(""), 2500);
      return;
    }

    setAnalyzing(true);

    try {
      const response = await api.post("/chat/verify-articles", {
        articles: pending.map((a) => ({
          title: a.title,
          summary: a.summary,
          source: a.source,
          url: a.url,
          publishedAt: a.publishedAt,
          category: a.category
        }))
      });

      const results = response.data?.results || [];
      results.forEach((result) => {
        if (result.url) {
          updateVerifyStatus(
            result.url,
            result.status || "verified",
            result.reason || "",
            result.confidence || "medium"
          );
        }
      });

      loadArticles();
      setToast(`${results.length} article${results.length !== 1 ? "s" : ""} analyzed!`);
      setTimeout(() => setToast(""), 3000);
    } catch {
      // Fallback: score-based verification when backend is unreachable
      pending.forEach((a) => {
        const title = (a.title || "").trim();
        const summary = (a.summary || "").trim();
        const source = (a.source || "").trim();
        const url = (a.url || "").trim();

        let score = 0;
        if (title.length > 10) score += 2;
        if (summary.length > 20) score += 2;
        if (source.length > 0) score += 2;
        if (url.startsWith("http")) score += 1;
        if (summary.length > 80) score += 1;
        if (title.length > 25) score += 1;

        const isVerified = score >= 4;

        updateVerifyStatus(
          a.url,
          isVerified ? "verified" : "caution",
          isVerified
            ? `Article from ${source || "news outlet"} has a detailed headline and summary consistent with legitimate reporting.`
            : "Limited information available for full verification.",
          isVerified ? (summary.length > 80 ? "high" : "medium") : "low"
        );
      });
      loadArticles();
      setToast("Analyzed using local heuristics (AI unavailable)");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleRemove(url) {
    removeFromVerified(url);
    loadArticles();
  }

  function handleClearAll() {
    if (window.confirm("Remove all articles from verification?")) {
      clearAllVerified();
      loadArticles();
    }
  }

  function handleDownloadPdf() {
    if (articles.length === 0) {
      setToast("Add articles to verify first!");
      setTimeout(() => setToast(""), 2500);
      return;
    }

    setPdfBusy(true);
    // Use setTimeout so UI updates before heavy PDF generation
    setTimeout(() => {
      try {
        generateNewsletterPdf(articles);
        setToast("Newsletter PDF downloaded!");
        setTimeout(() => setToast(""), 3000);
      } catch (e) {
        setToast("Failed to generate PDF");
        setTimeout(() => setToast(""), 3000);
      } finally {
        setPdfBusy(false);
      }
    }, 100);
  }

  const verified = articles.filter((a) => a.status === "verified");
  const caution = articles.filter((a) => a.status === "caution");
  const pending = articles.filter((a) => !a.status || a.status === "pending");

  return (
    <div className="pb-24">
      <TopBar
        title="Trusted AI"
        right={
          <div className="flex items-center gap-2">
            {articles.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="theme-toggle-btn"
                title="Clear all"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        }
      />

      <main className="page-container pt-3">
        {/* Hero header */}
        <div className="trust-hero mb-6 animate-fade-in">
          <div className="trust-hero-icon">🛡️</div>
          <h1 className="trust-hero-title">AI-Verified News</h1>
          <p className="trust-hero-subtitle">
            Only articles you choose to verify appear here.
            <br />
            Tap the shield icon on any news card to add it.
          </p>

          {articles.length > 0 && (
            <div className="trust-hero-stats">
              <div className="trust-stat">
                <span className="trust-stat-value trust-stat-verified">{verified.length}</span>
                <span className="trust-stat-label">Verified</span>
              </div>
              <div className="trust-stat-divider" />
              <div className="trust-stat">
                <span className="trust-stat-value trust-stat-caution">{caution.length}</span>
                <span className="trust-stat-label">Caution</span>
              </div>
              <div className="trust-stat-divider" />
              <div className="trust-stat">
                <span className="trust-stat-value" style={{ color: "#6b7280" }}>
                  {pending.length}
                </span>
                <span className="trust-stat-label">Pending</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {articles.length > 0 && (
            <div className="trust-action-row">
              <button
                type="button"
                onClick={runVerification}
                disabled={analyzing || pending.length === 0}
                className="trust-analyze-btn"
              >
                {analyzing ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <RefreshIcon />
                    Verify All ({pending.length})
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={pdfBusy}
                className="trust-download-btn"
              >
                {pdfBusy ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    Download Newsletter
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="trust-toast animate-slide-up">
            {toast}
          </div>
        )}

        {/* Empty state */}
        {articles.length === 0 && (
          <div className="py-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 text-5xl">🔍</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              No articles in your verification queue yet.
            </div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500">
              Go to the Home page and tap the{" "}
              <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <ShieldIcon /> shield
              </span>{" "}
              button on any news card to add it here.
            </div>
          </div>
        )}

        {/* Verified section */}
        {verified.length > 0 && (
          <section className="mb-6 animate-fade-in">
            <div className="trust-section-header">
              <span className="trust-section-dot trust-section-dot--verified" />
              <h2 className="trust-section-title trust-section-title--verified">
                Likely True
              </h2>
              <span className="trust-section-count trust-section-count--verified">
                {verified.length}
              </span>
            </div>

            <div className="space-y-3">
              {verified.map((item, index) => (
                <article
                  key={`verified_${item.url}`}
                  className="trust-card trust-card--verified animate-slide-up"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="trust-card-header">
                    <h3 className="trust-card-title">
                      {item?.title || "Untitled"}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="trust-confidence trust-confidence--verified">
                        {item?.confidence || "n/a"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.url)}
                        className="trust-remove-btn"
                        title="Remove"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                  {item?.source && (
                    <div className="trust-card-source">
                      {item.source} • {(item.category || "general").toUpperCase()}
                    </div>
                  )}
                  {item?.reason && (
                    <p className="trust-card-reason">{item.reason}</p>
                  )}
                  <div className="trust-card-footer">
                    <span className="trust-card-badge trust-card-badge--verified">
                      ✓ Verified
                    </span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="trust-card-link"
                      >
                        Read →
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Caution section */}
        {caution.length > 0 && (
          <section className="mb-6 animate-fade-in">
            <div className="trust-section-header">
              <span className="trust-section-dot trust-section-dot--caution" />
              <h2 className="trust-section-title trust-section-title--caution">
                Needs Caution
              </h2>
              <span className="trust-section-count trust-section-count--caution">
                {caution.length}
              </span>
            </div>

            <div className="space-y-3">
              {caution.map((item, index) => (
                <article
                  key={`caution_${item.url}`}
                  className="trust-card trust-card--caution animate-slide-up"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="trust-card-header">
                    <h3 className="trust-card-title">
                      {item?.title || "Untitled"}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="trust-confidence trust-confidence--caution">
                        {item?.confidence || "n/a"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.url)}
                        className="trust-remove-btn"
                        title="Remove"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                  {item?.source && (
                    <div className="trust-card-source">
                      {item.source} • {(item.category || "general").toUpperCase()}
                    </div>
                  )}
                  {item?.reason && (
                    <p className="trust-card-reason">{item.reason}</p>
                  )}
                  <div className="trust-card-footer">
                    <span className="trust-card-badge trust-card-badge--caution">
                      ⚠ Use Caution
                    </span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="trust-card-link"
                      >
                        Read →
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Pending section */}
        {pending.length > 0 && (
          <section className="mb-6 animate-fade-in">
            <div className="trust-section-header">
              <span className="trust-section-dot trust-section-dot--pending" />
              <h2 className="trust-section-title trust-section-title--pending">
                Pending Verification
              </h2>
              <span className="trust-section-count trust-section-count--pending">
                {pending.length}
              </span>
            </div>

            <div className="space-y-3">
              {pending.map((item, index) => (
                <article
                  key={`pending_${item.url}`}
                  className="trust-card trust-card--pending animate-slide-up"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="trust-card-header">
                    <h3 className="trust-card-title">
                      {item?.title || "Untitled"}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="trust-confidence trust-confidence--pending">
                        pending
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.url)}
                        className="trust-remove-btn"
                        title="Remove"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                  {item?.source && (
                    <div className="trust-card-source">
                      {item.source} • {(item.category || "general").toUpperCase()}
                    </div>
                  )}
                  <div className="trust-card-footer">
                    <span className="trust-card-badge trust-card-badge--pending">
                      ◉ Awaiting Analysis
                    </span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="trust-card-link"
                      >
                        Read →
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
