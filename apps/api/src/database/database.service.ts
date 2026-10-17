import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';
import { ENVIRONMENT, type Environment } from '../config/environment';
import { createPool } from './connection';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool?: Pool;
  constructor(@Inject(ENVIRONMENT) environment: Environment) {
    // Mock does not create a pool or contact the network, even if a URL exists.
    if (environment.mode !== 'mock' && environment.databaseUrl)
      this.pool = createPool(
        environment.databaseUrl,
        environment.poolMax,
        environment.databaseTimeout,
      );
  }
  async query<T extends QueryResultRow>(
    sql: string,
    values: unknown[] = [],
  ): Promise<T[]> {
    try {
      if (!this.pool) throw new Error('Unconfigured');
      return (await this.pool.query<T>(sql, values)).rows;
    } catch {
      throw new ServiceUnavailableException('DATABASE_UNAVAILABLE');
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
