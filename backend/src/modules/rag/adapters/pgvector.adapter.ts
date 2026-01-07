import { Injectable, Logger } from '@nestjs/common';
import {
  IVectorStore,
  VectorDocument,
  SearchResult,
  VectorMetadata,
} from '../interfaces/vector-store.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';
import { SessionChunk } from '../entities/session-chunk.entity';

/**
 * Vector Store Adapter
 * 
 * Development: Uses SQLite with optimized JavaScript similarity computation
 * Production: Ready for PostgreSQL with pgvector extension
 * 
 * Note: Currently optimized for OpenAI embeddings which are pre-normalized.
 * For normalized vectors: cosine_similarity = dot_product (2x faster)
 */
@Injectable()
export class PgVectorAdapter implements IVectorStore {
  private readonly logger = new Logger(PgVectorAdapter.name);

  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    @InjectRepository(SessionChunk)
    private chunksRepository: Repository<SessionChunk>,
  ) {}

  async upsert(document: VectorDocument): Promise<void> {
    // Upsert a chunk-level document into session_chunks
    const existing = await this.chunksRepository.findOne({
      where: { id: document.id },
    });
    const chunk = this.chunksRepository.create({
      id: document.id,
      sessionId: document.metadata.sessionId,
      therapistId: document.metadata.therapistId,
      clientId: document.metadata.clientId,
      timestamp: document.metadata.timestamp,
      chunkIndex: document.metadata.chunkIndex,
      totalChunks: document.metadata.totalChunks,
      text: document.text,
      contextSummary: document.metadata.contextSummary ?? null,
      metadata: document.metadata,
      embedding: document.embedding,
      createdAt: existing?.createdAt,
      updatedAt: existing?.updatedAt,
    });
    await this.chunksRepository.save(chunk);
  }

  async upsertBatch(documents: VectorDocument[]): Promise<void> {
    // Optimize with transaction for batch operations
    await this.chunksRepository.manager.transaction(async (manager) => {
      for (const doc of documents) {
        const existing = await manager.findOne(SessionChunk, {
          where: { id: doc.id },
        });
        const chunk = manager.create(SessionChunk, {
          id: doc.id,
          sessionId: doc.metadata.sessionId,
          therapistId: doc.metadata.therapistId,
          clientId: doc.metadata.clientId,
          timestamp: doc.metadata.timestamp,
          chunkIndex: doc.metadata.chunkIndex,
          totalChunks: doc.metadata.totalChunks,
          text: doc.text,
          contextSummary: doc.metadata.contextSummary ?? null,
          metadata: doc.metadata,
          embedding: doc.embedding,
          createdAt: existing?.createdAt,
          updatedAt: existing?.updatedAt,
        });
        await manager.save(chunk);
      }
    });
  }

  async search(
    queryEmbedding: number[],
    limit: number = 10,
    filter?: Partial<VectorMetadata>,
    minSimilarity: number = 0.3,
  ): Promise<SearchResult[]> {
    const dbType = this.chunksRepository.manager.connection.options.type;

    // Use native pgvector operations if PostgreSQL, otherwise fallback to optimized JS
    if (dbType === 'postgres') {
      this.logger.debug('Using PostgreSQL pgvector native search');
      return this.searchWithPgVector(queryEmbedding, limit, filter, minSimilarity);
    } else {
      this.logger.debug('Using JavaScript-based similarity search (SQLite)');
      return this.searchWithJavaScript(queryEmbedding, limit, filter, minSimilarity);
    }
  }

  /**
   * PostgreSQL pgvector native search (for production)
   * Uses database-native vector operations with cosine distance operator (<=>)
   * Requires: CREATE EXTENSION vector; and column type vector(1024)
   */
  private async searchWithPgVector(
    queryEmbedding: number[],
    limit: number,
    filter?: Partial<VectorMetadata>,
    minSimilarity: number = 0.3,
  ): Promise<SearchResult[]> {
    try {
      // Build WHERE conditions
      const conditions: string[] = ['1=1'];
      const params: any[] = [JSON.stringify(queryEmbedding)];
      let paramIndex = 2;

      if (filter?.therapistId) {
        conditions.push(`"therapistId" = $${paramIndex}`);
        params.push(filter.therapistId);
        paramIndex++;
      }

      if (filter?.sessionIds && Array.isArray(filter.sessionIds) && filter.sessionIds.length > 0) {
        conditions.push(`"sessionId" = ANY($${paramIndex})`);
        params.push(filter.sessionIds);
        paramIndex++;
      } else if (filter?.sessionId) {
        conditions.push(`"sessionId" = $${paramIndex}`);
        params.push(filter.sessionId);
        paramIndex++;
      }

      // Similarity threshold: pgvector's <=> returns distance (0 = identical, 2 = opposite)
      // Cosine similarity = 1 - distance
      conditions.push(`(1 - (embedding <=> $1::vector)) >= $${paramIndex}`);
      params.push(minSimilarity);
      paramIndex++;

      params.push(limit);

      const query = `
        SELECT 
          id,
          "sessionId",
          "therapistId",
          "clientId",
          timestamp,
          "chunkIndex",
          "totalChunks",
          text,
          "contextSummary",
          embedding,
          (1 - (embedding <=> $1::vector)) as similarity
        FROM session_chunks
        WHERE ${conditions.join(' AND ')}
        ORDER BY embedding <=> $1::vector
        LIMIT $${paramIndex}
      `;

      const results = await this.chunksRepository.query(query, params);

      return results.map((row: any) => ({
        id: row.id,
        score: parseFloat(row.similarity),
        text: row.text,
        embedding: row.embedding, // Include for MMR diversity
        metadata: {
          sessionId: row.sessionId,
          therapistId: row.therapistId || '',
          clientId: row.clientId || '',
          timestamp: row.timestamp || '',
          chunkIndex: row.chunkIndex,
          totalChunks: row.totalChunks,
          contextSummary: row.contextSummary,
        },
      }));
    } catch (error) {
      this.logger.error(`pgvector search failed, falling back to JavaScript: ${error.message}`);
      return this.searchWithJavaScript(queryEmbedding, limit, filter, minSimilarity);
    }
  }

  /**
   * JavaScript-based similarity search (for SQLite development)
   * OPTIMIZED: Uses dot product for normalized vectors (OpenAI embeddings are pre-normalized)
   * For normalized vectors: cosine_similarity = dot_product (2x faster than full cosine)
   */
  private async searchWithJavaScript(
    queryEmbedding: number[],
    limit: number,
    filter?: Partial<VectorMetadata>,
    minSimilarity: number = 0.3,
  ): Promise<SearchResult[]> {
    let qb = this.chunksRepository.createQueryBuilder('chunk');

    if (filter?.therapistId) {
      qb = qb.where('chunk.therapistId = :therapistId', {
        therapistId: filter.therapistId,
      });
    }

    if (filter?.sessionIds && Array.isArray(filter.sessionIds) && filter.sessionIds.length > 0) {
      qb = qb.andWhere('chunk.sessionId IN (:...sessionIds)', {
        sessionIds: filter.sessionIds,
      });
    } else if (filter?.sessionId) {
      qb = qb.andWhere('chunk.sessionId = :sessionId', {
        sessionId: filter.sessionId,
      });
    }

    const chunks = await qb.getMany();

    const results = chunks
      .map((chunk) => {
        // OPTIMIZED: Use dot product for OpenAI's normalized embeddings
        const similarity = this.dotProductSimilarity(queryEmbedding, chunk.embedding);
        return {
          id: chunk.id,
          score: similarity,
          text: chunk.text,
          embedding: chunk.embedding, // Include for MMR diversity
          metadata: {
            sessionId: chunk.sessionId,
            therapistId: chunk.therapistId || '',
            clientId: chunk.clientId || '',
            timestamp: chunk.timestamp || '',
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            contextSummary: chunk.contextSummary,
          },
        };
      })
      .filter((result) => result.score >= minSimilarity)
      .sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    const result = await this.chunksRepository.delete({ id });

    if (result.affected === 0) {
      throw new Error(`Vector with id ${id} not found`);
    }
  }

  async deleteByMetadata(filter: Partial<VectorMetadata>): Promise<void> {
    let qb = this.chunksRepository.createQueryBuilder().delete().from(SessionChunk);

    if (filter.therapistId) {
      qb = qb.where('therapistId = :therapistId', {
        therapistId: filter.therapistId,
      });
    }

    if (filter.sessionId) {
      qb = qb.andWhere('sessionId = :sessionId', {
        sessionId: filter.sessionId,
      });
    }

    if (filter.clientId) {
      qb = qb.andWhere('clientId = :clientId', {
        clientId: filter.clientId,
      });
    }

    const result = await qb.execute();

    if (result.affected === 0) {
      throw new Error('No vectors found matching the filter criteria');
    }
  }

  async getById(id: string): Promise<VectorDocument | null> {
    const chunk = await this.chunksRepository.findOne({ where: { id } });
    if (!chunk) return null;

    return {
      id: chunk.id,
      embedding: chunk.embedding,
      text: chunk.text,
      metadata: {
        sessionId: chunk.sessionId,
        therapistId: chunk.therapistId || '',
        clientId: chunk.clientId || '',
        timestamp: chunk.timestamp || '',
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        contextSummary: chunk.contextSummary,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.chunksRepository.count();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * OPTIMIZED: Dot product similarity for normalized vectors
   * 
   * OpenAI embeddings are pre-normalized (unit length = 1), so:
   * cosine_similarity(A, B) = dot_product(A, B)
   * 
   * This is 2x faster than computing full cosine similarity.
   * Performance: ~1024 multiplications + 1024 additions = very fast
   */
  private dotProductSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      this.logger.warn(
        `Vector dimension mismatch: ${vecA.length} vs ${vecB.length}. Returning 0.`
      );
      return 0;
    }

    let product = 0;
    for (let i = 0; i < vecA.length; i++) {
      product += vecA[i] * vecB[i];
    }

    // Clamp to [-1, 1] to handle floating point precision errors
    return Math.max(-1, Math.min(1, product));
  }

  /**
   * Full cosine similarity computation (backup method)
   * Use only if vectors are NOT normalized
   * Includes division-by-zero protection
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      this.logger.warn(
        `Vector dimension mismatch: ${vecA.length} vs ${vecB.length}. Returning 0.`
      );
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    // Division by zero protection
    if (denominator === 0 || !Number.isFinite(denominator)) {
      this.logger.warn('Zero magnitude vector encountered. Returning 0.');
      return 0;
    }

    const similarity = dotProduct / denominator;

    // Clamp to [-1, 1] to handle floating point errors
    return Math.max(-1, Math.min(1, similarity));
  }
}

