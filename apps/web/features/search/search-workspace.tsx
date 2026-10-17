'use client';

import { BookOpenText, Moon, PanelLeftOpen, Sun, Menu, ArrowUpRight, Bookmark, Search as SearchIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Modal } from '../../components/modal';
import { Composer } from './composer';
import { ResultCard, ResultDetail } from './result-card';
import { Sidebar } from './sidebar';
import { SearchResults } from './search-results';
import { useWorkspace } from './use-workspace';
import type { SearchResult } from './types';

const suggestions = [
  { query: 'Hadits tentang menuntut ilmu', title: 'Menuntut ilmu' },
  { query: 'Berbakti kepada orang tua', title: 'Berbakti kepada orang tua' },
  { query: 'Adab makan dalam Islam', title: 'Adab sehari-hari' },
  { query: 'Menjaga lisan', title: 'Menjaga lisan' },
];

export function SearchWorkspace() {
  const workspace = useWorkspace();
  const { data, active, hydrated, view } = workspace;
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState(false);
  const [clear, setClear] = useState(false);
  const [detail, setDetail] = useState<SearchResult | null>(null);
  const composerRegion = useRef<HTMLDivElement>(null);
  const isWelcome = view === 'search' && !active;

  function focusComposer() {
    requestAnimationFrame(() => composerRegion.current?.querySelector('textarea')?.focus());
  }
  function newSearch() {
    workspace.newChat();
    setDrawer(false);
    focusComposer();
  }
  const navigationProps = {
    history: data.history,
    activeId: workspace.activeId,
    savedCount: data.saved.length,
    view,
    onNew: newSearch,
    onSelect: (id: string) => { workspace.select(id); setDrawer(false); },
    onSaved: () => { workspace.showSaved(); setDrawer(false); },
    onSettings: () => { setDrawer(false); setSettings(true); },
    onClear: () => { setDrawer(false); setClear(true); },
  };
  function card(result: SearchResult) {
    return (
      <ResultCard key={result.id} result={result}
        saved={data.saved.some((item) => item.id === result.id)}
        onSave={() => workspace.toggleSave(result)}
        onDetail={() => setDetail(result)}
        onCopy={() => void workspace.copy(result)}/>
    );
  }
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${isWelcome ? 'welcome-layout' : 'working-layout'}`}>
      <a className="skip-link" href="#search-content">Langsung ke konten</a>
      <aside className="desktop-sidebar" aria-label="Navigasi utama" inert={collapsed}>
        <Sidebar {...navigationProps} onCollapse={() => setCollapsed(true)}/>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            {collapsed && <button className="icon-button desktop-toggle" aria-label="Buka sidebar" onClick={() => setCollapsed(false)}><PanelLeftOpen size={20}/></button>}
            <button className="icon-button mobile-toggle" aria-label="Buka navigasi" onClick={() => setDrawer(true)}><Menu size={21}/></button>
            <div className="location-label">{view === 'saved' ? 'Tersimpan' : 'Pencarian hadits'}<span className="location-separator" aria-hidden="true">/</span><span>Matanexa</span></div>
          </div>
          <div className="topbar-right">
            <span className="topbar-label">Ruang eksplorasi</span>
            <button className="icon-button theme-toggle" aria-label={data.theme === 'light' ? 'Aktifkan tema gelap' : 'Aktifkan tema terang'}
              disabled={!hydrated} onClick={() => workspace.setData((previous) => ({ ...previous, theme: previous.theme === 'light' ? 'dark' : 'light' }))}>
              {data.theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}
            </button>
          </div>
        </header>
        <main id="search-content" className={`search-content ${isWelcome ? 'is-welcome' : ''}`} tabIndex={-1}>
          {workspace.storageWarning && <p className="storage-warning" role="status">Penyimpanan lokal tidak tersedia atau datanya tidak dapat dibaca. Anda tetap bisa mencari selama halaman terbuka.</p>}
          {view === 'saved' ? (
            <section className="saved-view">
              <div className="section-eyebrow"><Bookmark size={15}/> Koleksi pribadi</div>
              <h1>Referensi tersimpan<span className="punctuation">.</span></h1>
              <p className="saved-description">Referensi yang Anda simpan di perangkat ini. Periksa kembali sumber aslinya sebelum digunakan.</p>
              {data.saved.length ? <div className="results-list">{data.saved.map(card)}</div>
                : <div className="state-panel saved-empty"><BookOpenText size={27}/><h2>Belum ada yang disimpan</h2><p>Temukan referensi, lalu simpan agar mudah dibaca kembali.</p><button className="secondary-button" onClick={newSearch}>Mulai mencari <ArrowUpRight size={16}/></button></div>}
            </section>
          ) : active ? (
            <SearchResults conversation={active} renderCard={card}
              revealKey={active.status === 'success' && workspace.lastReveal?.id === active.id ? workspace.lastReveal.key : null}
              onRetry={() => void workspace.search(active.query, active, active.sourceSlug)}
              onFilter={(slug) => void workspace.search(active.query, active, slug)}
              onPage={(page) => void workspace.search(active.query, active, active.sourceSlug, page)}
              onWrite={focusComposer}/>
          ) : (
            <section className="welcome">
              <div className="welcome-brand" aria-hidden="true"><span className="welcome-brand-icon"><BookOpenText size={23} strokeWidth={1.7}/></span><span>MATANEXA</span></div>
              <h1>Apa yang ingin Anda <em>temukan?</em></h1>
              <p className="welcome-description">Jelajahi referensi hadits melalui pertanyaan sederhana. Temukan teks, sumber, dan konteks rujukannya dalam satu ruang yang tenang.</p>
              <div className="suggestions" aria-label="Contoh pertanyaan">
                {suggestions.map(({ query, title }) => <button disabled={!hydrated} key={query} onClick={() => void workspace.search(query)}>{title}<ArrowUpRight size={15}/></button>)}
              </div>
            </section>
          )}
        </main>
        {view === 'search' && <div ref={composerRegion} className="composer-region"><Composer pending={active?.status === 'loading'} ready={hydrated}
          onSubmit={(query) => void workspace.search(query)} onCancel={workspace.cancel}/></div>}
        {view === 'saved' && <div className="saved-composer-action"><button className="secondary-button" onClick={newSearch}><SearchIcon size={17}/> Mulai pencarian baru</button></div>}
      </div>
      {drawer && <Modal title="Navigasi" drawer onClose={() => setDrawer(false)}><Sidebar {...navigationProps}/></Modal>}
      {settings && <Modal title="Pengaturan" onClose={() => setSettings(false)}>
        <div className="settings-content">
          <label className="setting-row"><span>Tema tampilan</span><select value={data.theme} onChange={(event) => workspace.setData((previous) => ({ ...previous, theme: event.target.value === 'dark' ? 'dark' : 'light' }))}><option value="light">Terang</option><option value="dark">Gelap</option></select></label>
          <label className="setting-row"><span>Tampilkan teks Arab</span><input type="checkbox" checked={data.showArabic} onChange={(event) => workspace.setData((previous) => ({ ...previous, showArabic: event.target.checked }))}/></label>
          <p className="muted">Teks Arab hanya ditampilkan sesuai data sumber yang tersedia. Simulasi tidak memuat teks Arab asli.</p>
          <p className="privacy-note">Maksimal 20 riwayat dan 100 referensi tersimpan secara lokal. Konten pilot riset tidak disimpan atau disalin. Pertanyaan pencarian dikirim ke layanan backend.</p>
        </div>
      </Modal>}
      {clear && <Modal title="Hapus data lokal?" onClose={() => setClear(false)}>
        <div className="settings-content"><p>Seluruh riwayat dan referensi tersimpan pada browser ini akan dihapus.</p><div className="detail-footer"><button className="secondary-button" onClick={() => setClear(false)}>Batal</button><button className="danger-button" onClick={() => { workspace.clearAll(); setClear(false); }}>Hapus semuanya</button></div></div>
      </Modal>}
      {detail && <ResultDetail result={detail} showArabic={data.showArabic} onClose={() => setDetail(null)} saved={data.saved.some((item) => item.id === detail.id)} onSave={() => workspace.toggleSave(detail)} onCopy={() => void workspace.copy(detail)}/>}
      <div className="toast-region" role="status" aria-live="polite">{workspace.notice && <p className="toast">{workspace.notice}</p>}</div>
    </div>
  );
}
