'use client';
import {
  ArrowUpRight,
  BookOpen,
  GraduationCap,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Utensils,
  HandHeart,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Modal } from '../../components/modal';
import { Composer } from './composer';
import { ResultCard, ResultDetail } from './result-card';
import { Sidebar } from './sidebar';
import { SearchResults } from './search-results';
import { useWorkspace } from './use-workspace';
import type { SearchResult } from './types';

const suggestions = [
  {
    query: 'Hadits tentang menuntut ilmu',
    topic: 'Ilmu & pengetahuan',
    icon: GraduationCap,
  },
  {
    query: 'Berbakti kepada orang tua',
    topic: 'Keluarga & kasih sayang',
    icon: HeartHandshake,
  },
  {
    query: 'Adab makan dalam Islam',
    topic: 'Adab sehari-hari',
    icon: Utensils,
  },
  { query: 'Menjaga lisan', topic: 'Akhlak & perkataan', icon: MessageCircle },
  {
    query: 'Keutamaan sedekah',
    topic: 'Kebaikan & kepedulian',
    icon: HandHeart,
  },
];
export function SearchWorkspace() {
  const workspace = useWorkspace();
  const { data, active, hydrated, view } = workspace;
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState(false);
  const [clear, setClear] = useState(false);
  const [detail, setDetail] = useState<SearchResult | null>(null);
  const real = !!active?.response && active.response.meta.modeUsed !== 'mock';
  const composerRegion = useRef<HTMLDivElement>(null);
  function focusComposer() {
    requestAnimationFrame(() =>
      composerRegion.current?.querySelector('textarea')?.focus(),
    );
  }
  function newChat() {
    workspace.newChat();
    setDrawer(false);
    focusComposer();
  }
  const navigation = (
    <Sidebar
      history={data.history}
      activeId={workspace.activeId}
      savedCount={data.saved.length}
      view={view}
      onNew={newChat}
      onSelect={(id) => {
        workspace.select(id);
        setDrawer(false);
      }}
      onSaved={() => {
        workspace.showSaved();
        setDrawer(false);
      }}
      onSettings={() => {
        setDrawer(false);
        setSettings(true);
      }}
      onClear={() => {
        setDrawer(false);
        setClear(true);
      }}
    />
  );
  function card(result: SearchResult) {
    return (
      <ResultCard
        key={result.id}
        result={result}
        saved={data.saved.some((item) => item.id === result.id)}
        onSave={() => workspace.toggleSave(result)}
        onDetail={() => setDetail(result)}
        onCopy={() => void workspace.copy(result)}
      />
    );
  }
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#search-content">
        Langsung ke konten
      </a>
      <aside
        className="desktop-sidebar"
        aria-label="Navigasi utama"
        inert={collapsed}
      >
        {navigation}
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button desktop-toggle"
              aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
            <button
              className="icon-button mobile-toggle"
              aria-label="Buka navigasi"
              onClick={() => setDrawer(true)}
            >
              <Menu size={21} />
            </button>
            <div className="location-label">
              <span>Matanexa</span>
              <span className="location-divider">/</span>
              <strong>
                {view === 'saved' ? 'Simpanan lokal' : 'Ruang pencarian'}
              </strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className="mode-badge">
              <span className="status-dot" />
              {active?.response?.meta.modeUsed === 'hybrid'
                ? 'Mode hybrid'
                : real
                  ? 'Mode lexical'
                  : 'Matanexa lokal'}
            </span>
            <button
              className="icon-button"
              aria-label={
                data.theme === 'light'
                  ? 'Aktifkan tema gelap'
                  : 'Aktifkan tema terang'
              }
              disabled={!hydrated}
              onClick={() =>
                workspace.setData((previous) => ({
                  ...previous,
                  theme: previous.theme === 'light' ? 'dark' : 'light',
                }))
              }
            >
              {data.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </header>
        <main
          id="search-content"
          className={`search-content ${!active && view === 'search' ? 'is-welcome' : ''}`}
          tabIndex={-1}
        >
          {workspace.storageWarning && (
            <p className="storage-warning" role="status">
              Penyimpanan lokal tidak tersedia atau datanya tidak dapat dibaca.
              Kamu tetap bisa mencari selama halaman ini terbuka.
            </p>
          )}
          {view === 'saved' ? (
            <section className="saved-view">
              <p className="eyebrow">KOLEKSI PRIBADI</p>
              <h1>Disimpan untuk nanti.</h1>
              <p className="muted">
                Hasil yang kamu simpan di perangkat ini. Statusnya merupakan
                salinan saat pencarian; periksa kembali rujukan sebelum
                digunakan.
              </p>
              {data.saved.length ? (
                <div className="results-list">{data.saved.map(card)}</div>
              ) : (
                <div className="state-panel">
                  <BookOpen size={26} />
                  <h2>Belum ada simpanan.</h2>
                  <p>Simpan hasil pencarian agar mudah dibuka kembali.</p>
                  <button className="secondary-button" onClick={newChat}>
                    Mulai mencari
                  </button>
                </div>
              )}
            </section>
          ) : active ? (
            <SearchResults
              conversation={active}
              renderCard={card}
              onRetry={() =>
                void workspace.search(active.query, active, active.sourceSlug)
              }
              onFilter={(slug) =>
                void workspace.search(active.query, active, slug)
              }
              onPage={(page) =>
                void workspace.search(
                  active.query,
                  active,
                  active.sourceSlug,
                  page,
                )
              }
              onWrite={focusComposer}
            />
          ) : (
            <section className="welcome">
              <div className="welcome-emblem" aria-hidden="true">
                <div className="emblem-orbit" />
                <div className="welcome-mark">
                  <BookOpen size={31} strokeWidth={1.6} />
                </div>
                <span className="emblem-spark">
                  <Sparkles size={15} />
                </span>
              </div>
              <p className="eyebrow welcome-eyebrow">RUANG EKSPLORASI HADITS</p>
              <h1>
                Cari hadits dengan
                <br className="desktop-break" />{' '}
                <span>bahasa sehari-hari.</span>
              </h1>
              <p className="welcome-description">
                Mulai dari pertanyaan sederhana. Temukan referensi hadits, lalu
                pelajari teks dan sumbernya dengan lebih dekat.
              </p>
              <div className="suggestions-heading">
                <span>MULAI DARI RASA INGIN TAHU</span>
                <span>atau tulis pertanyaanmu di bawah</span>
              </div>
              <div className="suggestions" aria-label="Contoh pertanyaan">
                {suggestions.map(({ query, topic, icon: Icon }) => (
                  <button
                    disabled={!hydrated}
                    key={query}
                    aria-label={query}
                    onClick={() => void workspace.search(query)}
                  >
                    <span className="suggestion-icon">
                      <Icon size={19} strokeWidth={1.7} />
                    </span>
                    <span className="suggestion-copy">
                      <small>{topic}</small>
                      <strong>{query}</strong>
                    </span>
                    <ArrowUpRight size={16} className="suggestion-arrow" />
                  </button>
                ))}
              </div>
              <div className="welcome-note">
                <ShieldCheck size={15} />
                <p>
                  Pencarian referensi. Setiap pertanyaan dicari secara mandiri.
                </p>
              </div>
            </section>
          )}
        </main>
        <div ref={composerRegion} className="composer-region">
          <Composer
            key={workspace.activeId ?? view}
            pending={active?.status === 'loading'}
            ready={hydrated}
            onSubmit={(query) => void workspace.search(query)}
            onCancel={workspace.cancel}
          />
        </div>
      </div>
      {drawer && (
        <Modal title="Navigasi" drawer onClose={() => setDrawer(false)}>
          {navigation}
        </Modal>
      )}
      {settings && (
        <Modal title="Pengaturan" onClose={() => setSettings(false)}>
          <div className="settings-content">
            <label className="setting-row">
              <span>Tema tampilan</span>
              <select
                value={data.theme}
                onChange={(event) =>
                  workspace.setData((previous) => ({
                    ...previous,
                    theme: event.target.value === 'dark' ? 'dark' : 'light',
                  }))
                }
              >
                <option value="light">Terang</option>
                <option value="dark">Gelap</option>
              </select>
            </label>
            <label className="setting-row">
              <span>Tampilkan bagian teks Arab</span>
              <input
                type="checkbox"
                checked={data.showArabic}
                onChange={(event) =>
                  workspace.setData((previous) => ({
                    ...previous,
                    showArabic: event.target.checked,
                  }))
                }
              />
            </label>
            <p className="muted">
              Pilihan ini berlaku untuk tampilan detail. Teks Arab ditampilkan
              sesuai sumber; data simulasi hanya menampilkan placeholder.
            </p>
            <p className="privacy-note">
              Riwayat maksimal 20 pertanyaan dan 100 simpanan di browser ini.
              Teks pilot riset tidak disimpan permanen atau disalin. Semua data
              lokal bisa dihapus.
            </p>
          </div>
        </Modal>
      )}
      {clear && (
        <Modal title="Hapus data lokal?" onClose={() => setClear(false)}>
          <div className="settings-content">
            <p>
              Seluruh riwayat pertanyaan dan contoh tersimpan di perangkat ini
              akan dihapus.
            </p>
            <div className="detail-footer">
              <button
                className="secondary-button"
                onClick={() => setClear(false)}
              >
                Batal
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  workspace.clearAll();
                  setClear(false);
                }}
              >
                Hapus riwayat dan simpanan
              </button>
            </div>
          </div>
        </Modal>
      )}
      {detail && (
        <ResultDetail
          result={detail}
          showArabic={data.showArabic}
          onClose={() => setDetail(null)}
          saved={data.saved.some((item) => item.id === detail.id)}
          onSave={() => workspace.toggleSave(detail)}
          onCopy={() => void workspace.copy(detail)}
        />
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {workspace.notice && <p className="toast">{workspace.notice}</p>}
      </div>
    </div>
  );
}
