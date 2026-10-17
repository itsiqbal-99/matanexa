import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { searchSchema, type SearchDto } from './search.schema';

@Injectable()
export class SearchValidationPipe implements PipeTransform<unknown, SearchDto> {
  transform(value: unknown): SearchDto {
    const result = searchSchema.safeParse(value);
    if (!result.success) throw new BadRequestException('VALIDATION_ERROR');
    return result.data;
  }
}
