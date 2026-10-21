import {
  datasetDefaultPath,
  runPhase6Evaluation,
} from './phase6-evaluation.runner';

async function main(): Promise<void> {
  const datasetPath = process.argv[2] ?? datasetDefaultPath;
  const report = await runPhase6Evaluation(datasetPath);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.summary.failed > 0) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Phase 6 offline evaluation failed: ${message}\n`);
  process.exitCode = 1;
});
