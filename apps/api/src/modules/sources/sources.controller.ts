import { Controller, Get } from '@nestjs/common';
import { HadithService } from '../hadiths/hadith.service';
@Controller('sources')
export class SourcesController {
  constructor(private readonly service: HadithService) {}
  @Get() list() {
    return this.service.sources();
  }
}
