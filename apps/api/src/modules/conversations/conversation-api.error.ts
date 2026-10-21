import { HttpStatus } from '@nestjs/common';
import type { ConversationStreamErrorCode } from '@matanexa/contracts';
import { DomainHttpException } from '../../common/domain-error';

const descriptors: Record<
  ConversationStreamErrorCode,
  {
    publicCode:
      | 'VALIDATION_ERROR'
      | 'UNAUTHORIZED'
      | 'REQUEST_TIMEOUT'
      | 'REQUEST_LIMITED'
      | 'REQUEST_ABORTED'
      | 'PAYLOAD_TOO_LARGE'
      | 'CONVERSATION_UNAVAILABLE';
    message: string;
    status: number;
    retryable: boolean;
  }
> = {
  INVALID_REQUEST: {
    publicCode: 'VALIDATION_ERROR',
    message: 'Format percakapan tidak valid.',
    status: HttpStatus.BAD_REQUEST,
    retryable: false,
  },
  UNAUTHORIZED: {
    publicCode: 'UNAUTHORIZED',
    message: 'Akses internal tidak diizinkan.',
    status: HttpStatus.UNAUTHORIZED,
    retryable: false,
  },
  TIMEOUT: {
    publicCode: 'REQUEST_TIMEOUT',
    message: 'Batas waktu percakapan terlampaui.',
    status: HttpStatus.GATEWAY_TIMEOUT,
    retryable: true,
  },
  CONCURRENCY_LIMIT: {
    publicCode: 'REQUEST_LIMITED',
    message: 'Kapasitas percakapan internal sedang penuh.',
    status: HttpStatus.TOO_MANY_REQUESTS,
    retryable: true,
  },
  OUTPUT_TOO_LARGE: {
    publicCode: 'PAYLOAD_TOO_LARGE',
    message: 'Output percakapan melebihi batas yang diizinkan.',
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    retryable: false,
  },
  ABORTED: {
    publicCode: 'REQUEST_ABORTED',
    message: 'Permintaan percakapan dibatalkan.',
    status: HttpStatus.REQUEST_TIMEOUT,
    retryable: true,
  },
  ORCHESTRATION_FAILED: {
    publicCode: 'CONVERSATION_UNAVAILABLE',
    message: 'Percakapan internal tidak dapat diproses.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
    retryable: true,
  },
};

export class ConversationApiError extends DomainHttpException {
  override readonly name = 'ConversationApiError';
  readonly retryable: boolean;

  constructor(readonly code: ConversationStreamErrorCode) {
    const descriptor = descriptors[code];
    super(
      { code: descriptor.publicCode, message: descriptor.message },
      descriptor.status,
    );
    this.retryable = descriptor.retryable;
  }
}
