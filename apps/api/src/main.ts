import { config } from 'dotenv';
import { Logger } from '@nestjs/common';
import { createApp } from './create-app';
import { ENVIRONMENT, type Environment } from './config/environment';

config({ quiet: true });

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const environment = app.get<Environment>(ENVIRONMENT);
  await app.listen(environment.port, '127.0.0.1');
  Logger.log(
    `API lokal: http://localhost:${environment.port}/api/v1/health`,
    'Bootstrap',
  );
}

void bootstrap().catch(() => {
  Logger.error(
    'API gagal dimulai. Periksa konfigurasi environment dan port lokal.',
    'Bootstrap',
  );
  process.exitCode = 1;
});
