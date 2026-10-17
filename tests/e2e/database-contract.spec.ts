import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Contract fixture only: no real Arabic, translation, grade, or source claim.
function payload() {
  return {
    data: {
      query: 'ilmu',
      totalCandidates: 1,
      results: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'SIMULASI KONTRAK G2',
          excerpt: 'SIMULASI — BUKAN KUTIPAN HADITS',
          citation: {
            collection: 'SIMULASI KOLEKSI',
            number: 'SIMULASI-1a',
            numberingScheme: 'SIMULASI-V1',
          },
          collection: 'SIMULASI KOLEKSI',
          sourceSlug: 'simulation-source',
          hadithNumber: 'SIMULASI-1a',
          numberingScheme: 'SIMULASI-V1',
          bookName: 'SIMULASI KONTRAK G2',
          chapterName: null,
          narrator: null,
          arabicText: 'SIMULASI — PLACEHOLDER BUKAN TEKS ARAB',
          translation: 'SIMULASI — PLACEHOLDER BUKAN TERJEMAHAN',
          indonesianText: 'SIMULASI — PLACEHOLDER BUKAN TERJEMAHAN',
          translationAttribution: 'SIMULASI ATRIBUSI',
          grade: null,
          grader: null,
          gradingSourceUrl: null,
          sourceUrl: 'https://example.invalid/simulation',
          referenceUrl: 'https://example.invalid/record',
          verificationReferenceUrl: 'https://example.invalid/review',
          isVerified: true,
          provenance: {
            sourceName: 'SIMULASI SUMBER',
            attribution: 'SIMULASI HANYA PENGUJIAN',
            licenseName: 'SIMULASI LISENSI',
            licenseUrl: 'https://example.invalid/license',
          },
        },
      ],
    },
    meta: {
      page: 1,
      limit: 10,
      hasMore: false,
      modeUsed: 'lexical',
      requestId: 'simulation-test',
    },
  };
}
test('lexical contract fixture renders citation, RTL, provenance, copy and persistence', async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/api/v1/search', (route) =>
    route.fulfill({ json: payload() }),
  );
  await page.goto('/');
  await page.getByLabel('Pertanyaan pencarian hadits').fill('ilmu');
  await page.getByRole('button', { name: 'Kirim pertanyaan' }).click();
  const article = page.getByRole('article', { name: 'SIMULASI KONTRAK G2' });
  await expect(article).toBeVisible();
  await expect(page.getByText('Mode lexical', { exact: true })).toBeVisible();
  await expect(article.getByText(/No. SIMULASI-1a/)).toBeVisible();
  await article.getByRole('button', { name: /Simpan kutipan/ }).click();
  await article.getByRole('button', { name: /Lihat detail/ }).click();
  const detail = page.getByRole('dialog', { name: 'Detail hadits' });
  await expect(detail.locator('[lang="ar"]')).toHaveAttribute('dir', 'rtl');
  await expect(
    detail.getByText('SIMULASI ATRIBUSI', { exact: false }),
  ).toBeVisible();
  await expect(
    detail.getByRole('link', { name: 'Buka rujukan' }),
  ).toHaveAttribute('href', 'https://example.invalid/record');
  await expect(
    detail.getByRole('link', { name: 'Rujukan penilai' }),
  ).toHaveCount(0);
  await detail.getByRole('button', { name: 'Salin kutipan' }).click();
  const copy = await page.evaluate(() => navigator.clipboard.readText());
  expect(copy).toContain('SIMULASI-1a (SIMULASI-V1)');
  expect(copy).toContain('SIMULASI ATRIBUSI');
  await mkdir('artifacts/ui-redesign', { recursive: true });
  await page.screenshot({
    path: `artifacts/ui-redesign/regression-${info.project.name}-contract-fixture.png`,
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await page.reload();
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Buka navigasi' }).click();
  await page
    .getByRole('navigation', { name: 'Riwayat percakapan' })
    .getByRole('button', { name: 'ilmu', exact: true })
    .click();
  await expect(article).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('lexical rejects unsafe URLs and incomplete grading; reports DB errors', async ({
  page,
}) => {
  let body = payload();
  await page.route('**/api/v1/search', (route) =>
    route.fulfill({ json: body }),
  );
  await page.goto('/');
  const submit = async () => {
    await page.getByLabel('Pertanyaan pencarian hadits').fill('ilmu');
    await page.getByRole('button', { name: 'Kirim pertanyaan' }).click();
  };
  body.data.results[0].referenceUrl = 'javascript:alert(1)';
  await submit();
  await expect(
    page.getByText('Respons pencarian tidak dapat dibaca. Coba lagi.'),
  ).toBeVisible();
  body = payload();
  Object.assign(body.data.results[0], {
    grade: 'SIMULASI — BUKAN DERAJAT HADITS',
  });
  await submit();
  await expect(
    page.getByText('Respons pencarian tidak dapat dibaca. Coba lagi.'),
  ).toBeVisible();
  await page.unroute('**/api/v1/search');
  await page.route('**/api/v1/search', (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database tidak tersedia.',
          requestId: 'simulation',
        },
      },
    }),
  );
  await submit();
  await expect(
    page.getByText(
      'Database tidak tersedia. Periksa koneksi layanan lalu coba lagi.',
    ),
  ).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(0);
});

test('lexical ambiguity requests clarification and preserves original user wording', async ({
  page,
}) => {
  const original = 'Minta DONG hadist tentang ini!';
  await page.route('**/api/v1/search', (route) =>
    route.fulfill({
      json: {
        data: { query: original, results: [], totalCandidates: 0 },
        meta: {
          page: 1,
          limit: 10,
          hasMore: false,
          modeUsed: 'lexical',
          queryStatus: 'ambiguous',
          requestId: 'simulation-ambiguity',
        },
      },
    }),
  );
  await page.goto('/');
  await page.getByLabel('Pertanyaan pencarian hadits').fill(original);
  await page.getByRole('button', { name: 'Kirim pertanyaan' }).click();
  await expect(page.locator('.user-query')).toHaveText(original);
  await expect(
    page.getByRole('heading', { name: 'Perjelas topik pencarian.' }),
  ).toBeVisible();
  await expect(page.getByText(/Sebutkan topik atau kata utama/)).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(0);
});
