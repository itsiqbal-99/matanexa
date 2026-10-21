import type {
  ProviderErrorCode,
  ProviderOperation,
  ProviderUsage,
} from './provider-contract';

export interface ProviderTelemetryRecord {
  correlationId?: string;
  providerId: string;
  modelId: string;
  operation: ProviderOperation;
  startedAt: string;
  durationMs: number;
  firstEventMs?: number;
  outcome: 'success' | 'error' | 'aborted';
  errorCode?: ProviderErrorCode;
  usage?: ProviderUsage;
}

export class ProviderTelemetryCollector {
  private readonly records: ProviderTelemetryRecord[] = [];

  record(record: ProviderTelemetryRecord): void {
    this.records.push(structuredClone(record));
    if (this.records.length > 100) this.records.shift();
  }

  snapshot(): readonly ProviderTelemetryRecord[] {
    return this.records.map((record) => structuredClone(record));
  }
}

export const PROVIDER_TELEMETRY = Symbol('PROVIDER_TELEMETRY');
