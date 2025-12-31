import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Session } from '../sessions/entities/session.entity';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SearchService {
  private readonly similarityThreshold: number;

  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    private aiService: AiService,
    private configService: ConfigService,
  ) {
    // Lower threshold for mock mode to account for mock embeddings
    // In production with real OpenAI embeddings, 0.7 is appropriate
    // For mock embeddings, 0.5 works better
    this.similarityThreshold = parseFloat(
      this.configService.get('SIMILARITY_THRESHOLD') || '0.5',
    );
  }

  /**
   * Semantic search across sessions using vector embeddings
   */
  async searchSessions(
    query: string,
    therapistId?: string,
    limit: number = 10,
  ) {
    // Generate embedding for search query
    const queryEmbedding = await this.aiService.generateEmbedding(query);

    // Get all sessions with embeddings
    let sessions = await this.sessionsRepository.find({
      where: therapistId ? { therapistId } : {},
      relations: ['entries'],
    });

    // Filter sessions that have embeddings
    sessions = sessions.filter((s) => s.embedding && s.embedding.length > 0);

    // Calculate similarity scores
    const results = sessions
      .map((session) => {
        const similarity = this.aiService.cosineSimilarity(
          queryEmbedding,
          session.embedding!,
        );

        // Extract relevant snippets from summary or entries
        const snippets = this.extractSnippets(session, query);

        return {
          session: {
            id: session.id,
            therapistId: session.therapistId,
            clientId: session.clientId,
            startTime: session.startTime,
            summary: session.summary,
            createdAt: session.createdAt,
          },
          similarity: Math.round(similarity * 1000) / 1000, // Round to 3 decimals
          matchedSnippets: snippets,
        };
      })
      .filter((result) => {
        // Filter by threshold, but also include if keywords match
        const hasKeywordMatch = result.matchedSnippets.length > 0;
        const meetsThreshold = result.similarity >= this.similarityThreshold;
        
        // Include result if either condition is met
        return meetsThreshold || hasKeywordMatch;
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  /**
   * Extract relevant text snippets from session
   */
  private extractSnippets(session: Session, query: string): string[] {
    const snippets: string[] = [];
    const queryTerms = query.toLowerCase().split(' ');

    // Check summary
    if (session.summary) {
      const summaryLower = session.summary.toLowerCase();
      if (queryTerms.some((term) => summaryLower.includes(term))) {
        // Extract sentences containing query terms
        const sentences = session.summary.split(/[.!?]+/);
        const relevant = sentences
          .filter((s) =>
            queryTerms.some((term) => s.toLowerCase().includes(term)),
          )
          .slice(0, 2);
        snippets.push(...relevant);
      }
    }

    // Check entries
    if (session.entries) {
      session.entries.forEach((entry) => {
        const contentLower = entry.content.toLowerCase();
        if (queryTerms.some((term) => contentLower.includes(term))) {
          snippets.push(
            `${entry.speaker}: ${entry.content.substring(0, 100)}...`,
          );
        }
      });
    }

    return snippets.slice(0, 3); // Return top 3 snippets
  }
}

