import { Injectable } from '@nestjs/common';
import { QueryNormalizer } from './query-normalizer';
import { SynonymService } from './synonym.service';
import {
  CONVERSATIONAL_STOPWORDS,
  GENERIC_TERMS,
  NEGATIONS,
  TOPIC_RULES,
} from './search-vocabulary';
export interface QueryAnalysis {
  original: string;
  normalized: string;
  tokens: string[];
  primaryTerms: string[];
  anchorTerms: string[];
  equivalents: string[];
  related: string[];
  phrases: string[];
  topicSlugs: string[];
  negations: string[];
  ambiguous: boolean;
  corrections: { from: string; to: string }[];
}
@Injectable()
export class QueryAnalyzer {
  constructor(
    private readonly normalizer: QueryNormalizer,
    private readonly synonyms: SynonymService,
  ) {}
  analyze(original: string): QueryAnalysis {
    const normalized = this.normalizer.normalize(original);
    const meaningful = normalized.tokens.filter(
      (token) => !CONVERSATIONAL_STOPWORDS.has(token),
    );
    const negations = [
      ...new Set(meaningful.filter((token) => NEGATIONS.has(token))),
    ];
    const primaryTerms = [
      ...new Set(
        meaningful.filter(
          (token) =>
            !NEGATIONS.has(token) &&
            !GENERIC_TERMS.has(token) &&
            token.length <= 100,
        ),
      ),
    ].slice(0, 24);
    const expansion = this.synonyms.expand(normalized.normalized);
    const knownPhrases = TOPIC_RULES.flatMap((rule) => [
      ...rule.triggers,
      ...rule.related,
    ]).filter(
      (term) =>
        term.includes(' ') &&
        ` ${normalized.normalized} `.includes(` ${term} `),
    );
    const corePhrase = meaningful.join(' ');
    const phrases = [
      ...new Set([
        ...(meaningful.length > 1 ? [corePhrase] : []),
        ...knownPhrases,
        ...expansion.intentPhrases,
      ]),
    ].slice(0, 8);
    const ambiguous =
      !expansion.topicSlugs.length &&
      !primaryTerms.some((term) => !GENERIC_TERMS.has(term));
    const anchorTerms = primaryTerms.filter((term) => !GENERIC_TERMS.has(term));
    return {
      ...normalized,
      ...expansion,
      primaryTerms,
      anchorTerms,
      phrases,
      negations,
      ambiguous,
    };
  }
}
