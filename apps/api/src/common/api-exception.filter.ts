import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { normalizePublicError } from './domain-error';
import { RequestContextService } from './request-context.service';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly requestContext: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = this.requestContext.currentRequestId();
    const error = normalizePublicError(exception, status);
    response
      .setHeader('X-Request-ID', requestId)
      .status(status)
      .json({
        error: { ...error, requestId },
      });
  }
}
