"use client";

import { useEffect, useState, useCallback } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("vase-theme")
        : null;
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      const root = document.documentElement;
      root.classList.add("theme-transition");
      root.classList.toggle("dark", next === "dark");
      window.setTimeout(() => root.classList.remove("theme-transition"), 240);
      window.localStorage.setItem("vase-theme", next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
