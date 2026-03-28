import { useState } from "react";
import {
  FONT_OPTIONS,
  FONT_QUERY_PARAM,
  getCurrentFontId,
  isFontLabEnabled,
  setActiveFont,
} from "../config/fontLab";

const DEFAULT_SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog — 1234567890";

export function FontLab() {
  const [fontId, setFontId] = useState(getCurrentFontId());
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);

  if (!isFontLabEnabled()) {
    return null;
  }

  const selected = FONT_OPTIONS.find((option) => option.id === fontId) ?? FONT_OPTIONS[0];

  const handleFontChange = (nextId: string) => {
    setFontId(nextId);
    setActiveFont(nextId);
  };

  return (
    <aside className="fixed bottom-4 right-4 z-[1000] w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-white/25 bg-black/85 p-4 shadow-2xl backdrop-blur-sm">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/70">Font Lab</p>

      <label className="mb-2 block text-xs font-semibold text-white/90" htmlFor="font-lab-select">
        Active font
      </label>
      <select
        id="font-lab-select"
        className="mb-3 w-full rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-sm text-white"
        onChange={(event) => handleFontChange(event.target.value)}
        value={fontId}
      >
        {FONT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="mb-2 block text-xs font-semibold text-white/90" htmlFor="font-lab-preview">
        Preview text
      </label>
      <input
        id="font-lab-preview"
        className="mb-3 w-full rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-sm text-white"
        onChange={(event) => setSampleText(event.target.value)}
        value={sampleText}
      />

      <div className="rounded-lg border border-white/20 bg-neutral-900/60 p-3 text-sm leading-relaxed text-white/95">
        <p className="mb-2 text-xs text-white/70">{selected.label}</p>
        <p style={{ fontFamily: selected.fontFamily }}>{sampleText}</p>
      </div>

      <p className="mt-3 text-[11px] text-white/60">
        Tip: use <code className="rounded bg-white/10 px-1 py-0.5">?fontLab=1&amp;{FONT_QUERY_PARAM}=segoe-ui</code> to open
        with a preset.
      </p>
    </aside>
  );
}