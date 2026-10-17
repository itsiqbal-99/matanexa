import { Injectable } from '@nestjs/common';
import { containsTerm } from './query-normalizer';
import { EQUIVALENT_RULES, TOPIC_RULES } from './search-vocabulary';
@Injectable()
export class SynonymService {
  expand(normalized: string) {
    const nonParentContext = ['ibu kota', 'ibu jari'].some((term) =>
      containsTerm(normalized, term),
    );
    const topics = TOPIC_RULES.filter((rule) =>
      rule.triggers.some(
        (trigger) =>
          !(rule.id === 'parents' && trigger === 'ibu' && nonParentContext) &&
          containsTerm(normalized, trigger),
      ),
    );
    const equivalents = new Set<string>();
    for (const rule of EQUIVALENT_RULES) {
      if (rule.context && !topics.some((topic) => topic.id === rule.context))
        continue;
      if (rule.terms.some((term) => containsTerm(normalized, term)))
        rule.terms
          .filter((term) => !containsTerm(normalized, term))
          .forEach((term) => equivalents.add(term));
    }
    const related = new Set<string>(
      topics.flatMap((topic) => [...topic.related]),
    );
    // Auditable retrieval cues, not generated answers or hadith labels.
    const intentPhrases: string[] = [];
    if (
      topics.some((topic) => topic.id === 'eating') &&
      containsTerm(normalized, 'tangan')
    ) {
      intentPhrases.push('tangan kanan', 'tangan kiri');
    }
    if (
      topics.some((topic) => topic.id === 'eating') &&
      ['bismillah', 'bismilillah', 'basmalah'].some((term) =>
        containsTerm(normalized, term),
      )
    ) {
      intentPhrases.push('bismillah', 'bismilillah', 'basmalah');
    }
    if (
      topics.some((topic) => topic.id === 'speech') &&
      ['menjaga', 'ucapan', 'lisan', 'perkataan'].some((term) =>
        containsTerm(normalized, term),
      )
    ) {
      intentPhrases.push('berkata baik', 'atau diam', 'menjaga lisan');
    }
    if (topics.some((topic) => topic.id === 'anger')) {
      intentPhrases.push(
        'janganlah kamu marah',
        'menahan amarah',
        'menguasai dirinya ketika marah',
      );
    }
    if (
      topics.some((topic) => topic.id === 'eating') &&
      ['lauk', 'jauh', 'dekat'].some((term) => containsTerm(normalized, term))
    ) {
      ['makanan', 'di hadapan', 'terdekat'].forEach((term) =>
        related.add(term),
      );
      intentPhrases.push('di hadapan', 'yang terdekat');
    }
    intentPhrases.forEach((term) => related.add(term));
    equivalents.forEach((term) => related.delete(term));
    return {
      topicSlugs: topics.map((topic) => topic.id),
      intentPhrases,
      equivalents: [...equivalents].slice(0, 20),
      related: [...related]
        .filter((term) => !containsTerm(normalized, term))
        .slice(0, 30),
    };
  }
}
