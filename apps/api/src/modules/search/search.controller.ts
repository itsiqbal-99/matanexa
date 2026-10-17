import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchValidationPipe } from './search-validation.pipe';
import type { SearchDto } from './search.schema';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(200)
  search(@Body(SearchValidationPipe) dto: SearchDto) {
    return this.searchService.search(dto);
  }
}
