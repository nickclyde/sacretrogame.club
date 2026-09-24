const KEY = "theme";
const DARK = "(prefers-color-scheme: dark)";

/** Sets data-theme on <html>: the saved choice if there is one, otherwise the system setting. */
export function applyTheme() {
  let t: string | null = null;
  try {
    t = localStorage.getItem(KEY);
  } catch {}
  if (t !== "light" && t !== "dark") t = matchMedia(DARK).matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
}

/** Saves a choice and applies it. */
export function saveTheme(theme: "light" | "dark") {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  document.documentElement.dataset.theme = theme;
}

/** Calls back when the system setting changes. Returns the unsubscribe function. */
export function onSystemThemeChange(callback: () => void) {
  const media = matchMedia(DARK);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** The theme on <html> right now. */
export function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** For useSyncExternalStore: calls back whenever data-theme on <html> changes. */
export function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** applyTheme as an inline <head> script, so the theme is set before the first paint. Keep the two in sync. */
export const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem("${KEY}")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("${DARK}").matches?"dark":"light";document.documentElement.dataset.theme=t})()`;
