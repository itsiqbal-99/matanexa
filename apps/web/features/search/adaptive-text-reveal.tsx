'use client';

import { useSearchPresentation } from './use-search-presentation';

export function AdaptiveTextReveal({ text, revealKey }: { text: string; revealKey: string | null }) {
  const { words, visibleWords, complete } = useSearchPresentation(text, revealKey);
  return (
    <div className="adaptive-reveal">
      {/* Announce the finished message once; do not announce individual word changes. */}
      <p className="sr-only" role="status">{text}</p>
      <p className="summary-copy" aria-hidden="true">
        {words.slice(0, visibleWords).join(' ')}
        {!complete && <span className="reveal-caret" />}
      </p>
    </div>
  );
}
