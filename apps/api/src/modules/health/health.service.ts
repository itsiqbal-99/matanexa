import { Inject, Injectable } from '@nestjs/common';
import { ENVIRONMENT, type Environment } from '../../config/environment';

@Injectable()
export class HealthService {
  constructor(@Inject(ENVIRONMENT) private readonly environment: Environment) {}

  getStatus() {
    // Liveness/configuration only; database connectivity is checked by db:check.
    return {
      status: 'ok' as const,
      mode: this.environment.mode,
      databaseConfigured:
        this.environment.mode !== 'mock' && !!this.environment.databaseUrl,
      ...(this.environment.dataScope === 'local_pilot'
        ? { dataScope: 'local_pilot' }
        : {}),
    };
  }
}
