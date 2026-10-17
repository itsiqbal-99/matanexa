'use client';
import { AlertCircle, ArrowRight, BookOpenText, RotateCcw, Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AdaptiveTextReveal } from './adaptive-text-reveal';
import { SearchActivity } from './search-activity';
import type { Conversation, SearchResult } from './types';

export function SearchResults({ conversation, renderCard, onRetry, onFilter, onPage, onWrite, revealKey }: {
  conversation: Conversation;
  renderCard: (result: SearchResult) => React.ReactNode;
  onRetry: () => void;
  onFilter: (slug: string) => void;
  onPage: (page: number) => void;
  onWrite: () => void;
  revealKey: string | null;
}) {
  const scrollRegion = useRef<HTMLElement>(null);
  const previousId = useRef<string | null>(null);
  const { status, response, sources } = conversation;
  const real = !!response && response.meta.modeUsed !== 'mock';
  const research = response?.meta.dataScope === 'local_pilot';
  const ambiguous = response?.meta.queryStatus === 'ambiguous';
  const updating = status === 'loading' && !!response;
  const stale = (status === 'error' || status === 'aborted') && !!response;
  const summary = response ? (response.data.totalCandidates
    ? `${response.data.totalCandidates} ${real ? 'referensi pada korpus yang tersedia' : 'contoh yang sesuai dengan topik pencarian'} ditemukan.`
    : real ? 'Belum ditemukan referensi pada korpus yang tersedia.' : 'Belum ditemukan contoh untuk pertanyaan ini.') : '';

  useEffect(() => {
    if (previousId.current !== conversation.id) {
      scrollRegion.current?.closest('main')?.scrollTo({ top: 0, behavior: 'instant' });
      previousId.current = conversation.id;
    }
  }, [conversation.id]);

  return (
    <section ref={scrollRegion} className="conversation" aria-label="Hasil pencarian aktif">
      <div className="conversation-inner" key={conversation.id}>
        <h1 className="sr-only">Hasil pencarian hadits</h1>
        <div className="query-row"><span className="query-avatar" aria-hidden="true">A</span><p className="user-query">{conversation.query}</p></div>
        <div className="assistant-response">
          <div className="response-heading"><span className="response-mark"><BookOpenText size={18} strokeWidth={1.8}/></span><span>Matanexa</span></div>
          {status === 'loading' && !response ? <SearchActivity/> : null}
          {(status === 'error' || status === 'aborted') && !response ? (
            <div className="state-panel" role="status">
              <AlertCircle size={22}/><h2>{status === 'aborted' ? 'Pencarian dibatalkan' : 'Pencarian belum berhasil'}</h2>
              <p>{conversation.error ?? 'Anda bisa mengulang pencarian kapan saja.'}</p>
              <button className="secondary-button" onClick={onRetry}><RotateCcw size={16}/> Coba lagi</button>
            </div>
          ) : null}
          {response && <>
            <div className="response-intro">
              {revealKey && status === 'success' ? <AdaptiveTextReveal key={revealKey} text={summary} revealKey={revealKey}/> : <p className="summary-copy">{summary}</p>}
              <p className="search-integrity"><span className="integrity-mark" aria-hidden="true"/>
                {research ? 'Pilot riset lokal. Data belum selesai ditinjau dan belum memiliki izin publikasi.'
                  : real ? 'Referensi teks diperiksa dan izin sumber disetujui. Bukan penilaian derajat hadits.'
                  : 'Data simulasi, bukan hadits terverifikasi. Jangan digunakan sebagai kutipan agama.'}
              </p>
              {response.meta.modeUsed === 'lexical_fallback' && <p className="search-fallback">Pencarian kata kunci digunakan karena pencarian semantik tidak tersedia.</p>}
            </div>
            <div className="reference-block">
              <div className="reference-title-row">
                <div><h2>Referensi ditemukan</h2><p>{real ? 'Jelajahi sumber dan periksa teks aslinya.' : 'Contoh hasil untuk pengujian antarmuka.'}</p></div>
                {sources.length > 0 && <label className="filter-wrap" htmlFor="collection-filter"><span>Sumber</span>
                  <select id="collection-filter" value={conversation.sourceSlug} disabled={status === 'loading'} onChange={(event) => onFilter(event.target.value)}>
                    <option value="">{real ? 'Semua sumber' : 'Semua koleksi'}</option>
                    {sources.map((source) => <option key={source.slug} value={source.slug}>{source.label}</option>)}
                  </select>
                </label>}
              </div>
              {updating && <SearchActivity compact/>}
              {stale && <div className="inline-request-warning" role="status">
                <AlertCircle size={16}/><span>{status === 'aborted' ? 'Pembaruan dibatalkan. Hasil sebelumnya tetap ditampilkan.' : `${conversation.error ?? 'Pembaruan gagal.'} Hasil sebelumnya tetap ditampilkan.`}</span>
                <button onClick={onRetry}>Coba lagi</button>
              </div>}
              {response.data.results.length ? (
                <div className={`results-list ${updating ? 'results-updating' : ''}`} aria-busy={updating}>
                  {response.data.results.map(renderCard)}
                </div>
              ) : <div className="state-panel empty-results"><Search size={22}/><h3>{ambiguous ? 'Perjelas topik pencarian' : 'Belum ditemukan hasil'}</h3>
                <p>{ambiguous ? 'Sebutkan topik atau kata utama, seperti “ilmu” atau “orang tua”.'
                  : real ? 'Coba kata kunci yang berbeda. Pencarian hanya mencakup korpus yang tersedia.'
                  : 'Data simulasi terbatas pada enam topik: ilmu, orang tua, marah, makan, lisan, dan sedekah.'}</p>
                <button className="secondary-button" onClick={onWrite}>Tulis pertanyaan lain <ArrowRight size={15}/></button>
              </div>}
              {(response.meta.page > 1 || response.meta.hasMore) && <nav className="pagination" aria-label="Halaman hasil">
                <button className="secondary-button" disabled={response.meta.page === 1 || updating} onClick={() => onPage(response.meta.page - 1)}>Sebelumnya</button>
                <span>Halaman {response.meta.page}</span>
                <button className="secondary-button" disabled={!response.meta.hasMore || updating} onClick={() => onPage(response.meta.page + 1)}>Berikutnya</button>
              </nav>}
            </div>
          </>}
        </div>
      </div>
    </section>
  );
}
