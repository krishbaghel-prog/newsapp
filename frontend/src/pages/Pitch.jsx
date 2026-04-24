import React, { useEffect } from "react";
import clsx from "clsx";

export default function Pitch() {
  // Simple scroll-to-top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#fff8f6] dark:bg-[#121215] pb-24">
      {/* Top Navigation */}
      <div className="top-bar">
        <div className="top-bar-inner justify-center">
          <div className="top-bar-brand text-lg">Pitch Deck</div>
        </div>
      </div>

      <div className="page-container flex flex-col gap-8 py-8 animate-slide-down">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-8 text-center text-white shadow-2xl dark:from-brand-900 dark:via-brand-800 dark:to-brand-900">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-black/10 blur-3xl" />
          
          <div className="relative z-10 mx-auto max-w-2xl">
            <span className="mb-4 inline-block rounded-full bg-white/20 px-4 py-1 text-xs font-bold tracking-widest text-white backdrop-blur-md">
              🏆 HACKATHON WINNING PITCH
            </span>
            <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl text-white">
              NewsFlows
            </h1>
            <h2 className="mb-6 text-xl font-medium text-white/90 sm:text-2xl">
              AI-Powered Unbiased News Platform
            </h2>
            <p className="text-lg font-semibold leading-relaxed text-brand-50 backdrop-blur-sm bg-white/10 p-4 rounded-xl shadow-inner italic border border-white/20">
              "An AI-powered news platform that detects bias, fights fake news, and delivers personalized, reliable information in seconds."
            </p>
          </div>
        </section>

        {/* PROBLEM & SOLUTION */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* PROBLEM */}
          <section className="glass-card flex flex-col items-center p-8 text-center border-l-4 border-l-rose-500">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400 shadow-sm">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">1. The Problem</h3>
            <blockquote className="mb-4 text-base italic text-zinc-600 dark:text-zinc-400">
              “Today, people don’t suffer from lack of news — they suffer from misinformation, bias, and overload.”
            </blockquote>
            <ul className="space-y-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 text-left w-full pl-4 list-disc marker:text-rose-400">
              <li>Fake news spreads faster than real news</li>
              <li>Media sources are often biased</li>
              <li>Users don’t have time to read long articles</li>
              <li>During crises, reliable information is hard to find</li>
            </ul>
            <div className="mt-6 rounded-lg bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 w-full">
              👉 Result: People make wrong decisions based on wrong information.
            </div>
          </section>

          {/* SOLUTION */}
          <section className="glass-card flex flex-col items-center p-8 text-center border-l-4 border-l-emerald-500">
             <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 shadow-sm">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">2. Our Solution</h3>
            <blockquote className="text-base italic text-zinc-600 dark:text-zinc-400 leading-relaxed">
              “We built <strong className="text-emerald-600 dark:text-emerald-400">NewsFlows</strong>, an AI-powered news platform that delivers verified, unbiased, and personalized news in seconds.”
            </blockquote>
            
            <div className="mt-8 w-full rounded-xl bg-zinc-50 p-5 dark:bg-zinc-800/50">
               <h4 className="mb-3 text-sm font-black uppercase tracking-widest text-brand-500">Key Innovation</h4>
               <div className="inline-block rounded-full bg-brand-100 px-3 py-1 mb-3 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                 🎯 Category: Unbiased AI Decision
               </div>
               <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                 “Our platform uses AI to analyze, compare, and present news without bias.”
               </p>
            </div>
          </section>
        </div>

        {/* CORE FEATURES */}
        <section className="glass-card p-8">
          <h3 className="mb-8 text-center text-2xl font-bold text-zinc-900 dark:text-white flex items-center justify-center gap-2">
            🔥 Core Features
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "⚖️",
                title: "Bias Detection System",
                desc: "Shows if news is Left / Right / Neutral. Compares multiple sources."
              },
              {
                icon: "✅",
                title: "Fake News Detection",
                desc: "“Verified” & “Misleading” tags. Source credibility check."
              },
              {
                icon: "⏱️",
                title: "Smart Summaries",
                desc: "News in 30 seconds. Bullet-point highlights."
              },
              {
                icon: "🚨",
                title: "Crisis Mode",
                desc: "Location-based emergency news. Real-time updates."
              },
              {
                icon: "🎯",
                title: "Personalized Feed",
                desc: "News based on user interest. Reduces information overload."
              }
            ].map((feature, idx) => (
              <div key={idx} className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-zinc-100 transition-all hover:-translate-y-1 hover:shadow-md dark:bg-zinc-800/50 dark:border-zinc-700/50">
                <div className="mb-4 text-3xl">{feature.icon}</div>
                <h4 className="mb-2 text-lg font-bold text-zinc-900 dark:text-white group-hover:text-brand-500 transition-colors">{feature.title}</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* IMPACT & TECH STACK */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* REAL WORLD IMPACT */}
          <section className="glass-card p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
            <h3 className="mb-6 text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">🌍 Real-World Impact</h3>
            <ul className="space-y-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="text-xl">🧠</span>
                <span>Helps users make <strong>informed decisions</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">🗳️</span>
                <span>Supports <strong>fair awareness in democracy</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">🚨</span>
                <span>Saves time during <strong>emergencies</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">📚</span>
                <span>Makes news accessible to everyone</span>
              </li>
            </ul>
          </section>

          {/* TECH STACK & FUTURE */}
          <div className="flex flex-col gap-6">
            <section className="glass-card p-6">
              <h3 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">🛠️ Tech Stack</h3>
              <div className="flex flex-wrap gap-2">
                {["HTML", "CSS", "JavaScript", "News API", "AI NLP", "Sentiment Analysis"].map(tech => (
                  <span key={tech} className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    {tech}
                  </span>
                ))}
              </div>
            </section>

            <section className="glass-card p-6 bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-900/10 dark:to-fuchsia-900/10">
              <h3 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">🚀 Future Scope</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2"><span className="text-brand-500">•</span> 🤖 AI Chatbot</li>
                <li className="flex items-center gap-2"><span className="text-brand-500">•</span> 🌐 Multi-language</li>
                <li className="flex items-center gap-2"><span className="text-brand-500">•</span> 📊 Data Viz Dashboard</li>
                <li className="flex items-center gap-2"><span className="text-brand-500">•</span> 🧠 Personalized AI</li>
              </ul>
            </section>
          </div>
        </div>

        {/* CLOSING LINE */}
        <section className="mt-4 rounded-3xl bg-zinc-900 p-8 text-center text-white dark:bg-black border border-zinc-800 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 via-brand-500 to-rose-500" />
           <div className="mx-auto max-w-3xl">
             <h3 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-brand-400">💥 Closing Statement</h3>
             <p className="text-xl sm:text-2xl font-bold leading-relaxed text-zinc-100">
               “NewsFlows is not just a news website — it’s a platform that ensures people <span className="text-brand-400">don’t just consume news, but understand the truth behind it.</span>”
             </p>
           </div>
        </section>

      </div>
    </div>
  );
}
