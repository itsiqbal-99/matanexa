import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPool } from './connection';
import { migrate, readMigrations } from './migrations';
import { importDataset } from './importer';

async function main(): Promise<void> {
  config({ quiet: true });
  const command = process.argv[2];
  if (!['check', 'audit', 'migrate', 'import'].includes(command ?? ''))
    throw new Error('UNKNOWN_COMMAND');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_MISSING');
  const pool = createPool(url, 1, 10000);
  try {
    const client = await pool.connect();
    try {
      if (command === 'check') {
        await client.query('SELECT 1');
        console.log('Database connection: OK (TLS verified).');
      } else if (command === 'audit') {
        // Read-only application audit; no URL, credentials or religious content in the artifact.
        const counts = await client.query<{
          sources: number;
          approved_sources: number;
          real_records: number;
          simulation_records: number;
          public_records: number;
        }>(`SELECT
          (SELECT count(*)::int FROM public.source_catalog) AS sources,
          (SELECT count(*)::int FROM public.source_catalog WHERE permission_status='approved') AS approved_sources,
          (SELECT count(*)::int FROM public.hadiths WHERE NOT is_simulation) AS real_records,
          (SELECT count(*)::int FROM public.hadiths WHERE is_simulation) AS simulation_records,
          (SELECT count(*)::int FROM public.published_hadiths) AS public_records`);
        const migrations = await client.query(
          'SELECT name FROM public.schema_migrations ORDER BY name',
        );
        const columns = await client.query<{
          table_name: string;
          column_name: string;
          data_type: string;
        }>(`SELECT table_name,column_name,data_type FROM information_schema.columns
          WHERE table_schema='public' AND table_name IN ('source_catalog','hadith_collections','hadiths','import_runs','hadith_topic_relations','hadith_topics','published_hadiths','schema_migrations')
          ORDER BY table_name,ordinal_position`);
        const report = {
          auditedAt: new Date().toISOString(),
          kind: 'READ_ONLY_APPLICATION_DATABASE_AUDIT',
          counts: counts.rows[0],
          migrations: migrations.rows.map((row: { name: string }) => row.name),
          columns: columns.rows,
        };
        await writeFile(
          resolve(process.cwd(), '../../docs/G25_DATABASE_AUDIT.json'),
          JSON.stringify(report, null, 2) + '\n',
        );
        console.log(
          JSON.stringify({
            counts: report.counts,
            migrations: report.migrations,
          }),
        );
      } else if (command === 'migrate') {
        const migrations = await readMigrations(
          resolve(process.cwd(), '../../db/migrations'),
        );
        console.log(
          JSON.stringify({ applied: await migrate(client, migrations) }),
        );
      } else {
        const path = process.argv[3];
        const flags = process.argv.slice(4);
        if (flags.some((flag) => flag !== '--dry-run') || flags.length > 1)
          throw new Error('UNKNOWN_COMMAND');
        if (!path || (await stat(path)).size > 10000000)
          throw new Error('IMPORT_FILE_REQUIRED_MAX_10MB');
        const raw = await readFile(path, 'utf8');
        const report = await importDataset(
          client,
          JSON.parse(raw) as unknown,
          createHash('sha256').update(raw).digest('hex'),
          { dryRun: flags.includes('--dry-run') },
        );
        console.log(JSON.stringify(report, null, 2));
        if (report.failed) process.exitCode = 1;
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
void main().catch((error: unknown) => {
  const known = new Set([
    'DATABASE_URL_MISSING',
    'SOURCE_NOT_APPROVED',
    'IMPORT_FILE_REQUIRED_MAX_10MB',
    'UNKNOWN_COMMAND',
  ]);
  console.error(
    error instanceof Error && known.has(error.message)
      ? error.message
      : 'DATABASE_OPERATION_FAILED — periksa konfigurasi, izin sumber, atau migration history; kredensial tidak dicetak.',
  );
  process.exitCode = 1;
});
