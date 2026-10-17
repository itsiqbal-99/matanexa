import { z } from 'zod';

// Shared by DTO validation and the mock retriever; no semantic model involved.
export function normalizeQuery(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('id');
}

export const searchSchema = z
  .object({
    query: z
      .string()
      .max(2400)
      .refine((query) => {
        const length = [...normalizeQuery(query)].length;
        return length >= 3 && length <= 300;
      }),
    page: z.number().int().min(1).max(10).default(1),
    limit: z.number().int().min(1).max(20).default(10),
    filters: z
      .object({
        sourceSlugs: z
          .array(z.string().min(1).max(64))
          .max(20)
          .refine((values) => new Set(values).size === values.length)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SearchDto = z.infer<typeof searchSchema>;
