import React, { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";

/* ── Premium SVG Icons for Discuss tabs ── */
const DAll = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const DGeneral = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const DTech = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);
const DBiz = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const DSports = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
  </svg>
);
const DPolitics = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" />
  </svg>
);
const DEntertain = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" />
  </svg>
);
const DFeedback = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const CATS = [
  { key: "all", label: "All", Icon: DAll },
  { key: "general", label: "General", Icon: DGeneral },
  { key: "technology", label: "Tech", Icon: DTech },
  { key: "business", label: "Business", Icon: DBiz },
  { key: "politics", label: "Politics", Icon: DPolitics },
  { key: "sports", label: "Sports", Icon: DSports },
  { key: "entertainment", label: "Entertainment", Icon: DEntertain },
  { key: "feedback", label: "Feedback", Icon: DFeedback }
];

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Discuss() {
  const { user, loading: authLoading } = useAuth();
  const [category, setCategory] = useState("all");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // New post form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general" });
  const [postBusy, setPostBusy] = useState(false);

  // Expanded discussion
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  async function loadDiscussions() {
    setBusy(true);
    setErr("");
    try {
      const res = await api.get("/discussions", { params: { category, page: 1, limit: 30 } });
      setItems(res.data?.items || []);
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to load discussions.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadDiscussions();
  }, [category]);

  async function handlePost(e) {
    e.preventDefault();
    setPostBusy(true);
    setErr("");
    setMsg("");
    try {
      await api.post("/discussions", form);
      setMsg("Posted successfully!");
      setForm({ title: "", content: "", category: "general" });
      setShowForm(false);
      await loadDiscussions();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Failed to post.");
    } finally {
      setPostBusy(false);
    }
  }

  async function openDiscussion(id) {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    try {
      const res = await api.get(`/discussions/${id}`);
      setDetail(res.data?.item || null);
    } catch {
      setDetail(null);
    }
  }

  async function handleReply(id) {
    if (!replyText.trim()) return;
    setReplyBusy(true);
    try {
      await api.post(`/discussions/${id}/reply`, { content: replyText.trim() });
      setReplyText("");
      const res = await api.get(`/discussions/${id}`);
      setDetail(res.data?.item || null);
      await loadDiscussions();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Failed to reply.");
    } finally {
      setReplyBusy(false);
    }
  }

  async function handleLike(id) {
    try {
      const res = await api.post(`/discussions/${id}/like`);
      setItems((prev) =>
        prev.map((item) =>
          item._id === id
            ? { ...item, likeCount: res.data.likeCount, liked: res.data.liked }
            : item
        )
      );
      if (detail && detail._id === id) {
        setDetail((prev) => ({ ...prev, likeCount: res.data.likeCount }));
      }
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Failed to like.");
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/discussions/${id}`);
      setExpanded(null);
      setDetail(null);
      setMsg("Discussion deleted.");
      await loadDiscussions();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Failed to delete.");
    }
  }

  const inputClass =
    "w-full rounded-xl border-zinc-200/60 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:ring-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100";

  return (
    <div className="pb-24">
      <TopBar
        title="Discussions"
        right={
          user ? (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="btn-primary !rounded-full !px-4 !py-1.5 !text-xs"
            >
              {showForm ? "✕ Cancel" : "✏️ New Post"}
            </button>
          ) : null
        }
      />

      <main className="page-container py-4">
        {/* Category tabs */}
        <div className="category-tabs no-scrollbar">
          {CATS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`category-tab ${
                category === c.key
                  ? "category-tab--active"
                  : "category-tab--inactive"
              }`}
            >
              <span className="category-tab-icon"><c.Icon /></span>
              {c.label}
            </button>
          ))}
        </div>

        {!authLoading && !user ? (
          <div className="glass-card mb-4 p-6 text-center animate-fade-in">
            <div className="mx-auto mb-3 text-4xl">💬</div>
            <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
              Sign in with Google to join the discussion.
            </div>
            <GoogleSignInButton className="mx-auto max-w-xs" />
          </div>
        ) : null}

        {msg ? (
          <div className="mb-4 rounded-2xl border border-emerald-200/60 bg-emerald-50/80 p-4 text-sm text-emerald-800 dark:border-emerald-500/10 dark:bg-emerald-500/5 dark:text-emerald-200 animate-slide-up">
            ✅ {msg}
          </div>
        ) : null}

        {err ? (
          <div className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-500/10 dark:bg-red-500/5 dark:text-red-200">
            ❌ {err}
          </div>
        ) : null}

        {/* New post form */}
        {showForm && user ? (
          <form onSubmit={handlePost} className="glass-card mb-4 space-y-3 p-5 animate-slide-up">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span>✏️</span> Start a Discussion
            </div>
            <input
              className={inputClass}
              placeholder="Title — what's on your mind?"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
            <textarea
              className={inputClass}
              rows={4}
              placeholder="Share your thoughts, opinions, or questions..."
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              required
            />
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            >
              {CATS.filter((c) => c.key !== "all").map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="submit" disabled={postBusy} className="btn-primary w-full disabled:opacity-50">
              {postBusy ? "Posting..." : "🚀 Publish"}
            </button>
          </form>
        ) : null}

        {busy ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading discussions...</span>
          </div>
        ) : null}

        {/* Discussion list */}
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item._id}
              className="glass-card overflow-hidden animate-slide-up"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <button
                type="button"
                onClick={() => openDiscussion(item._id)}
                className="w-full p-5 text-left transition hover:bg-zinc-50/50 dark:hover:bg-white/[0.02]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold leading-snug tracking-tight">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {item.content}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                    {item.category}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    {item.authorPhoto ? (
                      <img
                        src={item.authorPhoto}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-500 text-[10px] font-bold text-white">
                        {item.authorName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="font-medium">{item.authorName}</span>
                  </div>
                  <span>{timeAgo(item.createdAt)}</span>
                  <span className="flex items-center gap-1">❤️ {item.likeCount || 0}</span>
                  <span className="flex items-center gap-1">💬 {item.replyCount || 0}</span>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === item._id && detail ? (
                <div className="border-t border-zinc-100 bg-zinc-50/30 p-5 dark:border-white/5 dark:bg-white/[0.01] animate-slide-up">
                  <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                    {detail.content}
                  </p>

                  <div className="mb-4 flex items-center gap-2">
                    {user ? (
                      <button
                        type="button"
                        onClick={() => handleLike(item._id)}
                        className="btn-secondary !rounded-full !px-4 !py-1.5 !text-xs"
                      >
                        ❤️ {detail.likeCount || 0}
                      </button>
                    ) : null}
                    {user && detail.authorEmail === user.email ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(item._id)}
                        className="btn-secondary !rounded-full !px-4 !py-1.5 !text-xs text-red-600 dark:text-red-400"
                      >
                        🗑️ Delete
                      </button>
                    ) : null}
                  </div>

                  {/* Replies */}
                  {Array.isArray(detail.replies) && detail.replies.length > 0 ? (
                    <div className="mb-4 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Replies ({detail.replies.length})
                      </div>
                      {detail.replies.map((reply, ri) => (
                        <div
                          key={reply._id || ri}
                          className="rounded-xl bg-white/60 p-3 dark:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            {reply.authorPhoto ? (
                              <img
                                src={reply.authorPhoto}
                                alt=""
                                className="h-4 w-4 rounded-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-500 text-[8px] font-bold text-white">
                                {reply.authorName?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                            )}
                            <span className="font-semibold">{reply.authorName}</span>
                            <span className="text-zinc-400">{timeAgo(reply.createdAt)}</span>
                          </div>
                          <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                            {reply.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Reply input */}
                  {user ? (
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        placeholder="Write a reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleReply(item._id);
                        }}
                      />
                      <button
                        type="button"
                        disabled={replyBusy || !replyText.trim()}
                        onClick={() => handleReply(item._id)}
                        className="btn-primary shrink-0 disabled:opacity-50"
                      >
                        {replyBusy ? "..." : "Reply"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {!busy && items.length === 0 ? (
          <div className="py-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 text-5xl">🗣️</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No discussions yet. Be the first to start a conversation!
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
