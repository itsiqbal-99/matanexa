import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        error: {
          code:
            status === 404
              ? 'NOT_FOUND'
              : status === 503
                ? 'DATABASE_UNAVAILABLE'
                : status >= 500
                  ? 'INTERNAL_ERROR'
                  : status === 400
                    ? 'VALIDATION_ERROR'
                    : status === 413
                      ? 'PAYLOAD_TOO_LARGE'
                      : 'REQUEST_ERROR',
          message:
            status === 404
              ? 'Endpoint tidak ditemukan.'
              : status === 400
                ? 'Pertanyaan harus 3–300 karakter. Periksa format dan batas permintaan.'
                : status === 503
                  ? 'Database tidak tersedia. Periksa koneksi dan migrasi, lalu coba lagi.'
                  : 'Permintaan tidak dapat diproses.',
          requestId: randomUUID(),
        },
      });
  }
}
