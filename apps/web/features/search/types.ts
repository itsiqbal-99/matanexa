export interface MockResult {
  id: string;
  title: string;
  excerpt: string;
  citation: { collection: string; number: 'MOCK'; numberingScheme: 'mock' };
  collection: string;
  sourceSlug: string;
  hadithNumber: null;
  arabicText: null;
  translation: null;
  grade: null;
  sourceUrl: null;
  referenceUrl: null;
  isVerified: false;
}
export interface SearchResponse {
  data: { query: string; results: SearchResult[]; totalCandidates: number };
  meta: {
    page: number;
    limit: number;
    hasMore: boolean;
    modeUsed: 'mock' | 'lexical' | 'hybrid' | 'lexical_fallback';
    dataScope?: 'local_pilot';
    fallbackReason?: string;
    requestId: string;
    queryStatus?: 'ready' | 'ambiguous';
  };
}
export interface VerifiedResult {
  id: string;
  title: string;
  excerpt: string;
  citation: { collection: string; number: string; numberingScheme: string };
  collection: string;
  sourceSlug: string;
  hadithNumber: string;
  numberingScheme: string;
  bookName: string;
  chapterName: string | null;
  narrator: string | null;
  arabicText: string;
  translation: string;
  indonesianText: string;
  translationAttribution: string;
  grade: string | null;
  grader: string | null;
  gradingSourceUrl: string | null;
  sourceUrl: string;
  referenceUrl: string;
  isVerified: true;
  verificationReferenceUrl: string;
  provenance: {
    sourceName: string;
    attribution: string;
    licenseName: string;
    licenseUrl: string;
  };
}
export type ResearchResult = Omit<
  VerifiedResult,
  'isVerified' | 'verificationReferenceUrl'
> & {
  isVerified: false;
  isResearchOnly: true;
  verificationReferenceUrl: null;
};
export type SearchResult = MockResult | VerifiedResult | ResearchResult;
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
