import type {
  MockResult,
  VerifiedResult,
  SearchResult,
  SearchResponse,
  ResearchResult,
} from '../features/search/types';

export class ApiError extends Error {
  constructor(
    public readonly kind:
      'aborted' | 'timeout' | 'network' | 'invalid' | 'server',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isMockResult(value: unknown): value is MockResult {
  if (!record(value) || !record(value.citation)) return false;
  return (
    typeof value.id === 'string' &&
    /^mock-[a-z]+-[12]$/.test(value.id) &&
    typeof value.title === 'string' &&
    value.title.length <= 200 &&
    typeof value.excerpt === 'string' &&
    value.excerpt.length <= 2000 &&
    typeof value.collection === 'string' &&
    value.collection.length <= 100 &&
    typeof value.sourceSlug === 'string' &&
    ['mock-a', 'mock-b'].includes(value.sourceSlug) &&
    value.citation.collection === value.collection &&
    value.citation.number === 'MOCK' &&
    value.citation.numberingScheme === 'mock' &&
    value.isVerified === false &&
    [
      'hadithNumber',
      'arabicText',
      'translation',
      'grade',
      'sourceUrl',
      'referenceUrl',
    ].every((field) => value[field] === null)
  );
}
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function isVerifiedResult(value: unknown): value is VerifiedResult {
  if (!record(value) || !record(value.citation) || !record(value.provenance))
    return false;
  const nonempty = (field: unknown, max = 50000) =>
    typeof field === 'string' && field.trim().length > 0 && field.length <= max;
  const citation = value.citation;
  return (
    value.isVerified === true &&
    typeof value.id === 'string' &&
    /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
      value.id,
    ) &&
    [
      'title',
      'collection',
      'hadithNumber',
      'bookName',
      'translationAttribution',
    ].every((key) => nonempty(value[key], 200)) &&
    typeof value.sourceSlug === 'string' &&
    /^[a-z0-9][a-z0-9-]{0,63}$/.test(value.sourceSlug) &&
    nonempty(value.excerpt, 500) &&
    nonempty(value.arabicText) &&
    nonempty(value.translation) &&
    value.translation === value.indonesianText &&
    citation.collection === value.collection &&
    citation.number === value.hadithNumber &&
    citation.numberingScheme === value.numberingScheme &&
    nonempty(citation.numberingScheme, 200) &&
    ['chapterName', 'narrator'].every(
      (key) => value[key] === null || nonempty(value[key], 200),
    ) &&
    ['sourceUrl', 'referenceUrl', 'verificationReferenceUrl'].every((key) =>
      isSafeUrl(value[key]),
    ) &&
    ['sourceName', 'attribution', 'licenseName'].every((key) =>
      nonempty((value.provenance as Record<string, unknown>)[key], 2000),
    ) &&
    isSafeUrl(value.provenance.licenseUrl) &&
    ((value.grade === null &&
      value.grader === null &&
      value.gradingSourceUrl === null) ||
      (nonempty(value.grade, 200) &&
        nonempty(value.grader, 200) &&
        isSafeUrl(value.gradingSourceUrl)))
  );
}
export function isSearchResult(value: unknown): value is SearchResult {
  return (
    isMockResult(value) || isVerifiedResult(value) || isResearchResult(value)
  );
}
export function isResearchResult(value: unknown): value is ResearchResult {
  if (
    !record(value) ||
    value.isVerified !== false ||
    value.isResearchOnly !== true ||
    value.verificationReferenceUrl !== null ||
    value.sourceSlug !== 'fawaz-bukhari-local' ||
    value.grade !== null ||
    value.grader !== null ||
    value.gradingSourceUrl !== null
  )
    return false;
  // Reuse strict text/citation/URL validation; never change the actual payload's status.
  return isVerifiedResult({
    ...value,
    isVerified: true,
    verificationReferenceUrl: value.referenceUrl,
  });
}
export function isSearchResponse(value: unknown): value is SearchResponse {
  if (!record(value) || !record(value.data) || !record(value.meta))
    return false;
  const { data, meta } = value;
  return (
    typeof data.query === 'string' &&
    data.query.length <= 2400 &&
    Array.isArray(data.results) &&
    data.results.length <= 20 &&
    data.results.every(
      meta.modeUsed === 'mock'
        ? isMockResult
        : meta.dataScope === 'local_pilot'
          ? isResearchResult
          : isVerifiedResult,
    ) &&
    Number.isInteger(data.totalCandidates) &&
    Number(data.totalCandidates) >= data.results.length &&
    ['mock', 'lexical', 'hybrid', 'lexical_fallback'].includes(
      String(meta.modeUsed),
    ) &&
    (meta.dataScope === undefined || meta.dataScope === 'local_pilot') &&
    (meta.queryStatus === undefined ||
      (meta.modeUsed !== 'mock' &&
        ['ready', 'ambiguous'].includes(String(meta.queryStatus)))) &&
    typeof meta.requestId === 'string' &&
    Number.isInteger(meta.page) &&
    Number(meta.page) >= 1 &&
    Number(meta.page) <= 10 &&
    Number.isInteger(meta.limit) &&
    Number(meta.limit) >= 1 &&
    Number(meta.limit) <= 20 &&
    typeof meta.hasMore === 'boolean'
  );
}
export async function searchApi(
  query: string,
  options: {
    signal: AbortSignal;
    page?: number;
    sourceSlug?: string;
    timeoutMs?: number;
  },
): Promise<SearchResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (options.signal.aborted)
    throw new ApiError('aborted', 'Pencarian dibatalkan.');
  options.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 10000);
  try {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
    const response = await fetch(`${base}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        query,
        page: options.page ?? 1,
        limit: 10,
        ...(options.sourceSlug
          ? { filters: { sourceSlugs: [options.sourceSlug] } }
          : {}),
      }),
    });
    if (!response.ok)
      throw new ApiError(
        'server',
        response.status === 400
          ? 'Pertanyaan harus 3–300 karakter. Periksa lalu kirim kembali.'
          : response.status === 503
            ? 'Database tidak tersedia. Periksa koneksi layanan lalu coba lagi.'
            : 'Layanan pencarian sedang bermasalah. Coba lagi sebentar.',
      );
    const payload: unknown = await response.json();
    if (!isSearchResponse(payload))
      throw new ApiError(
        'invalid',
        'Respons pencarian tidak dapat dibaca. Coba lagi.',
      );
    return payload;
  } catch (error) {
    if (timedOut)
      throw new ApiError(
        'timeout',
        'Pencarian terlalu lama. Periksa koneksi lalu coba lagi.',
      );
    if (controller.signal.aborted)
      throw new ApiError('aborted', 'Pencarian dibatalkan.');
    if (error instanceof ApiError) throw error;
    if (error instanceof SyntaxError)
      throw new ApiError(
        'invalid',
        'Respons pencarian tidak dapat dibaca. Coba lagi.',
      );
    throw new ApiError(
      'network',
      'Tidak dapat terhubung ke layanan pencarian. Pastikan API lokal berjalan lalu coba lagi.',
    );
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener('abort', abort);
  }
}
