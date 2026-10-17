'use client';
import { ArrowUp, Square, Search, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
export function Composer({
  pending,
  ready,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  ready: boolean;
  onSubmit: (query: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const length = [...text].length;
  function submit() {
    if (pending || !ready) return;
    const query = text.trim();
    if ([...query].length < 3 || [...query].length > 300) {
      setError('Tulis pertanyaan sepanjang 3–300 karakter.');
      ref.current?.focus();
      return;
    }
    onSubmit(query);
    setText('');
    setError('');
    if (ref.current) ref.current.style.height = 'auto';
  }
  return (
    <div className="composer-wrap">
      <form
        className={`composer ${error ? 'composer-invalid' : ''}`}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="composer-label" aria-hidden="true">
          <Search size={15} />
          <span>
            {pending
              ? 'Pencarian sedang berlangsung'
              : 'Jelajahi referensi hadits'}
          </span>
          <span className="composer-language">Bahasa Indonesia</span>
        </div>
        <label className="sr-only" htmlFor="question">
          Pertanyaan pencarian hadits
        </label>
        <textarea
          ref={ref}
          id="question"
          value={text}
          rows={1}
          maxLength={600}
          disabled={pending || !ready}
          aria-invalid={Boolean(error) || length > 300}
          aria-describedby="composer-hint composer-error"
          placeholder="Apa yang ingin kamu pelajari hari ini?"
          onChange={(event) => {
            setText(event.target.value);
            setError('');
            event.target.style.height = 'auto';
            event.target.style.height = `${Math.min(event.target.scrollHeight, 168)}px`;
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-bottom">
          <span id="composer-hint">
            {text
              ? `${length}/300 karakter`
              : 'Enter untuk kirim · Shift+Enter untuk baris baru'}
          </span>
          {pending ? (
            <button
              type="button"
              className="send-button"
              onClick={onCancel}
              aria-label="Batalkan pencarian"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              className="send-button"
              type="submit"
              disabled={!ready || !text.trim() || length > 300}
              aria-label="Kirim pertanyaan"
            >
              <ArrowUp size={21} />
            </button>
          )}
        </div>
      </form>
      <p id="composer-error" role="alert" className="input-error">
        {error}
      </p>
      <p className="composer-note">
        <ShieldCheck size={12} aria-hidden="true" /> Periksa sumber setiap
        hasil. Konten contoh bukan hadits terverifikasi; data pilot hanya untuk
        riset lokal.
      </p>
    </div>
  );
}
