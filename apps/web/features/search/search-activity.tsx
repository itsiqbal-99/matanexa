'use client';

import { useEffect, useState } from 'react';

export function SearchActivity({ compact = false }: { compact?: boolean }) {
  const [longWait, setLongWait] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLongWait(true), 5500);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className={`search-activity ${compact ? 'search-activity-compact' : ''}`} role="status" aria-live="polite">
      <span className="processing-dots" aria-hidden="true"><i/><i/><i/></span>
      <span>{longWait ? 'Pencarian masih berlangsung…' : 'Menelusuri referensi hadits…'}</span>
    </div>
  );
}
