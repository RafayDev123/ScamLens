"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time sync with browser storage/DOM (external system)
    setTheme(t === "light" ? "light" : "dark");
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("sl_theme", next);
    } catch {
      /* storage unavailable */
    }
    // persist for signed-in users (ignored for guests)
    void fetch("/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: next }) }).catch(() => undefined);
  }
  return (
    <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line bg-surface text-muted transition hover:border-accent hover:text-accent">
      {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
