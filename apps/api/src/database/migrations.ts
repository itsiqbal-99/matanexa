import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import type { PoolClient } from 'pg';

export interface Migration {
  name: string;
  sql: string;
  checksum: string;
}
export async function readMigrations(directory: string): Promise<Migration[]> {
  const files = (await readdir(directory))
    .filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name))
    .sort();
  if (
    !files.length ||
    new Set(files.map((file) => file.slice(0, 3))).size !== files.length
  )
    throw new Error('Migration files missing or duplicate version.');
  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(`${directory}/${name}`, 'utf8');
      return {
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}
export async function migrate(
  client: PoolClient,
  migrations: Migration[],
): Promise<string[]> {
  const applied: string[] = [];
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(70241261)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const existing = await client.query<{ name: string; checksum: string }>(
      'SELECT name,checksum FROM schema_migrations ORDER BY name',
    );
    for (const row of existing.rows) {
      if (
        !migrations.some(
          (m) => m.name === row.name && m.checksum === row.checksum,
        )
      )
        throw new Error(
          'Migration history mismatch. Restore the original files.',
        );
    }
    for (const migration of migrations) {
      if (existing.rows.some((row) => row.name === migration.name)) continue;
      if (existing.rows.some((row) => row.name > migration.name))
        throw new Error('Out-of-order migration.');
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',
        [migration.name, migration.checksum],
      );
      applied.push(migration.name);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
