import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Session } from '../sessions/entities/session.entity';
import { RAGService } from '../rag/rag.service';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    private ragService: RAGService,
    private configService: ConfigService,
  ) {}

  /**
   * Semantic search across sessions using RAG
   * Uses RAGService for chunk-level search with hybrid search and reranking
   */
  async searchSessions(
    query: string,
    therapistId?: string,
    limit: number = 10,
  ) {
    // Use RAGService for advanced search (semantic search + reranking)
    const ragResults = await this.ragService.search(query, {
      limit: limit * 2, // Get more results to account for multiple chunks per session
      therapistId,
      useHybrid: false, // Pure vector search (faster, simpler)
      useReranking: true,
    });

    // Extract unique session IDs
    const sessionIds = [
      ...new Set(
        ragResults
          .map((r) => r.metadata?.sessionId)
          .filter((id): id is string => !!id),
      ),
    ];

    if (sessionIds.length === 0) {
      return [];
    }

    // Batch fetch all sessions at once
    const sessions = await this.sessionsRepository.find({
      where: sessionIds.map((id) => ({ id })),
      relations: ['entries'],
    });

    const sessionMap = new Map(
      sessions.map((session) => [
        session.id,
        {
          session: {
            id: session.id,
            therapistId: session.therapistId,
            clientId: session.clientId,
            startTime: session.startTime,
            summary: session.summary,
            createdAt: session.createdAt,
          },
          similarity: 0,
          matchedSnippets: [] as string[],
        },
      ]),
    );

    // Group RAG results by session and collect snippets
    for (const result of ragResults) {
      const sessionId = result.metadata?.sessionId;
      if (!sessionId || !sessionMap.has(sessionId)) continue;

      const entry = sessionMap.get(sessionId)!;
      
      // Add snippet if we don't have too many
      if (entry.matchedSnippets.length < 3) {
        entry.matchedSnippets.push(result.text);
      }
      
      // Update similarity to highest score from this session
      if (result.score && result.score > entry.similarity) {
        entry.similarity = result.score;
      }
    }

    // Convert to array, sort by similarity, and limit
    // Filter out results with no matched snippets
    // Note: Similarity threshold removed for mock embeddings (random vectors have low similarity)
    // In production with real embeddings, add: .filter((r) => r.similarity > 0.3)
    const results = Array.from(sessionMap.values())
      .filter((r) => r.matchedSnippets.length > 0) // Only return sessions with matches
      .sort((a, b) => b.similarity - a.similarity) // Sort by similarity (even if low)
      .slice(0, limit);

    return results;
  }
}

