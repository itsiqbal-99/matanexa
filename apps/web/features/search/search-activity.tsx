'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

const messages = [
  'Menelusuri referensi untuk pertanyaanmu…',
  'Mencocokkan topik dengan teks sumber…',
  'Pencarian masih berlangsung. Mohon tunggu…',
];

// Only interface status is animated. Source text is always rendered verbatim.
export function SearchActivity() {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let message = 0;
    let character = 0;
    function tick() {
      character += 1;
      setTyped(messages[message].slice(0, character));
      if (character < messages[message].length) {
        timer = setTimeout(tick, 30);
      } else if (message < messages.length - 1) {
        timer = setTimeout(() => {
          message += 1;
          character = 0;
          tick();
        }, 1500);
      }
    }
    function syncPreference() {
      clearTimeout(timer);
      if (preference.matches) {
        setTyped(messages[0]);
      } else {
        message = 0;
        character = 0;
        timer = setTimeout(tick, 30);
      }
    }
    syncPreference();
    preference.addEventListener('change', syncPreference);
    return () => {
      clearTimeout(timer);
      preference.removeEventListener('change', syncPreference);
    };
  }, []);

  return (
    <div className="loading-results">
      <div className="search-activity" role="status">
        <div className="search-orb" aria-hidden="true">
          <span />
          <Search size={20} />
        </div>
        <div>
          <p>Sedang mencari…</p>
          <span className="typing-status" aria-hidden="true">
            {typed}
            <span className="typing-caret" />
          </span>
        </div>
        <div className="search-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
