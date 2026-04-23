import React, { useEffect, useState } from "react";
import CategoryTabs from "../components/CategoryTabs";
import TopBar from "../components/TopBar";
import { api } from "../services/api";

export default function TrustedHighlights() {
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState(false);
  const [trustData, setTrustData] = useState({ verified: [], caution: [] });

  useEffect(() => {
    let cancelled = false;

    async function runTrustFeed() {
      setBusy(true);

      try {
        const response = await api.get("/chat/trust-feed", { params: { category } });
        if (cancelled) return;

        setTrustData({
          verified: Array.isArray(response.data?.verified) ? response.data.verified : [],
          caution: Array.isArray(response.data?.caution) ? response.data.caution : []
        });
      } catch {
        if (!cancelled) {
          setTrustData({ verified: [], caution: [] });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    runTrustFeed();
    return () => {
      cancelled = true;
    };
  }, [category]);

  const totalItems = trustData.verified.length + trustData.caution.length;

  return (
    <div className="pb-24">
      <TopBar title="Trusted Highlights" />

      <main className="page-container pt-3">
        <CategoryTabs value={category} onChange={setCategory} />

        {/* Hero header */}
        <div className="trust-hero mb-6 animate-fade-in">
          <div className="trust-hero-icon">🛡️</div>
          <h1 className="trust-hero-title">
            AI-Verified News
          </h1>
          <p className="trust-hero-subtitle">
            Headlines analyzed for credibility using AI cross-referencing.
            Sorted by confidence score.
          </p>
          {!busy && totalItems > 0 && (
            <div className="trust-hero-stats">
              <div className="trust-stat">
                <span className="trust-stat-value trust-stat-verified">{trustData.verified.length}</span>
                <span className="trust-stat-label">Verified</span>
              </div>
              <div className="trust-stat-divider" />
              <div className="trust-stat">
                <span className="trust-stat-value trust-stat-caution">{trustData.caution.length}</span>
                <span className="trust-stat-label">Needs Caution</span>
              </div>
            </div>
          )}
        </div>

        {/* Loading state */}
        {busy && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="trust-skeleton animate-fade-in">
                <div className="skeleton h-5 w-3/4 mb-3" />
                <div className="skeleton h-3 w-1/2 mb-2" />
                <div className="skeleton h-3 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!busy && totalItems === 0 && (
          <div className="py-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 text-5xl">🔍</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No trust analysis available yet. Headlines will be analyzed as they load.
            </div>
          </div>
        )}

        {/* Verified section */}
        {trustData.verified.length > 0 && (
          <section className="mb-6 animate-fade-in">
            <div className="trust-section-header">
              <span className="trust-section-dot trust-section-dot--verified" />
              <h2 className="trust-section-title trust-section-title--verified">
                Likely True
              </h2>
              <span className="trust-section-count trust-section-count--verified">
                {trustData.verified.length}
              </span>
            </div>

            <div className="space-y-3">
              {trustData.verified.map((item, index) => (
                <article
                  key={`verified_${index}`}
                  className="trust-card trust-card--verified animate-slide-up"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="trust-card-header">
                    <h3 className="trust-card-title">
                      {item?.title || "Untitled"}
                    </h3>
                    <span className="trust-confidence trust-confidence--verified">
                      {item?.confidence || "n/a"}
                    </span>
                  </div>
                  {item?.reason && (
                    <p className="trust-card-reason">{item.reason}</p>
                  )}
                  <div className="trust-card-footer">
                    <span className="trust-card-badge trust-card-badge--verified">
                      ✓ Verified
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Caution section */}
        {trustData.caution.length > 0 && (
          <section className="mb-6 animate-fade-in">
            <div className="trust-section-header">
              <span className="trust-section-dot trust-section-dot--caution" />
              <h2 className="trust-section-title trust-section-title--caution">
                Needs Caution
              </h2>
              <span className="trust-section-count trust-section-count--caution">
                {trustData.caution.length}
              </span>
            </div>

            <div className="space-y-3">
              {trustData.caution.map((item, index) => (
                <article
                  key={`caution_${index}`}
                  className="trust-card trust-card--caution animate-slide-up"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="trust-card-header">
                    <h3 className="trust-card-title">
                      {item?.title || "Untitled"}
                    </h3>
                    <span className="trust-confidence trust-confidence--caution">
                      {item?.confidence || "n/a"}
                    </span>
                  </div>
                  {item?.reason && (
                    <p className="trust-card-reason">{item.reason}</p>
                  )}
                  <div className="trust-card-footer">
                    <span className="trust-card-badge trust-card-badge--caution">
                      ⚠ Use Caution
                    </span>
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
