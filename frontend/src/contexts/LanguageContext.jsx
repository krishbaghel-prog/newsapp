import React, { createContext, useContext, useMemo, useState } from "react";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ru", label: "Русский", flag: "🇷🇺" }
];

const LangCtx = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("newsapp_lang") || "en";
  });

  function changeLanguage(code) {
    setLanguage(code);
    localStorage.setItem("newsapp_lang", code);
  }

  const value = useMemo(
    () => ({ language, changeLanguage, LANGUAGES }),
    [language]
  );

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLanguage() {
  const v = useContext(LangCtx);
  if (!v) throw new Error("useLanguage must be used within LanguageProvider");
  return v;
}

export { LANGUAGES };
