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

/**
 * PostgreSQL pgvector Adapter
 */
@Injectable()
export class PgVectorAdapter implements IVectorStore {
  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
  ) {}

  async upsert(document: VectorDocument): Promise<void> {
    // In production with pgvector:
    // await this.connection.query(
    //   'INSERT INTO vectors (id, embedding, text, metadata) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET embedding = $2, text = $3, metadata = $4',
    //   [document.id, document.embedding, document.text, document.metadata]
    // );

    // For SQLite compatibility
    const session = await this.sessionsRepository.findOne({
      where: { id: document.metadata.sessionId },
    });

    if (session) {
      session.embedding = document.embedding;
      await this.sessionsRepository.save(session);
    }
  }

  async upsertBatch(documents: VectorDocument[]): Promise<void> {
    await Promise.all(documents.map((doc) => this.upsert(doc)));
  }

  async search(
    queryEmbedding: number[],
    limit: number = 10,
    filter?: Partial<VectorMetadata>,
  ): Promise<SearchResult[]> {
    // In production with pgvector:
    // SELECT id, text, metadata, 1 - (embedding <=> $1) as score
    // FROM vectors
    // WHERE metadata @> $2
    // ORDER BY embedding <=> $1
    // LIMIT $3

    // Current SQLite implementation
    let query = this.sessionsRepository.createQueryBuilder('session');

    if (filter?.therapistId) {
      query = query.where('session.therapistId = :therapistId', {
        therapistId: filter.therapistId,
      });
    }

    const sessions = await query
      .andWhere('session.embedding IS NOT NULL')
      .getMany();

    const results = sessions
      .map((session) => {
        const similarity = this.cosineSimilarity(
          queryEmbedding,
          session.embedding!,
        );

        return {
          id: session.id,
          score: similarity,
          text: session.summary || session.transcript || '',
          metadata: {
            sessionId: session.id,
            therapistId: session.therapistId,
            clientId: session.clientId,
            timestamp: session.startTime,
          },
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  async delete(id: string): Promise<void> {
    const result = await this.sessionsRepository.update(
      { id },
      { embedding: null as any }, // TypeORM allows null for nullable fields
    );

    if (result.affected === 0) {
      throw new Error(`Vector with id ${id} not found`);
    }
  }

  async deleteByMetadata(filter: Partial<VectorMetadata>): Promise<void> {
    let query = this.sessionsRepository
      .createQueryBuilder()
      .update(Session)
      .set({ embedding: null as any });

    // Apply filters conditionally
    if (filter.therapistId) {
      query = query.where('therapistId = :therapistId', {
        therapistId: filter.therapistId,
      });
    }

    if (filter.sessionId) {
      query = query.andWhere('id = :sessionId', {
        sessionId: filter.sessionId,
      });
    }

    if (filter.clientId) {
      query = query.andWhere('clientId = :clientId', {
        clientId: filter.clientId,
      });
    }

    const result = await query.execute();

    if (result.affected === 0) {
      throw new Error('No vectors found matching the filter criteria');
    }
  }

  async getById(id: string): Promise<VectorDocument | null> {
    const session = await this.sessionsRepository.findOne({ where: { id } });

    if (!session || !session.embedding) {
      return null;
    }

    return {
      id: session.id,
      embedding: session.embedding,
      text: session.summary || session.transcript || '',
      metadata: {
        sessionId: session.id,
        therapistId: session.therapistId,
        clientId: session.clientId,
        timestamp: session.startTime,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.sessionsRepository.count();
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

