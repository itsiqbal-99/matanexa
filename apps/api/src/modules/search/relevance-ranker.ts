import { Injectable } from '@nestjs/common';
export const RANKING_VERSION = 'lexical-signals-v2';
export interface RankingSignals {
  primary: number;
  phrase: number;
  equivalent: number;
  topic: number;
  related: number;
  chapter: number;
  fts: number;
  typo: number;
  negation: number;
  negationMissing: number;
}
export const WEIGHT_PROFILES: Readonly<Record<string, RankingSignals>> = {
  balanced: {
    primary: 12,
    phrase: 8,
    equivalent: 4,
    topic: 4,
    related: 0.8,
    chapter: 2,
    fts: 2,
    typo: 1.5,
    negation: 2,
    negationMissing: -1,
  },
  coverage: {
    primary: 16,
    phrase: 4,
    equivalent: 5,
    topic: 2,
    related: 0.5,
    chapter: 1,
    fts: 2,
    typo: 1.5,
    negation: 2,
    negationMissing: -1,
  },
  phrase: {
    primary: 8,
    phrase: 12,
    equivalent: 3,
    topic: 5,
    related: 0.5,
    chapter: 3,
    fts: 1,
    typo: 1,
    negation: 3,
    negationMissing: -2,
  },
};
@Injectable()
export class RelevanceRanker {
  readonly weights = WEIGHT_PROFILES.balanced;
  score(
    signals: RankingSignals,
    weights: RankingSignals = this.weights,
    documentLength = 0,
  ): number {
    return (Object.keys(signals) as (keyof RankingSignals)[]).reduce(
      (sum, key) =>
        sum +
        (signals[key] * weights[key]) /
          (key === 'primary' || key === 'equivalent'
            ? 1 + documentLength / 600
            : 1),
      0,
    );
  }
}
