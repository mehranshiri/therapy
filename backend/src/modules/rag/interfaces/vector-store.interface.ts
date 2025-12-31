/**
 * Repository Pattern: Abstract vector database operations
 * Supports Pinecone, Weaviate, pgvector, Qdrant, etc.
 */

export interface VectorMetadata {
  sessionId: string;
  therapistId: string;
  clientId: string;
  timestamp: string;
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: any;
}

export interface VectorDocument {
  id: string;
  embedding: number[];
  text: string;
  metadata: VectorMetadata;
}

export interface SearchResult {
  id: string;
  score: number;
  text: string;
  metadata: VectorMetadata;
}

export interface IVectorStore {
  /**
   * Insert a single vector document
   */
  upsert(document: VectorDocument): Promise<void>;

  /**
   * Insert multiple vector documents (batch)
   */
  upsertBatch(documents: VectorDocument[]): Promise<void>;

  /**
   * Search for similar vectors
   */
  search(
    queryEmbedding: number[],
    limit: number,
    filter?: Partial<VectorMetadata>,
  ): Promise<SearchResult[]>;

  /**
   * Delete vectors by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete vectors by metadata filter
   */
  deleteByMetadata(filter: Partial<VectorMetadata>): Promise<void>;

  /**
   * Get vector by ID
   */
  getById(id: string): Promise<VectorDocument | null>;

  /**
   * Check if vector store is healthy
   */
  healthCheck(): Promise<boolean>;
}

