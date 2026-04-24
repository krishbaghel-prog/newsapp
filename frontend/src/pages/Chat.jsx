import React, { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "../components/TopBar";
import { api } from "../services/api";

function nowIso() {
  return new Date().toISOString();
}

/* ── Render message text with links, bold and emojis formatted nicely ── */
function MessageContent({ text }) {
  const lines = String(text || "").split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        // URL lines → clickable link
        const urlMatch = line.match(/^(\s*🔗\s*)(https?:\/\/\S+)/);
        if (urlMatch) {
          const url = urlMatch[2];
          const domain = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url.slice(0, 40); } })();
          return (
            <div key={i} className="pl-4">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-medium text-blue-300 underline-offset-2 hover:underline dark:text-blue-400 transition-colors"
              >
                🔗 {domain}
              </a>
            </div>
          );
        }

        // Bold (**text**) support
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        // Empty line → spacer
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Section headers (start with emoji + space)
        if (/^[📰📊🔑📌⚡ℹ️💡🎯]\s/.test(line.trim())) {
          return (
            <p key={i} className="font-semibold text-brand-300 dark:text-brand-400">
              {rendered}
            </p>
          );
        }

        // Numbered list items
        if (/^\d+\.\s/.test(line.trim())) {
          return (
            <p key={i} className="pl-1 font-medium">
              {rendered}
            </p>
          );
        }

        // Indented source/summary lines
        if (/^\s{3,}/.test(line)) {
          return (
            <p key={i} className="pl-4 text-xs opacity-75">
              {rendered}
            </p>
          );
        }

        return <p key={i}>{rendered}</p>;
      })}
    </div>
  );
}

export default function Chat() {
  const [baseline, setBaseline] = useState("");
  const [category, setCategory] = useState("all");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const bottomRef = useRef(null);

  const [messages, setMessages] = useState(() => [
    {
      id: `m_${nowIso()}`,
      role: "assistant",
      text:
        "👋 Hi! I'm your AI news assistant. Ask me about the latest headlines.\n\n" +
        "Try these:\n" +
        "• What's happening with Iran and USA?\n" +
        "• Latest tech news\n" +
        "• /set <topic> — save a baseline topic\n" +
        "• /compare <question> — compare against your baseline",
      ts: nowIso()
    }
  ]);

  const baselineLabel = useMemo(() => (baseline ? baseline : "(none)"), [baseline]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const raw = input.trim();
    if (!raw || busy) return;

    setErr("");
    setInput("");

    const userMessage = { id: `u_${nowIso()}`, role: "user", text: raw, ts: nowIso() };
    setMessages((current) => [...current, userMessage]);

    if (raw.toLowerCase().startsWith("/set ")) {
      const nextBaseline = raw.slice(5).trim();
      setBaseline(nextBaseline);
      setMessages((current) => [
        ...current,
        {
          id: `a_${nowIso()}`,
          role: "assistant",
          text: `✅ Baseline set to: **${nextBaseline || "(empty)"}**\n\nNow try: /compare <your question>`,
          ts: nowIso()
        }
      ]);
      return;
    }

    const isCompare = raw.toLowerCase().startsWith("/compare ");
    const isLatest = raw.toLowerCase().startsWith("/latest ");
    const message = isCompare
      ? raw.slice("/compare ".length).trim()
      : isLatest
        ? raw.slice("/latest ".length).trim()
        : raw;

    setBusy(true);

    try {
      const response = await api.post("/chat/news", {
        message,
        category,
        baseline,
        mode: isCompare ? "compare" : "latest"
      });

      setMessages((current) => [
        ...current,
        {
          id: `a_${nowIso()}`,
          role: "assistant",
          text: response.data?.answer || "No answer.",
          provider: response.data?.provider,
          ts: nowIso()
        }
      ]);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.response?.data?.error || "Chat failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const SUGGESTIONS = [
    "What's happening today?",
    "Latest tech news",
    "Biggest world events",
    "Business headlines"
  ];

  return (
    <div className="pb-24">
      <TopBar title="AI Chat" />

      <main className="page-container flex flex-col gap-3 py-4">
        {/* Status bar */}
        <div className="glass-card flex flex-wrap items-center gap-3 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 dark:text-zinc-500 text-xs">Baseline:</span>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
              {baselineLabel}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-zinc-400 dark:text-zinc-500 text-xs">Category:</span>
            <select
              className="rounded-xl border-zinc-200/60 bg-white px-2.5 py-1 text-xs font-medium transition focus:border-brand-400 focus:ring-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All</option>
              <option value="world">World</option>
              <option value="technology">Technology</option>
              <option value="business">Business</option>
              <option value="politics">Politics</option>
              <option value="sports">Sports</option>
              <option value="entertainment">Entertainment</option>
              <option value="health">Health</option>
              <option value="science">Science</option>
              <option value="war">Conflict</option>
            </select>
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-200/60 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-500/10 dark:bg-red-500/5 dark:text-red-200">
            {err}
          </div>
        ) : null}

        {/* Quick suggestion chips */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setInput(s); }}
                className="rounded-full border border-zinc-200/60 bg-white/60 px-3 py-1.5 text-xs font-medium text-zinc-600 backdrop-blur transition hover:border-brand-400 hover:text-brand-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400 dark:hover:text-brand-400"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="min-h-[50vh] space-y-3">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[88%] animate-slide-up rounded-2xl rounded-br-md bg-gradient-to-r from-brand-600 to-brand-500 p-4 text-sm text-white shadow-glow"
                  : "mr-auto max-w-[92%] animate-slide-up glass-card p-4 text-sm text-zinc-700 dark:text-zinc-200"
              }
              style={{ animationDelay: `${index * 20}ms` }}
            >
              <MessageContent text={message.text} />
              {message.provider && message.provider !== "fallback" && (
                <div className="mt-2 text-[10px] opacity-50">
                  ⚡ Powered by {message.provider}
                </div>
              )}
            </div>
          ))}

          {busy ? (
            <div className="mr-auto glass-card flex items-center gap-2 p-4 text-sm text-zinc-500 dark:text-zinc-400">
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "300ms" }} />
              </div>
              Searching latest news...
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="sticky glass-card p-3" style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex gap-2">
            <input
              className="w-full rounded-xl border-zinc-200/60 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:ring-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
              placeholder="Ask about the news... e.g. Iran USA latest"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={send}
              className="btn-primary shrink-0 disabled:opacity-50"
            >
              {busy ? "..." : "Send"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
