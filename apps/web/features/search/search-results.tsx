'use client';
import { BookOpen, RotateCcw, Search, Info } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { SearchActivity } from './search-activity';
import type { Conversation, SearchResult } from './types';
export function SearchResults({
  conversation,
  renderCard,
  onRetry,
  onFilter,
  onPage,
  onWrite,
}: {
  conversation: Conversation;
  renderCard: (result: SearchResult) => React.ReactNode;
  onRetry: () => void;
  onFilter: (slug: string) => void;
  onPage: (page: number) => void;
  onWrite: () => void;
}) {
  const start = useRef<HTMLElement>(null);
  const { status, response, sources } = conversation;
  const real = !!response && response.meta.modeUsed !== 'mock';
  const research = response?.meta.dataScope === 'local_pilot';
  const ambiguous = response?.meta.queryStatus === 'ambiguous';
  useEffect(() => {
    start.current?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  }, [conversation]);
  return (
    <section ref={start} className="conversation" aria-label="Percakapan aktif">
      <h1 className="sr-only">
        {real ? 'Hasil pencarian hadits' : 'Hasil pencarian contoh'}
      </h1>
      <div className="query-row">
        <div className="query-label">PERTANYAANMU</div>
        <p className="user-query">{conversation.query}</p>
      </div>
      <div className="response-heading">
        <span className="response-mark">
          <BookOpen size={19} strokeWidth={1.6} />
        </span>
        <span>Matanexa</span>
        <span className="response-mode">
          {response?.meta.modeUsed === 'hybrid'
            ? 'Pencarian hybrid'
            : real
              ? 'Pencarian kata kunci'
              : status === 'loading'
                ? 'Mencari referensi'
                : 'Pencarian contoh'}
        </span>
      </div>
      {status === 'loading' ? (
        <SearchActivity />
      ) : status === 'error' || status === 'aborted' ? (
        <div className="state-panel" role="status">
          <Search size={24} />
          <h2>
            {status === 'aborted'
              ? 'Pencarian dibatalkan.'
              : 'Pencarian belum berhasil.'}
          </h2>
          <p>{conversation.error ?? 'Kamu bisa mencoba kembali kapan saja.'}</p>
          <button className="secondary-button" onClick={onRetry}>
            <RotateCcw size={16} />
            Coba lagi
          </button>
        </div>
      ) : response ? (
        <>
          <p className="result-summary" role="status">
            {response.data.totalCandidates
              ? `${response.data.totalCandidates} ${real ? 'hasil pada korpus tersedia' : 'contoh sesuai topik pertanyaanmu'}.`
              : real
                ? 'Belum ditemukan pada korpus yang tersedia.'
                : 'Belum ditemukan contoh untuk pertanyaan ini.'}
          </p>
          <div className="simulation-note">
            <Info size={16} />
            <span>
              {research
                ? 'Pilot riset lokal — data nyata, izin publikasi belum tuntas. Pasangan belum ditinjau manusia.'
                : real
                  ? 'Pencarian pada teks dengan referensi diperiksa dan izin sumber disetujui.'
                  : 'Konten contoh — bukan hadits terverifikasi.'}
            </span>
          </div>
          {response.meta.modeUsed === 'lexical_fallback' && (
            <p role="status">
              Embedding tidak tersedia; hasil menggunakan pencarian lexical.
            </p>
          )}
          {sources.length > 0 && (
            <div className="result-toolbar">
              <label htmlFor="collection-filter">
                {real ? 'Sumber' : 'Koleksi'}
              </label>
              <select
                id="collection-filter"
                value={conversation.sourceSlug}
                onChange={(event) => onFilter(event.target.value)}
              >
                <option value="">
                  {real ? 'Semua sumber' : 'Semua koleksi contoh'}
                </option>
                {sources.map((source) => (
                  <option key={source.slug} value={source.slug}>
                    {source.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {response.data.results.length ? (
            <div className="results-list">
              {response.data.results.map(renderCard)}
            </div>
          ) : (
            <div className="state-panel">
              <Search size={26} />
              <h2>
                {ambiguous ? 'Perjelas topik pencarian.' : 'Belum ditemukan.'}
              </h2>
              <p>
                {ambiguous
                  ? 'Sebutkan topik atau kata utama, misalnya “ilmu” atau “orang tua”. Pertanyaan ini belum cukup spesifik untuk dicari.'
                  : real
                    ? 'Coba kata kunci lain. Hasil terbatas pada korpus yang tersedia; pencarian tidak memberi kesimpulan hukum.'
                    : 'Data simulasi terbatas pada enam topik. Coba kata “ilmu”, “orang tua”, “marah”, “makan”, “lisan”, atau “sedekah”.'}
              </p>
              <button className="secondary-button" onClick={onWrite}>
                Tulis pertanyaan lain
              </button>
            </div>
          )}
          {(response.meta.page > 1 || response.meta.hasMore) && (
            <nav className="pagination" aria-label="Halaman hasil">
              <button
                className="secondary-button"
                disabled={response.meta.page === 1}
                onClick={() => onPage(response.meta.page - 1)}
              >
                Sebelumnya
              </button>
              <span>Halaman {response.meta.page}</span>
              <button
                className="secondary-button"
                disabled={!response.meta.hasMore}
                onClick={() => onPage(response.meta.page + 1)}
              >
                Berikutnya
              </button>
            </nav>
          )}
        </>
      ) : null}
    </section>
  );
}
