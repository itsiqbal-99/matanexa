import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RequestContextService {
  private readonly requestIds = new AsyncLocalStorage<string>();

  run<T>(requestId: string, callback: () => T): T {
    return this.requestIds.run(requestId, callback);
  }

  currentRequestId(): string {
    return this.requestIds.getStore() ?? randomUUID();
  }
}
