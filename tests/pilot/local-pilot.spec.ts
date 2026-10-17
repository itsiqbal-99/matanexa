import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('real pilot: three natural queries, paired original text, RTL and no persisted corpus', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const dataset = JSON.parse(
    await readFile('data/local-pilot/fawaz/pilot.json', 'utf8'),
  ) as {
    records: {
      hadithNumber: string;
      arabicText: string;
      indonesianText: string;
    }[];
  };
  await page.goto('/');
  for (const [query, number] of [
    ['Saya mau tahu hadits tentang makan dengan tangan kanan.', '5376'],
    ['Saya ingin tahu hadits tentang menahan amarah.', '6116'],
    ['Kenapa kita harus mendahulukan ibu daripada ayah?', '5971'],
  ]) {
    await page.getByLabel('Pertanyaan pencarian hadits').fill(query);
    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/v1/search') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Kirim pertanyaan' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      meta: { dataScope: string; modeUsed: string };
      data: { results: { hadithNumber: string }[] };
    };
    expect(body.meta.dataScope).toBe('local_pilot');
    if (process.env.PILOT_EXPECT_MODE) {
      expect(body.meta.modeUsed).toBe(process.env.PILOT_EXPECT_MODE);
      if (process.env.PILOT_EXPECT_MODE === 'hybrid')
        await expect(
          page.getByText('Mode hybrid', { exact: true }),
        ).toBeVisible();
    }
    expect(
      body.data.results.slice(0, 5).some((r) => r.hadithNumber === number),
    ).toBe(true);
    const card = page
      .locator('.result-card')
      .filter({ hasText: `No. ${number} ·` });
    await expect(card).toBeVisible();
    await expect(
      card.getByText('Pilot riset lokal', { exact: true }),
    ).toBeVisible();
    if (number === '5376') {
      await card.getByRole('button', { name: /Simpan kutipan/ }).click();
      await expect(
        page.getByText(
          'Simpanan permanen dinonaktifkan untuk data pilot riset lokal.',
          { exact: true },
        ),
      ).toBeVisible();
      await card.getByRole('button', { name: /Salin kutipan/ }).click();
      await expect(
        page.getByText(
          'Pilot riset tidak disalin atau didistribusikan. Gunakan tautan sumber untuk pemeriksaan.',
          { exact: true },
        ),
      ).toBeVisible();
    }
    await card.getByRole('button', { name: 'Lihat detail' }).click();
    const dialog = page.getByRole('dialog', { name: 'Detail hadits' });
    await expect(dialog).toBeVisible();
    const original = dataset.records.find((r) => r.hadithNumber === number)!;
    await expect(dialog.locator('.arabic-text')).toHaveText(
      original.arabicText,
    );
    await expect(dialog.locator('.arabic-text')).toHaveAttribute('dir', 'rtl');
    await expect(
      dialog.getByText(original.indonesianText, { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText('Riset lokal · izin publikasi belum tuntas', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog
        .locator('.detail-metadata')
        .getByText('Belum tersedia', { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/g26/${info.project.name}-${number}.png`,
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'fawaz-bukhari-local',
  );
  expect(errors).toEqual([]);
});
