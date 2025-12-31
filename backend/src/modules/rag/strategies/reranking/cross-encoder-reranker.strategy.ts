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
   * Minimum relevance threshold (0.0 to 1.0)
   */
  private readonly MIN_RELEVANCE_THRESHOLD = 0.1;

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

    // Apply relevance threshold: filter out results below minimum threshold
    const topScore = scoredResults[0]?.score || 0;
    const relativeThreshold = topScore > 0.2 ? topScore * 0.5 : this.MIN_RELEVANCE_THRESHOLD;
    const finalThreshold = Math.max(this.MIN_RELEVANCE_THRESHOLD, relativeThreshold);

    const relevantResults = scoredResults.filter((r) => r.score >= finalThreshold);

    return relevantResults.slice(0, topK);
  }

  /**
   * Compute relevance score between query and document
   * In production, use: sentence-transformers/cross-encoder models
   * For mock: use word overlap heuristic with normalization
   * 
   * @param query Search query text
   * @param document Document text to score
   * @returns Relevance score between 0 and 1 (1 = perfect match)
   */
  private async computeRelevance(
    query: string,
    document: string,
  ): Promise<number> {
    // Early return for empty inputs
    if (!query?.trim() || !document?.trim()) {
      return 0;
    }

    // Extract and normalize words from query and document
    const queryWords = this.extractSignificantWords(query);
    const documentWords = this.extractSignificantWords(document);

    // Early return if no significant words in query
    if (queryWords.size === 0) {
      return 0;
    }

    // Count word matches
    const matchCount = Array.from(documentWords).filter((word) =>
      queryWords.has(word),
    ).length;

    // Normalize by query word count (precision: how many query words matched)
    const precision = matchCount / queryWords.size;

    // Also consider recall (how many document words matched query)
    // This helps when document is very long
    const recall = matchCount / Math.max(documentWords.size, 1);

    // F1 score: harmonic mean of precision and recall
    // Balances both metrics for better relevance scoring
    if (precision === 0 && recall === 0) {
      return 0;
    }

    const f1Score = (2 * precision * recall) / (precision + recall);

    return f1Score;
  }

  /**
   * Extract significant words from text
   * Filters out short words and common stop words
   * 
   * @param text Input text
   * @returns Set of normalized significant words
   */
  private extractSignificantWords(text: string): Set<string> {
    const MIN_WORD_LENGTH = 3;
    const STOP_WORDS = new Set([
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'been',
      'were', 'was', 'are', 'you', 'your', 'can', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'shall', 'the', 'a', 'an', 'as',
    ]);

    return new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.replace(/[^\w]/g, '')) // Remove punctuation
        .filter(
          (word) =>
            word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word),
        ),
    );
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

