import type {
  ConversationExecutionStatus,
  ConversationPlanningStrategy,
} from '@matanexa/contracts';
import type { ProviderUsage } from '../../providers/provider-contract';

export interface ConversationTelemetryRecord {
  requestId: string;
  providerId: string;
  modelId?: string;
  status: ConversationExecutionStatus;
  planningStrategy: ConversationPlanningStrategy;
  durationMs: number;
  providerDurationMs: number;
  generationCalls: number;
  toolExecutions: number;
  selectedMessageCount: number;
  omittedMessageCount: number;
  evidenceCount: number;
  staleEvidenceCount: number;
  fallbackReason?: string;
  usage?: ProviderUsage;
}

export class ConversationTelemetryCollector {
  private readonly records: ConversationTelemetryRecord[] = [];

  record(record: ConversationTelemetryRecord): void {
    this.records.push(structuredClone(record));
    if (this.records.length > 100) this.records.shift();
  }

  snapshot(): readonly ConversationTelemetryRecord[] {
    return this.records.map((record) => structuredClone(record));
  }
}

export const CONVERSATION_TELEMETRY = Symbol('CONVERSATION_TELEMETRY');
