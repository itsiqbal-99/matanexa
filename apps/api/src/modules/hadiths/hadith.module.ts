import { Module } from '@nestjs/common';
import { HadithRepository } from './hadith.repository';
import { HadithService } from './hadith.service';
import { HadithController } from './hadith.controller';
@Module({
  controllers: [HadithController],
  providers: [HadithRepository, HadithService],
  exports: [HadithRepository, HadithService],
})
export class HadithModule {}
