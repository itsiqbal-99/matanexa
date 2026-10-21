import { HttpException } from '@nestjs/common';
import type { PublicErrorCode } from '@matanexa/contracts';

interface PublicErrorDescriptor {
  code: PublicErrorCode;
  message: string;
}

export class DomainHttpException extends HttpException {
  constructor(
    readonly publicError: PublicErrorDescriptor,
    status: number,
  ) {
    super(publicError.message, status);
  }
}

export function normalizePublicError(
  exception: unknown,
  status: number,
): PublicErrorDescriptor {
  if (exception instanceof DomainHttpException) return exception.publicError;
  if (status === 404)
    return { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' };
  if (status === 400)
    return {
      code: 'VALIDATION_ERROR',
      message:
        'Pertanyaan harus 3–300 karakter. Periksa format dan batas permintaan.',
    };
  if (status === 413)
    return {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Ukuran permintaan melebihi batas yang diizinkan.',
    };
  if (status === 503)
    return {
      code: 'DATABASE_UNAVAILABLE',
      message:
        'Database tidak tersedia. Periksa koneksi dan migrasi, lalu coba lagi.',
    };
  if (status >= 500)
    return {
      code: 'INTERNAL_ERROR',
      message: 'Permintaan tidak dapat diproses.',
    };
  return {
    code: 'REQUEST_ERROR',
    message: 'Permintaan tidak dapat diproses.',
  };
}
