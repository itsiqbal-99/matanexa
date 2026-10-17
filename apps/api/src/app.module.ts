import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HadithModule } from './modules/hadiths/hadith.module';
import { SourcesModule } from './modules/sources/sources.module';
import { HealthModule } from './modules/health/health.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    DatabaseModule,
    HadithModule,
    SourcesModule,
    HealthModule,
    SearchModule,
  ],
})
export class AppModule {}
