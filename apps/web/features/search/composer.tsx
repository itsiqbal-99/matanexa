'use client';
import { ArrowUp, Square } from 'lucide-react';
import { useRef, useState } from 'react';

export function Composer({ pending, ready, onSubmit, onCancel }: {
  pending: boolean;
  ready: boolean;
  onSubmit: (query: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const length = [...text].length;
  function submit() {
    if (pending || !ready) return;
    const query = text.trim();
    if ([...query].length < 3 || [...query].length > 300) {
      setError('Tulis pertanyaan sepanjang 3–300 karakter.');
      textarea.current?.focus();
      return;
    }
    onSubmit(query);
    setText('');
    setError('');
    if (textarea.current) textarea.current.style.height = 'auto';
  }
  return (
    <div className="composer-wrap">
      <form className={`composer ${error ? 'composer-invalid' : ''}`} onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label className="sr-only" htmlFor="question">Pertanyaan pencarian hadits</label>
        <textarea ref={textarea} id="question" value={text} rows={1} maxLength={600}
          disabled={pending || !ready} aria-invalid={Boolean(error) || length > 300}
          aria-describedby="composer-hint composer-error"
          placeholder="Tanyakan tentang hadits apa pun…"
          onChange={(event) => {
            setText(event.target.value); setError('');
            event.target.style.height = 'auto';
            event.target.style.height = `${Math.min(event.target.scrollHeight, 176)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault(); submit();
            }
          }}/>
        <div className="composer-bottom">
          <span id="composer-hint" className={length > 300 ? 'limit-exceeded' : ''}>
            {text ? `${length}/300 karakter` : 'Enter untuk mencari · Shift+Enter untuk baris baru'}
          </span>
          {pending ? <button type="button" className="send-button cancel-button" onClick={onCancel} aria-label="Batalkan pencarian"><Square size={15} fill="currentColor"/></button>
          : <button type="submit" className="send-button" disabled={!ready || !text.trim() || length > 300} aria-label="Cari referensi"><ArrowUp size={20}/></button>}
        </div>
      </form>
      <p id="composer-error" role="alert" className="input-error">{error}</p>
      <p className="composer-note">Pencarian referensi, bukan penetapan hukum. Selalu periksa sumber asli.</p>
    </div>
  );
}
