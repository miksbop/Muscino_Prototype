export type FontOption = {
  id: string;
  label: string;
  /** CSS font-family stack applied globally when selected. */
  fontFamily: string;
};

export const FONT_QUERY_PARAM = "font";
export const FONT_LAB_QUERY_PARAM = "fontLab";
const FONT_STORAGE_KEY = "muscino.fontSelection";

/**
 * Add/remove entries here to experiment with fonts quickly.
 *
 * For local fonts, place files in /public/fonts and declare them in src/styles/index.css
 * via @font-face, then add a stack here with the declared family name first.
 */
export const FONT_OPTIONS: FontOption[] = [
  { id: "system-ui", label: "System UI", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' },
  { id: "segoe-ui", label: "Segoe UI", fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
  { id: "arial", label: "Arial", fontFamily: 'Arial, Helvetica, sans-serif' },
  { id: "calibri", label: "Calibri", fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' },
  { id: "cambria", label: "Cambria", fontFamily: "Cambria, Georgia, serif" },
  { id: "candara", label: "Candara", fontFamily: 'Candara, Calibri, Segoe, "Segoe UI", sans-serif' },
  { id: "consolas", label: "Consolas", fontFamily: 'Consolas, "Courier New", monospace' },
  { id: "constantia", label: "Constantia", fontFamily: 'Constantia, "Lucida Bright", Georgia, serif' },
  { id: "corbel", label: "Corbel", fontFamily: 'Corbel, "Gill Sans", "Gill Sans MT", "Trebuchet MS", sans-serif' },
  { id: "franklin-gothic", label: "Franklin Gothic", fontFamily: '"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif' },
  { id: "georgia", label: "Georgia", fontFamily: 'Georgia, "Times New Roman", Times, serif' },
  { id: "tahoma", label: "Tahoma", fontFamily: "Tahoma, Verdana, Segoe, sans-serif" },
  { id: "times-new-roman", label: "Times New Roman", fontFamily: '"Times New Roman", Times, serif' },
  { id: "trebuchet-ms", label: "Trebuchet MS", fontFamily: '"Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", sans-serif' },
  { id: "verdana", label: "Verdana", fontFamily: "Verdana, Geneva, sans-serif" },
  { id: "outfit", label: "Outfit (Local)", fontFamily: 'Outfit, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' },
  { id: "poppins", label: "Poppins (Local)", fontFamily: 'Poppins, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' },
];

const DEFAULT_FONT_ID = "system-ui";

export function isFontLabEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const explicitValue = params.get(FONT_LAB_QUERY_PARAM);

  if (explicitValue === "1" || explicitValue === "true") {
    return true;
  }

  if (explicitValue === "0" || explicitValue === "false") {
    return false;
  }

  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function getFontById(id: string | null) {
  if (!id) {
    return null;
  }

  return FONT_OPTIONS.find((option) => option.id === id) ?? null;
}

export function getCurrentFontId() {
  if (typeof window === "undefined") {
    return DEFAULT_FONT_ID;
  }

  const activeId = document.documentElement.dataset.fontId;
  return getFontById(activeId ?? null)?.id ?? DEFAULT_FONT_ID;
}

export function setActiveFont(fontId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const selected = getFontById(fontId) ?? getFontById(DEFAULT_FONT_ID);
  if (!selected) {
    return;
  }

  document.documentElement.style.setProperty("--app-font-family", selected.fontFamily);
  document.documentElement.dataset.fontId = selected.id;
  window.localStorage.setItem(FONT_STORAGE_KEY, selected.id);
}

export function initializeFontLab() {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const fontFromQuery = params.get(FONT_QUERY_PARAM);

  if (fontFromQuery && getFontById(fontFromQuery)) {
    setActiveFont(fontFromQuery);
    return;
  }

  const stored = window.localStorage.getItem(FONT_STORAGE_KEY);
  if (stored && getFontById(stored)) {
    setActiveFont(stored);
    return;
  }

  setActiveFont(DEFAULT_FONT_ID);
}