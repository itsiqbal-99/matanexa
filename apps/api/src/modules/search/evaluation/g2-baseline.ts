// Frozen G2 algorithm for a comparable synthetic baseline. Not used by the API.
import { normalizeQuery } from '../search.schema';
const groups = [
  ['ilmu', 'belajar', 'pengetahuan', 'pendidikan'],
  ['sedekah', 'infak', 'infaq', 'donasi'],
  ['marah', 'amarah', 'emosi'],
  ['lisan', 'bicara', 'berkata', 'ucapan'],
  ['orangtua', 'ibu', 'ayah'],
];
const filler = new Set([
  'kasih',
  'beri',
  'berikan',
  'hadits',
  'hadis',
  'tentang',
  'tolong',
  'cari',
  'carikan',
  'ada',
  'apa',
  'yang',
  'dan',
  'dalam',
  'islam',
  'menuntut',
]);
export function baselineTerms(query: string): string {
  const words = (normalizeQuery(query).match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (word) => word.length <= 100,
  );
  const terms = new Set(words.filter((word) => !filler.has(word)));
  for (const group of groups)
    if (group.some((word) => terms.has(word)))
      group.forEach((word) => terms.add(word));
  return [...terms].slice(0, 40).join(' | ');
}
export const G2_BASELINE_SQL = `WITH q AS (SELECT to_tsquery('simple',$1) AS terms)
  SELECT h.*,ts_rank_cd(search_document,q.terms) AS lexical_rank,similarity(normalized_translation,$2) AS typo_rank
  FROM pg_temp.matanexa_eval_documents h CROSS JOIN q
  WHERE h.search_document @@ q.terms OR h.normalized_translation % $2
  ORDER BY lexical_rank DESC,typo_rank DESC,source_slug,numbering_scheme,hadith_number,id LIMIT 20`;
