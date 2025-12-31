import { Injectable, Inject } from '@nestjs/common';
import { IVectorStore, SearchResult } from '../../interfaces/vector-store.interface';
import { IEmbeddingProvider } from '../../interfaces/embedding-provider.interface';
import { EMBEDDING_PROVIDER, VECTOR_STORE } from '../../constants/tokens';

/**
 * Hybrid Search Strategy
 * Combines semantic search (vector similarity) with keyword search (BM25)
 * Uses Reciprocal Rank Fusion (RRF) to merge results
 */
@Injectable()
export class HybridSearchStrategy {
  constructor(
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
  ): Promise<SearchResult[]> {
    // 1. Semantic search (vector similarity)
    const queryEmbedding = await this.embeddingProvider.embedText(query);
    const semanticResults = await this.vectorStore.search(
      queryEmbedding,
      limit * 2,
      filter,
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
    // This is a placeholder - implement with actual keyword search backend
    // For now, return empty to demonstrate architecture
    return [];
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
}

