import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { api, setAuthToken } from "../services/api";
import { auth, authMode, googleProvider, hasFirebaseConfig } from "../services/firebase";

const DEMO_LOGOUT_KEY = "newsapp_demo_logged_out";

const AuthCtx = createContext(null);

function mapUser(u) {
  if (!u) return null;
  return {
    uid: u.id,
    displayName: u.displayName || "",
    email: u.email || "",
    photoURL: u.photoURL || "",
    isAdmin: Boolean(u.isAdmin),
    authMode: u.authMode || authMode
  };
}

function mapFirebaseUser(u) {
  if (!u) return null;
  return {
    uid: u.uid,
    displayName: u.displayName || "",
    email: u.email || "",
    photoURL: u.photoURL || "",
    isAdmin: false,
    authMode: "firebase"
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;

    async function fetchMe() {
      const r = await api.get("/auth/me");
      return mapUser(r.data);
    }

    async function bootDemoMode() {
      if (localStorage.getItem(DEMO_LOGOUT_KEY) === "1") {
        setLoading(false);
        return;
      }

      try {
        const nextUser = await fetchMe();
        if (!cancelled) setUser(nextUser);
      } catch {
        if (!cancelled) {
          setAuthToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (authMode === "none") {
      setAuthToken(null);
      bootDemoMode();
      return () => {
        cancelled = true;
      };
    }

    if (!hasFirebaseConfig || !auth || !googleProvider) {
      setAuthToken(null);
      setUser(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;

      if (!firebaseUser) {
        setAuthToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const token = await firebaseUser.getIdToken();
        setAuthToken(token);

        try {
          const nextUser = await fetchMe();
          if (!cancelled) setUser(nextUser || mapFirebaseUser(firebaseUser));
        } catch {
          if (!cancelled) setUser(mapFirebaseUser(firebaseUser));
        }
      } catch {
        setAuthToken(null);
        if (!cancelled) setUser(mapFirebaseUser(firebaseUser));
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  async function loginDemo() {
    localStorage.removeItem(DEMO_LOGOUT_KEY);
    setLoading(true);
    try {
      const nextUser = await api.get("/auth/me");
      setUser(mapUser(nextUser.data));
    } finally {
      setLoading(false);
    }
  }

  async function loginWithGoogle() {
    if (!auth || !googleProvider) {
      throw new Error("Firebase sign-in is not configured.");
    }
    await signInWithPopup(auth, googleProvider);
  }

  async function logout() {
    if (authMode === "none") {
      localStorage.setItem(DEMO_LOGOUT_KEY, "1");
      setAuthToken(null);
      setUser(null);
      return;
    }

    if (auth) {
      await signOut(auth);
    }

    setAuthToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      logout,
      loginDemo,
      loginWithGoogle,
      authMode,
      firebaseReady: hasFirebaseConfig
    }),
    [user, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
