import { Injectable } from '@nestjs/common';
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
 * PostgreSQL pgvector Adapter
 */
@Injectable()
export class PgVectorAdapter implements IVectorStore {
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
    await Promise.all(documents.map((doc) => this.upsert(doc)));
  }

  async search(
    queryEmbedding: number[],
    limit: number = 10,
    filter?: Partial<VectorMetadata>,
    minSimilarity: number = 0.3,
  ): Promise<SearchResult[]> {
    // Current implementation: cosine similarity over stored chunk embeddings
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
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          id: chunk.id,
          score: similarity,
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

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

