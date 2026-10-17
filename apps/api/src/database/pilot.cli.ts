import { config } from 'dotenv';
import { normalizeIndexText } from '../modules/search/query-normalizer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPool } from './connection';
import { importDataset } from './importer';
import {
  editionUrl,
  preparePilot,
  PILOT_SOURCE,
  PILOT_REPOSITORY,
  sha256,
} from './pilot';
async function main() {
  config({ quiet: true });
  if (process.env.NODE_ENV !== 'development')
    throw new Error('DEVELOPMENT_ONLY');
  const root = resolve(process.cwd(), '../..'),
    dir = resolve(root, 'data/local-pilot/fawaz'),
    out = resolve(root, 'artifacts/g26');
  await mkdir(resolve(dir, 'raw'), { recursive: true });
  await mkdir(out, { recursive: true });
  const command = process.argv[2];
  if (command === 'download') {
    for (const name of ['ind-bukhari', 'ara-bukhari']) {
      const r = await fetch(editionUrl(name), {
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error('SOURCE_DOWNLOAD_FAILED');
      await writeFile(resolve(dir, 'raw', `${name}.json`), await r.text());
    }
  }
  if (command === 'prepare' || command === 'download') {
    const prepared = preparePilot(
      await readFile(resolve(dir, 'raw/ara-bukhari.json'), 'utf8'),
      await readFile(resolve(dir, 'raw/ind-bukhari.json'), 'utf8'),
    );
    await writeFile(
      resolve(dir, 'pilot.json'),
      JSON.stringify(prepared.dataset, null, 2) + '\n',
    );
    await writeFile(
      resolve(out, 'pairing-report.json'),
      JSON.stringify(prepared.report, null, 2) + '\n',
    );
    console.log(JSON.stringify(prepared.report));
    return;
  }
  if (command === 'reindex') {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_MISSING');
    const pool = createPool(process.env.DATABASE_URL, 1, 10000);
    try {
      const rows = (
        await pool.query<{ id: string; indonesian_text: string }>(
          'SELECT id,indonesian_text FROM local_pilot_hadiths WHERE source_slug=$1',
          [PILOT_SOURCE],
        )
      ).rows;
      const result = await pool.query(
        `UPDATE hadiths h SET normalized_translation=x.text
        FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,text text) WHERE h.id=x.id`,
        [
          JSON.stringify(
            rows.map((row) => ({
              id: row.id,
              text: normalizeIndexText(row.indonesian_text),
            })),
          ),
        ],
      );
      console.log(
        JSON.stringify({
          reindexed: result.rowCount,
          originalTextUnchanged: true,
        }),
      );
    } finally {
      await pool.end();
    }
    return;
  }
  if (command !== 'import') throw new Error('UNKNOWN_PILOT_COMMAND');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_MISSING');
  const raw = await readFile(resolve(dir, 'pilot.json'), 'utf8');
  const pool = createPool(process.env.DATABASE_URL, 1, 10000);
  try {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO source_catalog(slug,display_name,original_url,dataset_url,license_name,license_reference_url,attribution,permission_status,permission_notes,checked_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'research_only',$8,now()) ON CONFLICT(slug) DO NOTHING`,
        [
          PILOT_SOURCE,
          'Bukhari — pilot riset lokal',
          PILOT_REPOSITORY,
          editionUrl('ind-bukhari'),
          'Research only — publication permission unresolved',
          `${PILOT_REPOSITORY}/blob/1/LICENSE`,
          'fawazahmed0/hadith-api: ara-bukhari + ind-bukhari',
          'Local research explicitly requested by user; no publication or redistribution, no automatic verification or approval.',
        ],
      );
      const dryRun = process.argv.includes('--dry-run');
      const report = await importDataset(
        client,
        JSON.parse(raw) as unknown,
        sha256(raw),
        { researchOnly: true, dryRun },
      );
      await writeFile(
        resolve(out, dryRun ? 'import-dry-run.json' : 'import-report.json'),
        JSON.stringify(report, null, 2) + '\n',
      );
      console.log(JSON.stringify(report));
      if (report.failed) process.exitCode = 1;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    'PILOT_OPERATION_FAILED — inspect configuration, source pairing and migration status; credentials omitted.',
  );
  process.exitCode = 1;
});
