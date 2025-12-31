/**
 * Strategy Pattern: Abstract interface for embedding providers
 * Allows swapping between OpenAI, Cohere, local models, etc.
 */
export interface IEmbeddingProvider {
  /**
   * Generate embeddings for a single text
   */
  embedText(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get the dimension of embeddings produced by this provider
   */
  getDimensions(): number;

  /**
   * Get the provider name
   */
  getProviderName(): string;

  /**
   * Get estimated cost per 1K tokens
   */
  getCostPer1KTokens(): number;
}

