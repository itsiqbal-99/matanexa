import { Injectable } from '@nestjs/common';
import { normalizeQuery } from './search.schema';
import { INFORMAL_ALIASES, TYPO_ALIASES } from './search-vocabulary';

export function normalizeSearchText(value: string): string {
  return normalizeQuery(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .split(' ')
    .map((token) => {
      const known = [
        'ibu',
        'ayah',
        'bapak',
        'niat',
        'kanan',
        'lisan',
        'ucapan',
        'perkataan',
        'amarah',
        'sedekah',
        'hadapan',
        'tua',
        'makan',
      ];
      return (
        known.find((root) =>
          ['mu', 'ku', 'nya', 'lah'].some((suffix) => token === root + suffix),
        ) ?? token
      );
    })
    .join(' ');
}
// Exclude the narrator prefix when a quotation starts. Keep the entire remaining
// text: source punctuation can contain nested or unbalanced quotation marks.
// Original text/raw_record/display are never rewritten.
export function normalizeIndexText(original: string): string {
  const copy = original.replace(/[“”]/g, '"');
  const start = copy.indexOf('"');
  return normalizeSearchText(start >= 0 ? copy.slice(start + 1) : original);
}
export function containsTerm(text: string, term: string): boolean {
  return ` ${text} `.includes(` ${term} `);
}
@Injectable()
export class QueryNormalizer {
  normalize(original: string) {
    const corrections: { from: string; to: string }[] = [];
    const tokens = normalizeSearchText(original)
      .split(' ')
      .filter(Boolean)
      .flatMap((token) => {
        const replacement =
          INFORMAL_ALIASES[token] ?? TYPO_ALIASES[token] ?? token;
        if (replacement !== token)
          corrections.push({ from: token, to: replacement });
        return replacement.split(' ');
      });
    return { original, normalized: tokens.join(' '), tokens, corrections };
  }
}
