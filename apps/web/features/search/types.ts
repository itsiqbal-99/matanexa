import type {
  ResearchResult,
  SearchResponse,
  SearchResult,
  VerifiedResult,
} from '@matanexa/contracts';

export type {
  MockResult,
  ResearchResult,
  SearchResponse,
  SearchResult,
  VerifiedResult,
} from '@matanexa/contracts';

export function isTextResult(
  result: SearchResult,
): result is VerifiedResult | ResearchResult {
  return (
    result.isVerified || ('isResearchOnly' in result && result.isResearchOnly)
  );
}
export interface Conversation {
  id: string;
  query: string;
  createdAt: string;
  status: 'loading' | 'success' | 'error' | 'aborted';
  response?: SearchResponse;
  error?: string;
  sourceSlug: string;
  sources: { slug: string; label: string }[];
}
export interface WorkspaceData {
  history: Conversation[];
  saved: SearchResult[];
  theme: 'light' | 'dark';
  showArabic: boolean;
}
