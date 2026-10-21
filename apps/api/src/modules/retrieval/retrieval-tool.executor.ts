import { HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import {
  evidenceSchema,
  getHadithDetailToolInputSchema,
  retrievalToolNames,
  retrieveRelatedEvidenceToolInputSchema,
  searchHadithToolInputSchema,
  validateEvidenceReferencesToolInputSchema,
  type Evidence,
  type RetrievalToolName,
} from '@matanexa/contracts';
import { randomUUID } from 'node:crypto';
import { ENVIRONMENT, type Environment } from '../../config/environment';
import { RequestContextService } from '../../common/request-context.service';
import { ProviderError } from '../../providers/provider-contract';
import {
  RETRIEVAL_GATEWAY,
  RetrievalGatewayError,
  type RetrievalGateway,
  type RetrievalPage,
  type RetrievalRecord,
} from './retrieval.gateway';
import {
  RetrievalToolError,
  type RetrievalToolErrorCode,
} from './retrieval-tool.error';

export const RETRIEVAL_TOOL_ALLOWLIST = Object.freeze([...retrievalToolNames]);

type EvidencePolicy = 'public' | 'research';

export interface ToolExecutionResult {
  toolName: RetrievalToolName;
  requestId: string;
  data: Record<string, unknown>;
}

interface SessionOptions {
  signal?: AbortSignal;
}

@Injectable()
export class RetrievalToolExecutor {
  constructor(
    @Inject(RETRIEVAL_GATEWAY)
    private readonly gateway: RetrievalGateway,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Optional() private readonly requestContext?: RequestContextService,
  ) {}

  createSession(options: SessionOptions = {}): RetrievalToolSession {
    return new RetrievalToolSession(
      this.gateway,
      this.environment.dataScope === 'local_pilot' ? 'research' : 'public',
      this.requestContext?.currentRequestId() ?? randomUUID(),
      this.environment.retrievalTimeoutMs,
      this.environment.retrievalMaxOutputBytes,
      options.signal,
    );
  }
}

export class RetrievalToolSession {
  private readonly evidenceByCitation = new Map<string, Evidence>();
  private readonly evidenceByRecord = new Map<string, Evidence>();

  constructor(
    private readonly gateway: RetrievalGateway,
    private readonly policy: EvidencePolicy,
    readonly requestId: string,
    private readonly timeoutMs: number,
    private readonly maxOutputBytes: number,
    private readonly callerSignal?: AbortSignal,
  ) {}

  async execute(
    toolName: string,
    rawInput: unknown,
  ): Promise<ToolExecutionResult> {
    if (!RETRIEVAL_TOOL_ALLOWLIST.includes(toolName as RetrievalToolName))
      throw new RetrievalToolError('TOOL_NOT_ALLOWED', this.requestId);

    const name = toolName as RetrievalToolName;
    const result = await this.withBudget(async (signal) => {
      switch (name) {
        case 'search_hadith':
          return this.search(rawInput, signal);
        case 'get_hadith_detail':
          return this.detail(rawInput, signal);
        case 'retrieve_related_evidence':
          return this.related(rawInput, signal);
        case 'validate_evidence_references':
          return this.validate(rawInput, signal);
      }
    });
    const envelope: ToolExecutionResult = {
      toolName: name,
      requestId: this.requestId,
      data: result,
    };
    if (
      Buffer.byteLength(JSON.stringify(envelope), 'utf8') > this.maxOutputBytes
    )
      throw new RetrievalToolError('OUTPUT_TOO_LARGE', this.requestId);
    return envelope;
  }

  private async search(rawInput: unknown, signal: AbortSignal) {
    const input = this.parse(searchHadithToolInputSchema, rawInput);
    const page = await this.gateway.search(input, { signal });
    return {
      evidence: this.registerUnique(page.records),
      retrieval: this.metadata(page),
    };
  }

  private async detail(rawInput: unknown, signal: AbortSignal) {
    const input = this.parse(getHadithDetailToolInputSchema, rawInput);
    const record = await this.gateway.findById(input.recordId, { signal });
    if (!record) throw new RetrievalToolError('NOT_FOUND', this.requestId);
    return { evidence: this.register(record) };
  }

  private async related(rawInput: unknown, signal: AbortSignal) {
    const input = this.parse(retrieveRelatedEvidenceToolInputSchema, rawInput);
    const seed = await this.gateway.findById(input.recordId, { signal });
    if (!seed) throw new RetrievalToolError('NOT_FOUND', this.requestId);
    this.assertPolicy(seed);
    const page = await this.gateway.search(
      { query: input.query, limit: input.limit, filters: input.filters },
      { signal },
    );
    const records = page.records.filter((record) => record.id !== seed.id);
    return {
      seedRecordId: seed.id,
      evidence: this.registerUnique(records),
      retrieval: this.metadata(page),
    };
  }

  private async validate(rawInput: unknown, signal: AbortSignal) {
    const input = this.parse(
      validateEvidenceReferencesToolInputSchema,
      rawInput,
    );
    if (new Set(input.citationIds).size !== input.citationIds.length)
      throw new RetrievalToolError('DUPLICATE_EVIDENCE', this.requestId);
    const validated: Evidence[] = [];
    for (const citationId of input.citationIds) {
      const evidence = this.evidenceByCitation.get(citationId);
      if (!evidence)
        throw new RetrievalToolError('INVALID_CITATION', this.requestId);
      const current = await this.gateway.findById(evidence.recordId, {
        signal,
      });
      if (
        !current ||
        this.fingerprint(current) !== this.evidenceFingerprint(evidence)
      )
        throw new RetrievalToolError('INVALID_CITATION', this.requestId);
      this.assertPolicy(current);
      validated.push(evidence);
    }
    return { valid: true, evidence: validated };
  }

  private registerUnique(records: RetrievalRecord[]): Evidence[] {
    const unique = new Map(records.map((record) => [record.id, record]));
    return [...unique.values()].map((record) => this.register(record));
  }

  private register(record: RetrievalRecord): Evidence {
    this.assertPolicy(record);
    const existing = this.evidenceByRecord.get(record.id);
    if (existing) return existing;
    const research = record.isVerified === false;
    const evidence = evidenceSchema.parse({
      citationId: `cite_${randomUUID()}`,
      recordId: record.id,
      exactText: {
        arabic: record.arabicText,
        indonesian: record.indonesianText,
      },
      reference: {
        collection: record.collection,
        hadithNumber: record.hadithNumber,
        numberingScheme: record.numberingScheme,
        bookName: record.bookName,
        chapterName: record.chapterName,
        narrator: record.narrator,
        referenceUrl: record.referenceUrl,
        verificationReferenceUrl: record.verificationReferenceUrl,
      },
      source: {
        slug: record.sourceSlug,
        name: record.provenance.sourceName,
        sourceUrl: record.sourceUrl,
      },
      provenance: {
        attribution: record.provenance.attribution,
        translationAttribution: record.translationAttribution,
        licenseName: record.provenance.licenseName,
        licenseUrl: record.provenance.licenseUrl,
      },
      status: {
        verification: research ? 'unverified' : 'verified',
        publication: research ? 'research_only' : 'approved',
        isResearchOnly: research,
      },
      eligibility: {
        policy: this.policy,
        eligible: !research || this.policy === 'research',
        reasons: research
          ? ['RESEARCH_SCOPE_ONLY', 'NOT_PUBLICLY_VERIFIED']
          : ['VERIFIED', 'APPROVED_SOURCE'],
      },
    });
    this.evidenceByRecord.set(record.id, evidence);
    this.evidenceByCitation.set(evidence.citationId, evidence);
    return evidence;
  }

  private assertPolicy(record: RetrievalRecord): void {
    if (this.policy === 'public' && record.isVerified === false)
      throw new RetrievalToolError('RESEARCH_ONLY_REJECTED', this.requestId);
  }

  private metadata(page: RetrievalPage) {
    return {
      modeUsed: page.modeUsed,
      totalCandidates: page.totalCandidates,
      countSemantics: page.modeUsed === 'hybrid' ? 'retrieval_window' : 'exact',
      ...(page.fallbackReason ? { fallbackReason: page.fallbackReason } : {}),
    };
  }

  private fingerprint(record: RetrievalRecord): string {
    return JSON.stringify([
      record.id,
      record.arabicText,
      record.indonesianText,
      record.referenceUrl,
      record.verificationReferenceUrl,
      record.isVerified,
      record.sourceSlug,
      record.provenance.sourceName,
      record.sourceUrl,
      record.provenance.attribution,
      record.translationAttribution,
      record.provenance.licenseName,
      record.provenance.licenseUrl,
      record.collection,
      record.hadithNumber,
      record.numberingScheme,
      record.bookName,
      record.chapterName,
      record.narrator,
    ]);
  }

  private evidenceFingerprint(evidence: Evidence): string {
    return JSON.stringify([
      evidence.recordId,
      evidence.exactText.arabic,
      evidence.exactText.indonesian,
      evidence.reference.referenceUrl,
      evidence.reference.verificationReferenceUrl,
      evidence.status.verification === 'verified',
      evidence.source.slug,
      evidence.source.name,
      evidence.source.sourceUrl,
      evidence.provenance.attribution,
      evidence.provenance.translationAttribution,
      evidence.provenance.licenseName,
      evidence.provenance.licenseUrl,
      evidence.reference.collection,
      evidence.reference.hadithNumber,
      evidence.reference.numberingScheme,
      evidence.reference.bookName,
      evidence.reference.chapterName,
      evidence.reference.narrator,
    ]);
  }

  private parse<T>(
    schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
    rawInput: unknown,
  ): T {
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success)
      throw new RetrievalToolError('INVALID_INPUT', this.requestId);
    return parsed.data as T;
  }

  private async withBudget<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.callerSignal?.aborted)
      throw new RetrievalToolError('ABORTED', this.requestId);
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    this.callerSignal?.addEventListener('abort', abortFromCaller, {
      once: true,
    });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    timer.unref();
    const aborted = new Promise<never>((_resolve, reject) => {
      const rejectAbort = () =>
        reject(
          new RetrievalToolError(
            timedOut
              ? 'TIMEOUT'
              : this.callerSignal?.aborted
                ? 'ABORTED'
                : 'RETRIEVAL_UNAVAILABLE',
            this.requestId,
          ),
        );
      if (controller.signal.aborted) rejectAbort();
      else
        controller.signal.addEventListener('abort', rejectAbort, {
          once: true,
        });
    });
    try {
      return await Promise.race([operation(controller.signal), aborted]);
    } catch (error) {
      throw this.normalizeError(error);
    } finally {
      clearTimeout(timer);
      this.callerSignal?.removeEventListener('abort', abortFromCaller);
    }
  }

  private normalizeError(error: unknown): RetrievalToolError {
    if (error instanceof RetrievalToolError) return error;
    if (error instanceof RetrievalGatewayError)
      return new RetrievalToolError(error.code, this.requestId);
    if (error instanceof ProviderError)
      return new RetrievalToolError(
        error.code === 'TIMEOUT'
          ? 'TIMEOUT'
          : error.code === 'ABORTED'
            ? 'ABORTED'
            : 'PROVIDER_UNAVAILABLE',
        this.requestId,
      );
    if (error instanceof HttpException && error.getStatus() === 503)
      return new RetrievalToolError('RETRIEVAL_UNAVAILABLE', this.requestId);
    return new RetrievalToolError(
      'RETRIEVAL_UNAVAILABLE' satisfies RetrievalToolErrorCode,
      this.requestId,
    );
  }
}
