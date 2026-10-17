'use client';
import { isTextResult } from './types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, searchApi } from '../../lib/api-client';
import { readWorkspace, writeWorkspace } from './storage';
import type { Conversation, SearchResult, WorkspaceData } from './types';

export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData>({
    history: [],
    saved: [],
    theme: 'light',
    showArabic: true,
  });
  const [hydrated, setHydrated] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'search' | 'saved'>('search');
  const [notice, setNotice] = useState('');
  const [lastReveal, setLastReveal] = useState<{ id: string; key: string } | null>(null);
  const currentRequest = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    let mounted = true;
    void readWorkspace().then(({ data: stored, unavailable }) => {
      if (mounted) {
        setData(stored);
        setStorageWarning(unavailable);
        setHydrated(true);
      }
    });
    return () => {
      mounted = false;
      currentRequest.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (hydrated)
      void writeWorkspace(data).then((success) => {
        if (!success) setStorageWarning(true);
      });
  }, [data, hydrated]);
  useEffect(() => {
    if (hydrated) document.documentElement.dataset.theme = data.theme;
  }, [data.theme, hydrated]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const cancelCurrent = useCallback(() => {
    sequence.current += 1;
    if (currentRequest.current) {
      currentRequest.current.abort();
      currentRequest.current = null;
      setData((previous) => ({
        ...previous,
        history: previous.history.map((item) =>
          item.status === 'loading' ? { ...item, status: 'aborted' as const } : item,
        ),
      }));
    }
  }, []);
  const active = data.history.find((item) => item.id === activeId);
  const search = useCallback(
    async (
      query: string,
      existing?: Conversation,
      sourceSlug = '',
      page = 1,
    ) => {
      if (!hydrated) return;
      cancelCurrent();
      setLastReveal(null);
      const requestNumber = sequence.current;
      const controller = new AbortController();
      currentRequest.current = controller;
      const conversation: Conversation = {
        id: existing?.id ?? crypto.randomUUID(),
        query,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        status: 'loading',
        sourceSlug,
        sources: existing?.sources ?? [],
        ...(existing?.response ? { response: existing.response } : {}),
      };
      setData((previous) => ({
        ...previous,
        history: [
          conversation,
          ...previous.history
            .filter((item) => item.id !== conversation.id)
            .map((item) =>
              item.status === 'loading'
                ? { ...item, status: 'aborted' as const }
                : item,
            ),
        ].slice(0, 20),
      }));
      setActiveId(conversation.id);
      setView('search');
      try {
        const response = await searchApi(query, {
          signal: controller.signal,
          sourceSlug,
          page,
        });
        if (requestNumber !== sequence.current) return;
        const sources = sourceSlug
          ? conversation.sources
          : [
              ...new Map(
                response.data.results.map((result) => [
                  result.sourceSlug,
                  {
                    slug: result.sourceSlug,
                    label: isTextResult(result)
                      ? result.provenance.sourceName
                      : result.collection,
                  },
                ]),
              ).values(),
            ];
        setData((previous) => ({
          ...previous,
          history: previous.history.map((item) =>
            item.id === conversation.id
              ? { ...item, status: 'success', response, sources, error: undefined }
              : item,
          ),
        }));
        setLastReveal({ id: conversation.id, key: `${conversation.id}:${requestNumber}` });
      } catch (error) {
        if (requestNumber !== sequence.current) return;
        const aborted = error instanceof ApiError && error.kind === 'aborted';
        setData((previous) => ({
          ...previous,
          history: previous.history.map((item) =>
            item.id === conversation.id
              ? {
                  ...item,
                  status: aborted ? 'aborted' : 'error',
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Pencarian gagal. Coba lagi.',
                }
              : item,
          ),
        }));
      } finally {
        if (requestNumber === sequence.current) currentRequest.current = null;
      }
    },
    [cancelCurrent, hydrated],
  );
  function newChat() {
    cancelCurrent();
    setActiveId(null);
    setLastReveal(null);
    setView('search');
  }
  function select(id: string) {
    cancelCurrent();
    setData((previous) => ({
      ...previous,
      history: previous.history.map((item) =>
        item.status === 'loading' ? { ...item, status: 'aborted' } : item,
      ),
    }));
    setActiveId(id);
    setLastReveal(null);
    setView('search');
  }
  function showSaved() {
    cancelCurrent();
    setActiveId(null);
    setLastReveal(null);
    setView('saved');
  }
  function toggleSave(result: SearchResult) {
    if ('isResearchOnly' in result) {
      setNotice(
        'Simpanan permanen dinonaktifkan untuk data pilot riset lokal.',
      );
      return;
    }
    const exists = data.saved.some((item) => item.id === result.id);
    if (!exists && data.saved.length >= 100) {
      setNotice('Simpanan penuh. Hapus salah satu hasil terlebih dahulu.');
      return;
    }
    setData((previous) => ({
      ...previous,
      saved: exists
        ? previous.saved.filter((item) => item.id !== result.id)
        : [...previous.saved, result],
    }));
    setNotice(
      exists
        ? 'Hasil dihapus dari simpanan.'
        : 'Hasil disimpan di perangkat ini.',
    );
  }
  async function copy(result: SearchResult) {
    if ('isResearchOnly' in result) {
      setNotice(
        'Pilot riset tidak disalin atau didistribusikan. Gunakan tautan sumber untuk pemeriksaan.',
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(
        isTextResult(result)
          ? `${result.collection} · ${result.hadithNumber} (${result.citation.numberingScheme})\n${result.arabicText}\n${result.translation}\nTerjemahan: ${result.translationAttribution}\n${result.grade ? `Derajat: ${result.grade} — ${result.grader}\n${result.gradingSourceUrl}\n` : ''}${result.referenceUrl}\n${result.provenance.attribution}`
          : `DATA SIMULASI — BUKAN HADITS TERVERIFIKASI\n${result.title}\n${result.collection}\n${result.excerpt}\nNomor, teks Arab, terjemahan, derajat, dan rujukan belum tersedia. Tidak untuk dikutip sebagai hadits.`,
      );
      setNotice(
        isTextResult(result)
          ? 'Kutipan dan referensi disalin.'
          : 'Contoh disalin beserta label simulasi.',
      );
    } catch {
      setNotice(
        'Tidak dapat menyalin. Izinkan akses clipboard atau pilih teks secara manual.',
      );
    }
  }
  function clearAll() {
    cancelCurrent();
    setData((previous) => ({ ...previous, history: [], saved: [] }));
    setActiveId(null);
    setLastReveal(null);
    setView('search');
    setNotice('Riwayat dan simpanan lokal dihapus.');
  }
  return {
    data,
    setData,
    hydrated,
    storageWarning,
    activeId,
    active,
    view,
    notice,
    lastReveal,
    search,
    newChat,
    select,
    showSaved,
    toggleSave,
    copy,
    clearAll,
    cancel: () => currentRequest.current?.abort(),
  };
}
