'use client';
import {
  Bookmark,
  MessageSquare,
  Plus,
  Settings2,
  Trash2,
  BookOpen,
  LockKeyhole,
  ArrowUpRight,
} from 'lucide-react';
import type { Conversation } from './types';
export function Sidebar({
  history,
  activeId,
  savedCount,
  view,
  onNew,
  onSelect,
  onSaved,
  onSettings,
  onClear,
}: {
  history: Conversation[];
  activeId: string | null;
  savedCount: number;
  view: 'search' | 'saved';
  onNew: () => void;
  onSelect: (id: string) => void;
  onSaved: () => void;
  onSettings: () => void;
  onClear: () => void;
}) {
  return (
    <div className="sidebar-content">
      <div className="brand">
        <span className="brand-symbol">
          <BookOpen size={23} strokeWidth={1.8} />
        </span>
        <span>
          Matanexa<span className="brand-dot">.</span>
          <small>HADITH DISCOVERY</small>
        </span>
      </div>
      <div className="workspace-label">
        <span className="status-dot" /> Ruang eksplorasi lokal{' '}
        <span>LOKAL</span>
      </div>
      <button className="new-chat" onClick={onNew}>
        <Plus size={18} />
        Percakapan baru
        <ArrowUpRight size={16} className="new-chat-arrow" />
      </button>
      <button
        className={`sidebar-link ${view === 'saved' ? 'active' : ''}`}
        aria-label="Buka simpanan lokal"
        onClick={onSaved}
      >
        <Bookmark size={17} />
        Tersimpan<span className="sidebar-count">{savedCount}</span>
      </button>
      <div className="history-heading">
        <span>RIWAYAT</span>
        <button
          className="icon-button"
          onClick={onClear}
          disabled={!history.length && !savedCount}
          aria-label="Hapus data lokal"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <nav className="history-list" aria-label="Riwayat percakapan">
        {history.length ? (
          history.map((item) => (
            <button
              key={item.id}
              className={`history-item ${activeId === item.id && view === 'search' ? 'active' : ''}`}
              aria-current={
                activeId === item.id && view === 'search' ? 'page' : undefined
              }
              onClick={() => onSelect(item.id)}
              title={item.query}
            >
              <MessageSquare size={15} />
              <span>{item.query}</span>
            </button>
          ))
        ) : (
          <div className="history-empty">
            <MessageSquare size={22} strokeWidth={1.4} />
            <p>Rasa ingin tahu dimulai di sini.</p>
            <span>
              Pertanyaanmu akan muncul di sini setelah pencarian pertama.
            </span>
          </div>
        )}
      </nav>
      <div className="sidebar-footer">
        <div className="local-privacy">
          <LockKeyhole size={17} />
          <div>
            <strong>Ruang pribadi, di perangkatmu</strong>
            <p>
              Riwayat tersimpan di browser ini. Pertanyaan dikirim ke layanan
              pencarian.
            </p>
          </div>
        </div>
        <button className="sidebar-link" onClick={onSettings}>
          <Settings2 size={17} />
          Pengaturan
        </button>
        <div className="sidebar-footnote">
          <span>Matanexa Local</span>
          <span>Pratinjau riset</span>
        </div>
      </div>
    </div>
  );
}
