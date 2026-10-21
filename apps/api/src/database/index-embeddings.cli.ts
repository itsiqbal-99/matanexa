import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readEnvironment } from '../config/environment';
import { createPool } from './connection';
import { CorpusAccess } from './corpus-access';
import {
  CloudflareEmbedding,
  EmbeddingUnavailable,
} from '../providers/embedding/cloudflare-embedding';
import { ACTIVE_EMBEDDING_MODEL } from '../providers/embedding/embedding-provider';
async function main() {
  config({ quiet: true });
  const env = readEnvironment(process.env),
    provider = new CloudflareEmbedding(env);
  if (process.env.NODE_ENV !== 'development')
    throw new Error('DEVELOPMENT_ONLY');
  if (!provider.configured) {
    console.log(
      JSON.stringify({ indexed: 0, status: 'NOT_CONFIGURED', remoteCalls: 0 }),
    );
    return;
  }
  if (!env.databaseUrl || env.mode === 'mock')
    throw new Error('DATABASE_REQUIRED');
  const corpus = new CorpusAccess(env),
    pool = createPool(env.databaseUrl, 1, 10000);
  const out = resolve(process.cwd(), '../../artifacts/g26-hybrid');
  await mkdir(out, { recursive: true });
  const report = {
    createdAt: new Date().toISOString(),
    scope: env.dataScope,
    model: ACTIVE_EMBEDDING_MODEL,
    eligible: 0,
    alreadyIndexed: 0,
    pendingAtStart: 0,
    indexed: 0,
    failed: 0,
    unprocessed: 0,
    retries: 0,
    status: 'RUNNING',
    failureCode: null as string | null,
    api: provider.statistics,
  };
  try {
    report.eligible = (
      await pool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${corpus.relation}`,
      )
    ).rows[0].count;
    const rows = await pool.query<{
      id: string;
      indonesian_text: string;
      content_hash: string;
    }>(
      `SELECT h.id,h.indonesian_text,h.content_hash FROM ${corpus.relation} h
    LEFT JOIN hadith_embeddings e ON e.hadith_id=h.id AND e.model=$1 AND e.content_hash=h.content_hash WHERE e.hadith_id IS NULL ORDER BY h.id LIMIT 500`,
      [ACTIVE_EMBEDDING_MODEL],
    );
    report.pendingAtStart = rows.rows.length;
    report.alreadyIndexed = report.eligible - rows.rows.length;
    for (let i = 0; i < rows.rows.length; i += 4) {
      const batch = rows.rows.slice(i, i + 4);
      try {
        let vectors: number[][];
        try {
          vectors = await provider.embed(
            batch.map((row) => row.indonesian_text),
          );
        } catch (error) {
          // One retry for transient failure; never retry authentication/quota.
          if (
            !(error instanceof EmbeddingUnavailable) ||
            !(error.code === 'TIMEOUT' || (error.httpStatus ?? 0) >= 500)
          )
            throw error;
          report.retries++;
          await new Promise((resolve) => setTimeout(resolve, 500));
          vectors = await provider.embed(
            batch.map((row) => row.indonesian_text),
          );
        }
        const payload = batch.map((row, j) => ({
          id: row.id,
          hash: row.content_hash,
          embedding: JSON.stringify(vectors[j]),
        }));
        const saved = await pool.query(
          `INSERT INTO hadith_embeddings(hadith_id,model,content_hash,embedding)
          SELECT h.id,$2,h.content_hash,x.embedding::vector FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,hash text,embedding text)
          JOIN ${corpus.relation} h ON h.id=x.id AND h.content_hash=x.hash
          ON CONFLICT(hadith_id,model) DO UPDATE SET content_hash=EXCLUDED.content_hash,embedding=EXCLUDED.embedding,updated_at=now()`,
          [JSON.stringify(payload), ACTIVE_EMBEDDING_MODEL],
        );
        if (saved.rowCount !== batch.length)
          throw new Error('SOURCE_CHANGED_DURING_INDEXING');
        report.indexed += saved.rowCount;
      } catch (error) {
        report.failed += batch.length;
        report.failureCode =
          error instanceof EmbeddingUnavailable
            ? error.code
            : 'DATABASE_OR_SOURCE_CHANGED';
        throw error;
      }
      console.log(
        JSON.stringify({
          indexed: report.indexed,
          pending: rows.rows.length - report.indexed,
          requests: provider.statistics.requests,
        }),
      );
      if (i + 4 < rows.rows.length)
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    report.status = 'COMPLETE';
  } catch {
    report.status = 'STOPPED_RESUMABLE';
    process.exitCode = 1;
  } finally {
    report.unprocessed = Math.max(
      0,
      report.pendingAtStart - report.indexed - report.failed,
    );
    report.api = provider.statistics;
    await writeFile(
      resolve(out, 'index-report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify(report));
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    'EMBEDDING_INDEX_STOPPED — safe to resume; no credentials logged.',
  );
  process.exitCode = 1;
});
