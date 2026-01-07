import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SearchResult } from '../../interfaces/vector-store.interface';

/**
 * Cross-Encoder Reranking Strategy
 * Uses a cross-encoder model to rerank search results
 * More accurate than bi-encoder but slower (use after initial retrieval)
 */
@Injectable()
export class CrossEncoderReranker {
  private readonly logger = new Logger(CrossEncoderReranker.name);
  private readonly cohereApiKey?: string;
  private readonly cohereModel = 'rerank-english-v3.0'; // Cohere rerank model
  private readonly openaiApiKey?: string;
  private readonly openai: OpenAI | null;
  private readonly openaiModel = 'gpt-4o-mini';

  constructor(private readonly configService: ConfigService) {
    this.cohereApiKey = this.configService.get<string>('COHERE_API_KEY');
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = this.openaiApiKey ? new OpenAI({ apiKey: this.openaiApiKey }) : null;
  }

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
    // Prefer Cohere rerank if API key is present
    if (this.cohereApiKey) {
      try {
        const reranked = await this.rerankWithCohere(query, results, topK);
        if (reranked.length > 0) return reranked;
      } catch (err) {
        this.logger.warn(`Cohere rerank failed, falling back: ${err}`);
      }
    }

    // Try OpenAI listwise rerank if available
    if (this.openai) {
      try {
        const reranked = await this.rerankWithOpenAI(query, results, topK);
        if (reranked.length > 0) return reranked;
      } catch (err) {
        this.logger.warn(`OpenAI rerank failed, falling back: ${err}`);
      }
    }

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
   * Cohere Rerank (if COHERE_API_KEY is provided)
   */
  private async rerankWithCohere(
    query: string,
    results: SearchResult[],
    topK: number,
  ): Promise<SearchResult[]> {
    if (!this.cohereApiKey) return [];
    if (results.length === 0) return [];

    const body = {
      model: this.cohereModel,
      query,
      documents: results.map((r) => r.text),
      top_n: Math.min(topK, results.length),
    };

    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cohereApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cohere rerank error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const reranked: SearchResult[] = data.results
      .map((item: any) => {
        const original = results[item.index];
        if (!original) return null;
        return {
          ...original,
          score: item.relevance_score ?? original.score,
        };
      })
      .filter((x: SearchResult | null): x is SearchResult => !!x)
      .slice(0, topK);

    return reranked;
  }

  /**
   * OpenAI listwise rerank (if OPENAI_API_KEY is provided)
   * Uses a concise JSON-ranked response to minimize parsing errors.
   */
  private async rerankWithOpenAI(
    query: string,
    results: SearchResult[],
    topK: number,
  ): Promise<SearchResult[]> {
    if (!this.openai) return [];
    if (results.length === 0) return [];

    const capped = results.slice(0, Math.min(results.length, 20)); // cap to limit cost

    const docList = capped
      .map((r, i) => `[${i}] ${r.text}`)
      .join('\n');

    const prompt = `
You are reranking search results for relevance to the query.
Return ONLY a JSON array of result indices in order of relevance (no other text).

Query:
${query}

Results:
${docList}

JSON array of indices (most relevant first):
`;

    const response = await this.openai.chat.completions.create({
      model: this.openaiModel,
      messages: [
        { role: 'system', content: 'You produce JSON arrays of indices for reranking.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.0,
      max_tokens: 100,
    });

    const content = response.choices?.[0]?.message?.content ?? '';

    let indices: number[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        indices = parsed.filter((n) => Number.isInteger(n));
      }
    } catch (err) {
      this.logger.warn(`OpenAI rerank parse failed: ${err}`);
      return [];
    }

    const reranked = indices
      .map((i) => capped[i])
      .filter((r): r is SearchResult => !!r)
      .slice(0, topK);

    return reranked;
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
   * @returns Set of normalized significant words (unique)
   */
  private extractSignificantWords(text: string): Set<string> {
    return new Set(this.extractSignificantWordsArray(text));
  }

  /**
   * Extract significant words as array (preserves duplicates for TF counting)
   * 
   * @param text Input text
   * @returns Array of normalized significant words (with duplicates)
   */
  private extractSignificantWordsArray(text: string): string[] {
    const MIN_WORD_LENGTH = 3;
    const STOP_WORDS = new Set([
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'been',
      'were', 'was', 'are', 'you', 'your', 'can', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'shall', 'a', 'an', 'as', 'but', 'not',
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/[^\w]/g, '')) // Remove punctuation
      .filter(
        (word) =>
          word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word),
      );
  }

  /**
   * Maximal Marginal Relevance (MMR) Reranking
   * Balances relevance with diversity to avoid redundant results
   * 
   * BEST PRACTICE: Uses vector similarity (dot product) when embeddings available
   * FALLBACK: Uses TF-Cosine text similarity when embeddings missing
   * 
   * Strategy: Per-pair decision (not all-or-nothing) for optimal performance
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
        // Relevance to query (from initial search)
        const relevance = doc.score;

        // Maximum similarity to already selected documents
        // Uses per-pair decision: vector if available, text otherwise
        const maxSimilarity = this.computeMaxSimilarity(doc, selected);

        // MMR score: balance relevance and diversity
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
   * Compute maximum similarity between a document and selected documents
   * BEST PRACTICE: Per-pair decision for optimal performance
   * - Uses vector similarity (dot product) when both docs have embeddings
   * - Falls back to TF-Cosine text similarity when embeddings missing
   */
  private computeMaxSimilarity(doc: SearchResult, selected: SearchResult[]): number {
    if (selected.length === 0) return 0;

    return Math.max(
      ...selected.map((sel) => {
        // Try vector similarity first (most accurate, fastest)
        if (doc.embedding && sel.embedding && 
            doc.embedding.length > 0 && sel.embedding.length > 0) {
          return this.dotProduct(doc.embedding, sel.embedding);
        }
        // Fallback to text similarity
        return this.tfCosineSimilarity(doc.text, sel.text);
      }),
    );
  }

  /**
   * Dot product for normalized vectors (OpenAI embeddings)
   * For normalized vectors, dot product equals cosine similarity
   */
  private dotProduct(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      this.logger.warn(`Vector dimension mismatch in MMR: ${vecA.length} vs ${vecB.length}`);
      return 0;
    }

    let product = 0;
    for (let i = 0; i < vecA.length; i++) {
      product += vecA[i] * vecB[i];
    }

    // Clamp to [-1, 1] for safety (handles floating point errors)
    return Math.max(-1, Math.min(1, product));
  }

  /**
   * TF-weighted cosine similarity for text
   * 
   * Accounts for word frequency (term frequency), which is important for
   * therapy sessions where repeated terms indicate emphasis/importance.
   * 
   * @param text1 First document text
   * @param text2 Second document text
   * @returns Similarity score between 0 and 1 (1 = identical)
   */
  private tfCosineSimilarity(text1: string, text2: string): number {
    // Extract significant words as ARRAYS (preserve duplicates for TF counting)
    const words1 = this.extractSignificantWordsArray(text1);
    const words2 = this.extractSignificantWordsArray(text2);

    // Handle empty text edge cases
    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }

    // Build term frequency maps
    const tf1 = this.buildTermFrequency(words1);
    const tf2 = this.buildTermFrequency(words2);

    // Build combined vocabulary
    const vocab = new Set([...tf1.keys(), ...tf2.keys()]);

    // Compute cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    vocab.forEach(term => {
      const freq1 = tf1.get(term) || 0;
      const freq2 = tf2.get(term) || 0;

      dotProduct += freq1 * freq2;
      norm1 += freq1 * freq1;
      norm2 += freq2 * freq2;
    });

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    
    // Division by zero protection
    if (denominator === 0 || !Number.isFinite(denominator)) {
      return 0;
    }

    const similarity = dotProduct / denominator;
    
    // Clamp to [0, 1] to handle floating point errors
    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Build term frequency map from array of words
   * Handles duplicates in the input array (from text with repeated terms)
   * 
   * @param words Array of words (can contain duplicates)
   * @returns Map of word -> frequency
   */
  private buildTermFrequency(words: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    
    for (const word of words) {
      tf.set(word, (tf.get(word) || 0) + 1);
    }
    
    return tf;
  }

}

