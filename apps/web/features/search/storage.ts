import { isSearchResult, isSearchResponse } from '../../lib/api-client';
import type { Conversation, WorkspaceData } from './types';
export const STORAGE_KEY = 'matanexa.workspace.v1';
export async function readWorkspace(): Promise<{
  data: WorkspaceData;
  unavailable: boolean;
}> {
  const defaults: WorkspaceData = {
    history: [],
    saved: [],
    theme: matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
    showArabic: true,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: defaults, unavailable: false };
    if (raw.length > 1500000) throw new Error('Stored data too large');
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== 'object' ||
      value === null ||
      !('history' in value) ||
      !('saved' in value)
    )
      throw new Error('Invalid storage');
    const input = value as Record<string, unknown>;
    const history: Conversation[] = [];
    if (Array.isArray(input.history))
      for (const item of input.history.slice(0, 20)) {
        if (item?.response?.meta?.dataScope === 'local_pilot') continue;
        if (
          typeof item !== 'object' ||
          !item ||
          typeof item.id !== 'string' ||
          typeof item.query !== 'string' ||
          [...item.query].length > 300 ||
          typeof item.createdAt !== 'string'
        )
          continue;
        history.push({
          id: item.id,
          query: item.query,
          createdAt: item.createdAt,
          status: isSearchResponse(item.response) ? 'success' : 'aborted',
          ...(isSearchResponse(item.response)
            ? { response: item.response }
            : {}),
          sourceSlug:
            typeof item.sourceSlug === 'string' &&
            /^[a-z0-9][a-z0-9-]{0,63}$/.test(item.sourceSlug)
              ? item.sourceSlug
              : '',
          sources: Array.isArray(item.sources)
            ? item.sources
                .filter(
                  (source: unknown) =>
                    typeof source === 'object' &&
                    source !== null &&
                    'slug' in source &&
                    'label' in source &&
                    typeof source.slug === 'string' &&
                    /^[a-z0-9][a-z0-9-]{0,63}$/.test(source.slug) &&
                    typeof source.label === 'string' &&
                    source.label.length <= 100,
                )
                .slice(0, 20)
            : [],
        });
      }
    return {
      data: {
        history,
        saved: Array.isArray(input.saved)
          ? input.saved
              .filter(isSearchResult)
              .filter((result) => !('isResearchOnly' in result))
              .slice(0, 100)
          : [],
        theme: input.theme === 'dark' ? 'dark' : 'light',
        showArabic: input.showArabic !== false,
      },
      unavailable: false,
    };
  } catch {
    return { data: defaults, unavailable: true };
  }
}
export async function writeWorkspace(data: WorkspaceData): Promise<boolean> {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...data,
        history: data.history.filter(
          (item) => item.response?.meta.dataScope !== 'local_pilot',
        ),
        saved: data.saved.filter((item) => !('isResearchOnly' in item)),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
