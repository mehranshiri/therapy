import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';

/**
 * OpenAI Embedding Provider (Production)
 * Uses text-embedding-3-large with Matryoshka dimension control
 */
@Injectable()
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private readonly logger = new Logger(OpenAIEmbeddingProvider.name);
  private readonly model = 'text-embedding-3-large';
  private readonly dimensions = 1024; // Chosen balance of quality and cost
  private readonly maxBatchSize = 128;
  private readonly maxInputLength = 200_000; // characters
  private readonly maxRetries = 3;
  private readonly initialRetryDelay = 1000; // ms
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for embeddings');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async embedText(text: string): Promise<number[]> {
    const cleaned = this.preprocess(text);
    const embeddings = await this.embedBatchInternal([cleaned]);
    return embeddings[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }
    const cleaned = texts.map((t, i) => this.preprocess(t, i));
    this.logger.log(`Embedding batch start: ${cleaned.length} item(s)`);
    return this.embedBatchInternal(cleaned);
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getProviderName(): string {
    return 'OpenAI';
  }

  getCostPer1KTokens(): number {
    // Approx for text-embedding-3-large as of 2025; update if pricing changes
    return 0.00013;
  }

  // ---- Internal helpers ----

  private preprocess(text: string, index?: number): string {
    if (typeof text !== 'string') {
      throw new Error(`Text at index ${index ?? 0} is not a string`);
    }
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      throw new Error(`Text at index ${index ?? 0} is empty after trimming`);
    }
    if (trimmed.length > this.maxInputLength) {
      this.logger.warn(
        `Text at index ${index ?? 0} truncated from ${trimmed.length} to ${this.maxInputLength} chars`,
      );
      return trimmed.slice(0, this.maxInputLength);
    }
    return trimmed;
  }

  private async embedBatchInternal(texts: string[]): Promise<number[][]> {
    const batches = this.chunkArray(texts, this.maxBatchSize);
    const results: number[][] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const started = Date.now();
      const embeddings = await this.embedWithRetry(batch, i);
      results.push(...embeddings);
      const duration = Date.now() - started;
      this.logger.log(
        `Embedded batch ${i + 1}/${batches.length} (${batch.length} item(s)) in ${duration}ms`,
      );
    }

    this.validateEmbeddings(results);
    return results;
  }

  private async embedWithRetry(
    texts: string[],
    batchIndex: number,
    retry = 0,
  ): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      });

      const embeddings = (response.data ?? []).map(
        (item: { embedding: number[] }) => item.embedding,
      );
      this.validateEmbeddings(embeddings);
      return embeddings;
    } catch (error: any) {
      const isRetriable =
        error?.status === 429 ||
        (error?.status && error.status >= 500) ||
        error?.code === 'ETIMEDOUT';

      if (isRetriable && retry < this.maxRetries) {
        const delay = this.initialRetryDelay * Math.pow(2, retry);
        this.logger.warn(
          `Embedding batch ${batchIndex} failed (attempt ${retry + 1}/${
            this.maxRetries
          }): ${error?.message || error}. Retrying in ${delay}ms.`,
        );
        await this.sleep(delay);
        return this.embedWithRetry(texts, batchIndex, retry + 1);
      }

      this.logger.error(
        `Embedding batch ${batchIndex} failed permanently: ${error?.message || error}`,
      );
      throw new Error(`Embedding failed: ${error?.message || error}`);
    }
  }

  private validateEmbeddings(embeddings: number[][]): void {
    for (let i = 0; i < embeddings.length; i++) {
      const emb = embeddings[i];
      if (!Array.isArray(emb) || emb.length !== this.dimensions) {
        throw new Error(
          `Invalid embedding at index ${i}: expected ${this.dimensions} dims, got ${emb?.length}`,
        );
      }
      if (emb.some((v) => !Number.isFinite(v))) {
        throw new Error(`Invalid embedding values (NaN/Infinity) at index ${i}`);
    }
      // Normalize check (API should already normalize, but verify)
      const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
      const tolerance = 0.01;
      if (Math.abs(norm - 1) > tolerance) {
        // Normalize defensively
        for (let j = 0; j < emb.length; j++) {
          emb[j] = emb[j] / norm;
        }
      }
    }
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      res.push(arr.slice(i, i + size));
    }
    return res;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

