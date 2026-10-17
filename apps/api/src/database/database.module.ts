import { Global, Module } from '@nestjs/common';
import { ENVIRONMENT, readEnvironment } from '../config/environment';
import { DatabaseService } from './database.service';
import { CorpusAccess } from './corpus-access';

@Global()
@Module({
  providers: [
    { provide: ENVIRONMENT, useFactory: () => readEnvironment(process.env) },
    DatabaseService,
    CorpusAccess,
  ],
  exports: [ENVIRONMENT, DatabaseService, CorpusAccess],
})
export class DatabaseModule {}
