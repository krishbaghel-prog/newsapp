import React from "react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { useAuth } from "../contexts/AuthContext";

export default function Profile() {
  const { user, loading, logout } = useAuth();

  return (
    <div className="pb-24">
      <TopBar title="Profile" />

      <main className="page-container py-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</span>
          </div>
        ) : null}

        {!loading && !user ? (
          <div className="glass-card p-6 text-center animate-fade-in">
            <div className="mx-auto mb-3 text-4xl">👤</div>
            <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
              Sign in to save articles and access admin tools.
            </div>
            <GoogleSignInButton className="mx-auto max-w-xs" />
          </div>
        ) : null}

        {user ? (
          <div className="space-y-4 animate-fade-in">
            {/* User info card */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 text-2xl text-white shadow-glow">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    user.displayName?.charAt(0)?.toUpperCase() || "U"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold tracking-tight">{user.displayName || "User"}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                  {user.authMode === "none" ? "🎯 Demo Mode" : "🔒 Firebase Auth"}
                </span>
                <span className={`rounded-full px-3 py-1 font-semibold ${
                  user.isAdmin
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-400"
                }`}>
                  {user.isAdmin ? "✅ Admin Access" : "👁️ Standard Access"}
                </span>
              </div>

              <button
                type="button"
                onClick={logout}
                className="btn-secondary mt-4 w-full"
              >
                Sign Out
              </button>
            </div>

            {/* Admin card */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span>⚙️</span> Admin Panel
              </div>
              <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {user.isAdmin
                  ? "You can manage manual news posts, live updates, and AI summaries."
                  : "Your account is not in ADMIN_EMAILS yet. Update backend/.env if you want admin access."}
              </div>
              <Link
                to="/admin"
                className="btn-primary mt-3 inline-flex"
              >
                Open Admin Panel →
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
