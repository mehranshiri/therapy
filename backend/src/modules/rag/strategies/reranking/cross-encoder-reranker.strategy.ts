import { Injectable } from '@nestjs/common';
import { SearchResult } from '../../interfaces/vector-store.interface';

/**
 * Cross-Encoder Reranking Strategy
 * Uses a cross-encoder model to rerank search results
 * More accurate than bi-encoder but slower (use after initial retrieval)
 */
@Injectable()
export class CrossEncoderReranker {
  /**
   * Rerank search results using cross-encoder
   * @param query Original search query
   * @param results Initial search results
   * @param topK Return top K results after reranking
   */
  async rerank(
    query: string,
    results: SearchResult[],
    topK: number = 10,
  ): Promise<SearchResult[]> {
    // Score each result against the query
    const scoredResults = await Promise.all(
      results.map(async (result) => {
        const relevanceScore = await this.computeRelevance(query, result.text);
        return {
          ...result,
          score: relevanceScore,
        };
      }),
    );

    // Sort by relevance score
    scoredResults.sort((a, b) => b.score - a.score);

    return scoredResults.slice(0, topK);
  }

  /**
   * Compute relevance score between query and document
   * In production, use: sentence-transformers/cross-encoder models
   * For mock: use simple text overlap heuristic
   */
  private async computeRelevance(
    query: string,
    document: string,
  ): Promise<number> {
    // Mock implementation using word overlap
    const queryWords = new Set(
      query.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    );
    const docWords = document.toLowerCase().split(/\s+/);

    let matchCount = 0;
    docWords.forEach((word) => {
      if (word.length > 3 && queryWords.has(word)) {
        matchCount++;
      }
    });

    // Normalize by query length
    return matchCount / Math.max(queryWords.size, 1);
  }

  /**
   * Maximal Marginal Relevance (MMR) Reranking
   * Balances relevance with diversity to avoid redundant results
   */
  async rerankWithMMR(
    query: string,
    results: SearchResult[],
    lambda: number = 0.5, // 0 = pure diversity, 1 = pure relevance
    topK: number = 10,
  ): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    const selected: SearchResult[] = [];
    const remaining = [...results];

    // Start with the most relevant document
    selected.push(remaining.shift()!);

    while (selected.length < topK && remaining.length > 0) {
      let bestScore = -Infinity;
      let bestIndex = 0;

      // For each remaining document, compute MMR score
      remaining.forEach((doc, index) => {
        // Relevance to query
        const relevance = doc.score;

        // Maximum similarity to already selected documents
        const maxSimilarity = Math.max(
          ...selected.map((sel) =>
            this.cosineSimilarity(doc.text, sel.text),
          ),
        );

        // MMR score
        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = index;
        }
      });

      selected.push(remaining.splice(bestIndex, 1)[0]);
    }

    return selected;
  }

  /**
   * Simple cosine similarity for text (using word vectors)
   */
  private cosineSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = words1.filter((w) => words2.has(w)).length;
    const union = words1.length + words2.size - intersection;

    return intersection / Math.max(union, 1);
  }
}

