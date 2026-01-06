import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IVectorStore, SearchResult, VectorDocument } from '../../interfaces/vector-store.interface';
import { IEmbeddingProvider } from '../../interfaces/embedding-provider.interface';
import { EMBEDDING_PROVIDER, VECTOR_STORE } from '../../constants/tokens';
import { Session } from '../../../sessions/entities/session.entity';

/**
 * Hybrid Search Strategy
 * Combines semantic search (vector similarity) with keyword search (BM25)
 * Uses Reciprocal Rank Fusion (RRF) to merge results
 */
@Injectable()
export class HybridSearchStrategy {
  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
    @Inject(VECTOR_STORE)
    private readonly vectorStore: IVectorStore,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: IEmbeddingProvider,
  ) {}

  async search(
    query: string,
    limit: number = 10,
    alpha: number = 0.5, // Weight: 0 = pure keyword, 1 = pure semantic
    filter?: Record<string, any>,
    minSimilarity: number = 0.3,
  ): Promise<SearchResult[]> {
    // 1. Semantic search (vector similarity)
    const queryEmbedding = await this.embeddingProvider.embedText(query);
    const semanticResults = await this.vectorStore.search(
      queryEmbedding,
      limit * 2,
      filter,
      minSimilarity,
    );

    // 2. Keyword search (BM25 - simplified for demo)
    const keywordResults = await this.keywordSearch(query, limit * 2, filter);

    // 3. Reciprocal Rank Fusion
    const fusedResults = this.reciprocalRankFusion(
      semanticResults,
      keywordResults,
      alpha,
    );

    return fusedResults.slice(0, limit);
  }

  /**
   * Simplified keyword search using text matching
   * In production, use Elasticsearch, Meilisearch, or PostgreSQL full-text search
   */
  private async keywordSearch(
    query: string,
    limit: number,
    filter?: Record<string, any>,
  ): Promise<SearchResult[]> {
    // Simple BM25 over session text (entries/transcript/summary).
    // For production scale, replace with dedicated search backend.

    const therapistId = filter?.therapistId;
    const sessionIds: string[] | undefined = filter?.sessionIds;

    let qb = this.sessionsRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.entries', 'entries');

    if (therapistId) {
      qb = qb.where('session.therapistId = :therapistId', { therapistId });
    }

    if (sessionIds && sessionIds.length > 0) {
      qb = qb.andWhere('session.id IN (:...sessionIds)', { sessionIds });
    }

    // Safety cap to avoid large in-memory scoring; adjust as needed.
    qb = qb.take(500);

    const sessions = await qb.getMany();
    if (sessions.length === 0) return [];

    const documents: VectorDocument[] = sessions.map((session) => {
      let searchableText = '';
      if (session.entries && session.entries.length > 0) {
        searchableText = session.entries
          .map((entry: Session['entries'][number]) => `${entry.speaker}: ${entry.content}`)
          .join('\n');
      } else if (session.transcript) {
        searchableText = session.transcript;
      } else if (session.summary) {
        searchableText = session.summary;
      }

      return {
        id: session.id,
        embedding: [], // not used in keyword path
        text: searchableText,
        metadata: {
          sessionId: session.id,
          therapistId: session.therapistId,
          clientId: session.clientId,
          timestamp: session.startTime,
        },
      };
    });

    const queryTerms = this.tokenize(query);
    const avgDocLength = this.calculateAvgDocLength(documents);
    const totalDocs = documents.length;

    const scored = documents
      .map((doc) => {
        const score = this.bm25Score(queryTerms, doc, totalDocs, avgDocLength);
        return { doc, score };
      })
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map<SearchResult>(({ doc, score }) => ({
        id: doc.id,
        score,
        text: doc.text,
        metadata: doc.metadata,
      }));

    return scored;
  }

  /**
   * Reciprocal Rank Fusion algorithm
   * Combines multiple ranked lists into a single ranking
   */
  private reciprocalRankFusion(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    alpha: number,
    k: number = 60,
  ): SearchResult[] {
    const scores = new Map<string, number>();
    const documents = new Map<string, SearchResult>();

    // Score semantic results
    semanticResults.forEach((result, rank) => {
      const rrfScore = alpha / (k + rank + 1);
      scores.set(result.id, (scores.get(result.id) || 0) + rrfScore);
      documents.set(result.id, result);
    });

    // Score keyword results
    keywordResults.forEach((result, rank) => {
      const rrfScore = (1 - alpha) / (k + rank + 1);
      scores.set(result.id, (scores.get(result.id) || 0) + rrfScore);
      if (!documents.has(result.id)) {
        documents.set(result.id, result);
      }
    });

    // Sort by combined score
    const rankedResults = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({
        ...documents.get(id)!,
        score,
      }));

    return rankedResults;
  }

  // --- BM25 helpers ---

  private bm25Score(
    queryTerms: string[],
    doc: VectorDocument,
    totalDocs: number,
    avgDocLength: number,
    k1: number = 1.5,
    b: number = 0.75,
  ): number {
    const docTerms = this.tokenize(doc.text);
    const docLength = docTerms.length || 1;
    const termFreqMap = this.termFrequency(docTerms);

    let score = 0;
    for (const term of queryTerms) {
      const tf = termFreqMap.get(term) ?? 0;
      if (tf === 0) continue;

      // Approximate df: count documents containing term (lightweight)
      // For simplicity, assume term appears in ~5% of docs if not present here.
      const df = docTerms.includes(term)
        ? Math.max(1, Math.floor(totalDocs * 0.05))
        : Math.max(1, Math.floor(totalDocs * 0.05));
      const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5));

      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
      score += idf * (numerator / denominator);
    }

    return score;
  }

  private termFrequency(terms: string[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const t of terms) {
      map.set(t, (map.get(t) || 0) + 1);
    }
    return map;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  private calculateAvgDocLength(documents: VectorDocument[]): number {
    const totalLength = documents.reduce(
      (sum, doc) => sum + this.tokenize(doc.text).length,
      0,
    );
    return documents.length ? totalLength / documents.length : 1;
  }
}

