import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DomainHttpException } from '../../common/domain-error';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import { ConversationApiError } from './conversation-api.error';

export const INTERNAL_CONVERSATION_KEY_HEADER = 'x-matanexa-internal-key';

@Injectable()
export class InternalConversationGuard implements CanActivate {
  constructor(@Inject(ENVIRONMENT) private readonly environment: Environment) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      !this.environment.internalConversationApiEnabled ||
      !['development', 'test'].includes(this.environment.runtimeEnvironment) ||
      !this.environment.internalConversationApiKey
    )
      throw new DomainHttpException(
        { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' },
        HttpStatus.NOT_FOUND,
      );

    const request = context.switchToHttp().getRequest<Request>();
    const supplied = request.headers[INTERNAL_CONVERSATION_KEY_HEADER];
    if (
      typeof supplied !== 'string' ||
      !this.matches(supplied, this.environment.internalConversationApiKey)
    )
      throw new ConversationApiError('UNAUTHORIZED');
    return true;
  }

  private matches(supplied: string, expected: string): boolean {
    const digest = (value: string) =>
      createHash('sha256').update(value, 'utf8').digest();
    return timingSafeEqual(digest(supplied), digest(expected));
  }
}
