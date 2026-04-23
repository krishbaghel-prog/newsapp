import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function TopBar({ title, right }) {
  const { theme, toggle } = useTheme();
  const { language, changeLanguage, LANGUAGES } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  // Close language dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    }
    if (langOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [langOpen]);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <div className="min-w-0">
          <div className="top-bar-brand">NewsFlow</div>
          <div className="top-bar-title">{title}</div>
        </div>
        <div className="flex items-center gap-2">
          {right}

          {/* Language selector */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className="lang-btn"
              title="Select language"
            >
              <span className="text-base leading-none">{currentLang.flag}</span>
              <span className="lang-btn-label">{currentLang.code.toUpperCase()}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="opacity-50">
                <path d="M2 3.5L5 7l3-3.5H2z" />
              </svg>
            </button>

            {langOpen && (
              <div className="lang-dropdown animate-fade-in">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      changeLanguage(l.code);
                      setLangOpen(false);
                    }}
                    className={`lang-dropdown-item ${language === l.code ? "lang-dropdown-item--active" : ""}`}
                  >
                    <span>{l.flag}</span>
                    <span className="flex-1 text-left">{l.label}</span>
                    {language === l.code && <span className="text-xs opacity-60">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggle}
            className="theme-toggle-btn"
            title="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
    </header>
  );
}
