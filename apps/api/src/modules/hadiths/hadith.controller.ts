import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { HadithService } from './hadith.service';
@Controller('hadiths')
export class HadithController {
  constructor(private readonly service: HadithService) {}
  @Get(':id') detail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.detail(id);
  }
}
