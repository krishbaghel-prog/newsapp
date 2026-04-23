import React, { useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { api } from "../services/api";

function nowIso() {
  return new Date().toISOString();
}

export default function Chat() {
  const [baseline, setBaseline] = useState("");
  const [category, setCategory] = useState("all");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [messages, setMessages] = useState(() => [
    {
      id: `m_${nowIso()}`,
      role: "assistant",
      text:
        "👋 Hi! I'm your AI news assistant. Ask me about the latest headlines.\n\n" +
        "Commands:\n" +
        "• /set <topic> — save a baseline topic\n" +
        "• /latest <question> — ask using recent headlines\n" +
        "• /compare <question> — compare against your baseline",
      ts: nowIso()
    }
  ]);

  const baselineLabel = useMemo(() => (baseline ? baseline : "(none)"), [baseline]);

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
          text: `✅ Baseline set to: ${nextBaseline || "(empty)"}`,
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
          ts: nowIso()
        }
      ]);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.response?.data?.error || "Chat failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-24">
      <TopBar title="AI Chat" />

      <main className="page-container flex flex-col gap-3 py-4">
        {/* Status bar */}
        <div className="glass-card flex flex-wrap items-center gap-3 p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 dark:text-zinc-500">Baseline:</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
              {baselineLabel}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-zinc-400 dark:text-zinc-500">Category:</span>
            <select
              className="rounded-xl border-zinc-200/60 bg-white px-3 py-1.5 text-sm font-medium transition focus:border-brand-400 focus:ring-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
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
          <div className="rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-500/10 dark:bg-red-500/5 dark:text-red-200">
            {err}
          </div>
        ) : null}

        {/* Messages */}
        <div className="min-h-[50vh] space-y-3">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[88%] animate-slide-up rounded-2xl rounded-br-md bg-gradient-to-r from-brand-600 to-brand-500 p-4 text-sm text-white shadow-glow"
                  : "mr-auto max-w-[88%] animate-slide-up glass-card p-4 text-sm text-zinc-700 dark:text-zinc-200"
              }
              style={{ whiteSpace: "pre-wrap", animationDelay: `${index * 30}ms` }}
            >
              {message.text}
            </div>
          ))}

          {busy ? (
            <div className="mr-auto glass-card flex items-center gap-2 p-4 text-sm text-zinc-500 dark:text-zinc-400">
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "300ms" }} />
              </div>
              Thinking...
            </div>
          ) : null}
        </div>

        {/* Input */}
        <div className="sticky bottom-[56px] glass-card p-3">
          <div className="flex gap-2">
            <input
              className="w-full rounded-xl border-zinc-200/60 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:ring-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
              placeholder="Ask about the latest news... try /latest what is trending in AI"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
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
