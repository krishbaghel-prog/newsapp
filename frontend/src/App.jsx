import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import Live from "./pages/Live";
import Videos from "./pages/Videos";
import Saved from "./pages/Saved";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Chat from "./pages/Chat";
import Discuss from "./pages/Discuss";
import TrustedHighlights from "./pages/TrustedHighlights";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <div className="min-h-screen bg-[#fff8f6] text-[#2d2d2d] transition-colors duration-300 dark:bg-[#121215] dark:text-[#e8e4e1]">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/live" element={<Live />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/discuss" element={<Discuss />} />
              <Route path="/trusted" element={<TrustedHighlights />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <BottomNav />
          </div>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
