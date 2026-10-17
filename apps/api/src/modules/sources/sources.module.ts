import { Module } from '@nestjs/common';
import { HadithModule } from '../hadiths/hadith.module';
import { SourcesController } from './sources.controller';
@Module({ imports: [HadithModule], controllers: [SourcesController] })
export class SourcesModule {}
