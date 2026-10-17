import { Injectable } from '@nestjs/common';
import { normalizeQuery } from './search.schema';

const topics = [
  {
    id: 'knowledge',
    title: 'Menuntut ilmu',
    keywords: ['ilmu', 'belajar', 'pendidikan', 'pengetahuan', 'sekolah'],
  },
  {
    id: 'parents',
    title: 'Berbakti kepada orang tua',
    keywords: [
      'orang tua',
      'orangtua',
      'ibu',
      'ayah',
      'berbakti',
      'bapak',
      'mama',
      'papa',
    ],
  },
  {
    id: 'anger',
    title: 'Marah dan pengendalian emosi',
    keywords: ['marah', 'emosi', 'amarah', 'kesal', 'mengamuk'],
  },
  {
    id: 'eating',
    title: 'Adab makan',
    keywords: ['makan', 'minum', 'tangan kanan', 'santap'],
  },
  {
    id: 'speech',
    title: 'Menjaga lisan',
    keywords: [
      'lisan',
      'bicara',
      'berbicara',
      'berkata',
      'ucapan',
      'gosip',
      'bohong',
      'diam',
      'ghibah',
    ],
  },
  {
    id: 'charity',
    title: 'Keutamaan sedekah',
    keywords: ['sedekah', 'bersedekah', 'berbagi', 'donasi', 'infak', 'infaq'],
  },
] as const;

export interface MockResult {
  id: string;
  title: string;
  excerpt: string;
  citation: { collection: string; number: 'MOCK'; numberingScheme: 'mock' };
  sourceSlug: string;
  collection: string;
  hadithNumber: null;
  arabicText: null;
  translation: null;
  grade: null;
  sourceUrl: null;
  referenceUrl: null;
  isVerified: false;
}

@Injectable()
export class MockRepository {
  find(query: string, sourceSlugs?: string[]): MockResult[] {
    const text = ` ${normalizeQuery(query).replace(/[^\p{L}\p{N}\s]/gu, ' ')} `;
    const ranked = topics
      .map((topic) => ({
        topic,
        score: topic.keywords.reduce(
          (score, keyword) =>
            score +
            (text.includes(` ${keyword} `) ? keyword.split(' ').length : 0),
          0,
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) => b.score - a.score || a.topic.id.localeCompare(b.topic.id),
      );
    return ranked
      .flatMap(({ topic }) =>
        [1, 2].map((variant): MockResult => ({
          id: `mock-${topic.id}-${variant}`,
          title:
            variant === 1 ? topic.title : `${topic.title} — contoh tambahan`,
          excerpt: `Data simulasi untuk topik ${topic.title.toLocaleLowerCase('id')}. Teks ini hanya menjelaskan contoh hasil antarmuka dan bukan kutipan atau penjelasan hadits.`,
          citation: {
            collection:
              variant === 1 ? 'Koleksi simulasi A' : 'Koleksi simulasi B',
            number: 'MOCK',
            numberingScheme: 'mock',
          },
          sourceSlug: variant === 1 ? 'mock-a' : 'mock-b',
          collection:
            variant === 1 ? 'Koleksi simulasi A' : 'Koleksi simulasi B',
          hadithNumber: null,
          arabicText: null,
          translation: null,
          grade: null,
          sourceUrl: null,
          referenceUrl: null,
          isVerified: false,
        })),
      )
      .filter(
        (item) => !sourceSlugs?.length || sourceSlugs.includes(item.sourceSlug),
      );
  }
}
