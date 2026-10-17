import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const api = '**/api/v1/search';
const key = 'matanexa.workspace.v1';
const pageErrors = new WeakMap<Page, string[]>();
async function navigate(page: Page, name: string, history = false) {
  const menu = page.getByRole('button', { name: 'Buka navigasi' });
  if (await menu.isVisible()) await menu.click();
  const region = history
    ? page.getByRole('navigation', { name: 'Riwayat percakapan' })
    : page;
  await region.getByRole('button', { name, exact: true }).click();
}
async function submit(page: Page, query: string) {
  await page.getByLabel('Pertanyaan pencarian hadits').fill(query);
  await page.getByRole('button', { name: 'Kirim pertanyaan' }).click();
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('button', {
      name: 'Hadits tentang menuntut ilmu',
      exact: true,
    }),
  ).toBeEnabled();
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test('welcome, layout, theme and screenshots', async ({ page }, info) => {
  await expect(
    page.getByRole('heading', { name: /Cari hadits dengan/ }),
  ).toBeVisible();
  await expect(page.locator('.suggestions button')).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir('artifacts/ui-redesign', { recursive: true });
  await page.screenshot({
    path: `artifacts/ui-redesign/regression-${info.project.name}-welcome.png`,
    fullPage: true,
  });
  if (info.project.name === 'mobile') {
    await page.setViewportSize({ width: 360, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: 'artifacts/ui-redesign/regression-mobile-360.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  if (info.project.name === 'desktop') {
    await page.getByRole('button', { name: 'Tutup sidebar' }).click();
    await expect(
      page.getByRole('button', { name: 'Buka sidebar' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Buka sidebar' }).click();
  } else {
    await page.getByRole('button', { name: 'Buka navigasi' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigasi' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Aktifkan tema gelap' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: `artifacts/ui-redesign/regression-${info.project.name}-dark.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await navigate(page, 'Pengaturan');
  await page.getByLabel('Tampilkan bagian teks Arab').uncheck();
  await page.keyboard.press('Escape');
  await page.reload();
  await navigate(page, 'Pengaturan');
  await expect(page.getByLabel('Tampilkan bagian teks Arab')).not.toBeChecked();
  await page.keyboard.press('Escape');
});

test('real Nest search, filter, detail, copy, save, history refresh and clear', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const request = page.waitForRequest(
    (request) =>
      request.url().includes(':4000/api/v1/search') &&
      request.method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Hadits tentang menuntut ilmu', exact: true })
    .click();
  expect((await request).postDataJSON()).toMatchObject({
    query: 'Hadits tentang menuntut ilmu',
  });
  await expect(page.locator('.result-card')).toHaveCount(2);
  await expect(
    page
      .locator('.result-card')
      .first()
      .getByText('Data simulasi', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/ui-redesign/regression-${info.project.name}-results.png`,
    fullPage: true,
  });
  const filterRequest = page.waitForRequest(
    (request) =>
      request.url().includes(':4000/api/v1/search') &&
      request.postDataJSON()?.filters?.sourceSlugs?.[0] === 'mock-a',
  );
  await page.getByLabel('Koleksi', { exact: true }).selectOption('mock-a');
  await filterRequest;
  await expect(page.locator('.result-card')).toHaveCount(1);
  await page.getByLabel('Koleksi', { exact: true }).selectOption('');
  await expect(page.locator('.result-card')).toHaveCount(2);
  const detailButton = page
    .getByRole('button', { name: 'Lihat detail' })
    .first();
  await detailButton.click();
  const dialog = page.getByRole('dialog', { name: 'Detail contoh' });
  if (info.project.name === 'mobile') {
    const box = await dialog.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(390);
  }
  await expect(
    dialog.getByText('Teks Arab tidak tersedia pada data simulasi.'),
  ).toBeVisible();
  await expect(
    dialog.getByText('Terjemahan tidak tersedia pada data simulasi.'),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/ui-redesign/regression-${info.project.name}-detail.png`,
    fullPage: true,
  });
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(detailButton).toBeFocused();
  await page
    .getByRole('button', { name: 'Salin contoh Menuntut ilmu', exact: true })
    .click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('DATA SIMULASI — BUKAN HADITS TERVERIFIKASI');
  await page
    .getByRole('button', { name: 'Simpan contoh Menuntut ilmu', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Hapus simpanan Menuntut ilmu',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  await navigate(page, 'Percakapan baru');
  await expect(
    page.getByRole('heading', { name: /Cari hadits/ }),
  ).toBeVisible();
  await page.reload();
  await navigate(page, 'Hadits tentang menuntut ilmu', true);
  await expect(page.locator('.result-card')).toHaveCount(2);
  await navigate(page, 'Buka simpanan lokal');
  await expect(
    page.getByRole('heading', { name: 'Disimpan untuk nanti.' }),
  ).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(1);
  await navigate(page, 'Hapus data lokal');
  await page
    .getByRole('button', { name: 'Hapus riwayat dan simpanan' })
    .click();
  await expect(
    page.getByRole('heading', { name: /Cari hadits/ }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.evaluate((key) => localStorage.getItem(key), key)) ??
            '{}',
        ).history?.length,
    )
    .toBe(0);
});

test('keyboard, input boundaries, independent queries and empty results', async ({
  page,
}) => {
  const input = page.getByLabel('Pertanyaan pencarian hadits');
  await input.fill('ab');
  await input.press('Enter');
  await expect(page.locator('#composer-error')).toHaveText(
    'Tulis pertanyaan sepanjang 3–300 karakter.',
  );
  await input.fill('x'.repeat(301));
  await expect(
    page.getByRole('button', { name: 'Kirim pertanyaan' }),
  ).toBeDisabled();
  await input.fill('hadits');
  await input.press('Shift+Enter');
  await input.pressSequentially('marah');
  await expect(input).toHaveValue('hadits\nmarah');
  await input.press('Enter');
  await expect(page.locator('.result-card')).toHaveCount(2);
  await submit(page, 'mobil listrik');
  await expect(
    page.getByRole('heading', { name: 'Belum ditemukan.' }),
  ).toBeVisible();
  await expect(page.locator('.user-query')).toHaveText('mobil listrik');
  await expect(page.locator('.result-card')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('loading, cancel, replacement query and reduced motion', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(api, async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await submit(page, 'ilmu');
  await expect(
    page.getByText('Sedang mencari…', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Pertanyaan pencarian hadits')).toBeDisabled();
  expect(
    await page
      .locator('.skeleton')
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await page.getByRole('button', { name: 'Batalkan pencarian' }).click();
  await expect(
    page.getByRole('heading', { name: 'Pencarian dibatalkan.' }),
  ).toBeVisible();
  await navigate(page, 'Percakapan baru');
  release();
  await page.unroute(api);
  await submit(page, 'sedekah');
  await expect(page.locator('.result-card')).toHaveCount(2);
  await expect(page.locator('.result-card').first()).toContainText(
    'Keutamaan sedekah',
  );
  await expect(page.locator('.user-query')).toHaveText('sedekah');
});

test('unavailable backend, safe error, retry, invalid response and timeout', async ({
  page,
}) => {
  await page.route(api, (route) => route.abort('connectionrefused'));
  await submit(page, 'ilmu');
  await expect(
    page.getByRole('heading', { name: 'Pencarian belum berhasil.' }),
  ).toBeVisible();
  await expect(page.getByText(/Tidak dapat terhubung/)).toBeVisible();
  await page.unroute(api);
  await page.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.locator('.result-card')).toHaveCount(2);
  await page.route(api, (route) =>
    route.fulfill({
      json: {
        data: { results: [{ isVerified: true }] },
        meta: { modeUsed: 'hybrid' },
      },
    }),
  );
  await submit(page, 'ilmu');
  await expect(
    page.getByText('Respons pencarian tidak dapat dibaca. Coba lagi.'),
  ).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(0);
  await page.unroute(api);
  await page.clock.install();
  await page.route(api, () => {});
  await submit(page, 'sedekah');
  await expect(
    page.getByText('Sedang mencari…', { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(11000);
  await expect(
    page.getByText('Pencarian terlalu lama. Periksa koneksi lalu coba lagi.'),
  ).toBeVisible();
});

test('corrupt storage and unavailable persistence do not stop search', async ({
  page,
}) => {
  await page.evaluate((key) => localStorage.setItem(key, '{invalid'), key);
  await page.reload();
  await expect(
    page.getByText(/Penyimpanan lokal tidak tersedia/),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Menjaga lisan', exact: true })
    .click();
  await expect(page.locator('.result-card')).toHaveCount(2);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
  });
  await submit(page, 'makan');
  await expect(page.locator('.result-card')).toHaveCount(2);
  await expect(
    page.getByText(/Penyimpanan lokal tidak tersedia/),
  ).toBeVisible();
});

test('animated search status follows motion preference and cancellation', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.route(api, () => {});
  await submit(page, 'ilmu');
  await expect(
    page.getByText('Sedang mencari…', { exact: true }),
  ).toBeVisible();
  await page.clock.runFor(300);
  const status = page.locator('.typing-status');
  const first = await status.innerText();
  expect(first.length).toBeGreaterThan(1);
  expect(first.length).toBeLessThan(
    'Menelusuri referensi untuk pertanyaanmu…'.length,
  );
  await page.clock.runFor(240);
  expect((await status.innerText()).length).toBeGreaterThan(first.length);
  expect(
    await page
      .locator('.search-orb > span')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('orbit');
  await page.screenshot({
    path: `artifacts/ui-redesign/${info.project.name}-searching.png`,
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(status).toHaveText('Menelusuri referensi untuk pertanyaanmu…');
  expect(
    await page
      .locator('.search-orb > span')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  expect(
    await page
      .locator('.typing-caret')
      .evaluate((element) => getComputedStyle(element).display),
  ).toBe('none');
  await page.getByRole('button', { name: 'Batalkan pencarian' }).click();
  await expect(
    page.getByRole('heading', { name: 'Pencarian dibatalkan.' }),
  ).toBeVisible();
  await page.clock.runFor(2000);
  await expect(page.locator('.typing-status')).toHaveCount(0);
  await expect(page.getByLabel('Pertanyaan pencarian hadits')).toBeEnabled();
});
