'use client';

import { Bookmark, BookOpenText, PanelLeftClose, Plus, Settings2, Trash2 } from 'lucide-react';
import type { Conversation } from './types';

export function Sidebar({ history, activeId, savedCount, view, onNew, onSelect, onSaved, onSettings, onClear, onCollapse }: {
  history: Conversation[];
  activeId: string | null;
  savedCount: number;
  view: 'search' | 'saved';
  onNew: () => void;
  onSelect: (id: string) => void;
  onSaved: () => void;
  onSettings: () => void;
  onClear: () => void;
  onCollapse?: () => void;
}) {
  return (
    <div className="sidebar-content">
      <div className="brand-row">
        <button className="brand-wordmark" onClick={onNew} aria-label="Matanexa — pencarian baru">
          <span className="brand-glyph" aria-hidden="true"><BookOpenText size={19} strokeWidth={1.8}/></span>
          <span>Matanexa<span className="brand-period">.</span></span>
        </button>
        {onCollapse && <button className="icon-button brand-collapse" onClick={onCollapse} aria-label="Tutup sidebar"><PanelLeftClose size={19}/></button>}
      </div>

      <div className="sidebar-main-actions">
        <button className="sidebar-link new-search-link" onClick={onNew}><Plus size={18}/><span>Pencarian baru</span></button>
        <button className={`sidebar-link ${view === 'saved' ? 'active' : ''}`} onClick={onSaved} aria-current={view === 'saved' ? 'page' : undefined}>
          <Bookmark size={17}/><span>Tersimpan</span>{savedCount > 0 && <span className="sidebar-count">{savedCount}</span>}
        </button>
      </div>

      <div className="history-title-row">
        <h2>Riwayat pencarian</h2>
        <button className="icon-button history-clear" aria-label="Hapus data lokal" title="Hapus riwayat dan simpanan" onClick={onClear} disabled={!history.length && !savedCount}><Trash2 size={15}/></button>
      </div>
      <nav className="history-list" aria-label="Riwayat pencarian">
        {history.length ? history.map((item) => (
          <button key={item.id} className={`history-item ${activeId === item.id && view === 'search' ? 'active' : ''}`}
            aria-current={activeId === item.id && view === 'search' ? 'page' : undefined} onClick={() => onSelect(item.id)} title={item.query}>
            <span>{item.query}</span>
          </button>
        )) : <p className="history-empty">Pencarian Anda akan tampil di sini.</p>}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-link" onClick={onSettings}><Settings2 size={17}/><span>Pengaturan</span></button>
        <p className="sidebar-local-note">Riwayat disimpan di browser ini.</p>
      </div>
    </div>
  );
}
