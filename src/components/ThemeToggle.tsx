"use client";

import { useLayoutEffect } from "react";
import { applyTheme, onSystemThemeChange, saveTheme } from "@/lib/theme";

// 10x10 pixel art, drawn as one rect per run of pixels.
const MOON = "M4 0h1v1H4zM2 1h2v1H2zM1 2h3v1H1zM1 3h3v1H1zM0 4h4v1H0zM0 5h4v1H0zM1 6h5v1H1zM1 7h8v1H1zM2 8h6v1H2zM4 9h2v1H4z";
const SUN =
  "M4 0h2v1H4zM1 1h1v1H1zM8 1h1v1H8zM4 2h2v1H4zM3 3h4v1H3zM0 4h1v1H0zM2 4h6v1H2zM9 4h1v1H9zM0 5h1v1H0zM2 5h6v1H2zM9 5h1v1H9zM3 6h4v1H3zM4 7h2v1H4zM1 8h1v1H1zM8 8h1v1H8zM4 9h2v1H4z";

export function ThemeToggle() {
  useLayoutEffect(() => {
    // React clears <html> attributes on the dev Strict Mode remount, so apply again. Then
    // follow system changes, which only matter while no choice has been saved.
    applyTheme();
    return onSystemThemeChange(applyTheme);
  }, []);

  function toggle() {
    saveTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  }

  // Which icon shows is decided in CSS from data-theme, so the server and client render the same.
  return (
    <button type="button" onClick={toggle} aria-label="Toggle dark mode" title="Toggle dark mode" className="theme-toggle cursor-pointer self-center p-1">
      <svg viewBox="0 0 10 10" width="20" height="20" fill="currentColor" shapeRendering="crispEdges" aria-hidden>
        <path className="when-light" d={MOON} />
        <path className="when-dark" d={SUN} />
      </svg>
    </button>
  );
}
