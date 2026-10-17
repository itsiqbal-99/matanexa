import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import { HadithRepository, serializeHadith } from './hadith.repository';
@Injectable()
export class HadithService {
  constructor(
    private readonly repository: HadithRepository,
    @Inject(ENVIRONMENT) private readonly env: Environment,
  ) {}
  async detail(id: string) {
    const row =
      this.env.mode === 'mock' ? undefined : await this.repository.find(id);
    if (!row) throw new NotFoundException();
    return { data: serializeHadith(row), meta: { requestId: randomUUID() } };
  }
  async sources() {
    return {
      data: this.env.mode === 'mock' ? [] : await this.repository.sources(),
      meta: { requestId: randomUUID() },
    };
  }
}
