import { Inject, Injectable } from '@nestjs/common';
import { ENVIRONMENT, type Environment } from '../config/environment';
@Injectable()
export class CorpusAccess {
  readonly relation: 'published_hadiths' | 'local_pilot_hadiths';
  constructor(@Inject(ENVIRONMENT) environment: Environment) {
    this.relation =
      environment.dataScope === 'local_pilot'
        ? 'local_pilot_hadiths'
        : 'published_hadiths';
  }
}
