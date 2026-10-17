'use client';

import { useEffect, useState } from 'react';

/** Reveal is purely presentational; all source data is rendered independently. */
export function useSearchPresentation(text: string, revealKey: string | null) {
  const [visibleWords, setVisibleWords] = useState(0);
  const words = text.trim().split(/\s+/).filter(Boolean);

  useEffect(() => {
    if (!revealKey || !words.length) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) {
      const immediate = window.setTimeout(() => setVisibleWords(words.length), 0);
      return () => window.clearTimeout(immediate);
    }
    let index = 0;
    const duration = Math.min(1100, words.length * 64);
    const interval = Math.max(35, duration / words.length);
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleWords(index);
      if (index >= words.length) window.clearInterval(timer);
    }, interval);
    return () => window.clearInterval(timer);
  }, [revealKey, words.length]);

  // Keyed child remounts for each fresh response. Replayed/history content never types.
  const complete = !revealKey || visibleWords >= words.length;
  return { words, visibleWords: revealKey ? visibleWords : words.length, complete };
}
