import { Injectable, Inject } from '@nestjs/common';
import { IEmbeddingProvider } from './interfaces/embedding-provider.interface';
import { IVectorStore, VectorDocument } from './interfaces/vector-store.interface';
import { EMBEDDING_PROVIDER, VECTOR_STORE } from './constants/tokens';
import { SemanticChunker } from './strategies/chunking/semantic-chunker.strategy';
import { HybridSearchStrategy } from './strategies/search/hybrid-search.strategy';
import { CrossEncoderReranker } from './strategies/reranking/cross-encoder-reranker.strategy';

/**
 * RAG Service - Orchestrates the entire RAG pipeline
 * Uses dependency injection for all strategies (Strategy Pattern)
 */
@Injectable()
export class RAGService {
  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(VECTOR_STORE)
    private readonly vectorStore: IVectorStore,
    private readonly chunker: SemanticChunker,
    private readonly hybridSearch: HybridSearchStrategy,
    private readonly reranker: CrossEncoderReranker,
  ) {}

  /**
   * Index a document into the RAG system
   * Pipeline: Chunk → Embed → Store
   * 
   * @param text - The document text to index
   * @param metadata - Metadata (sessionId, therapistId, etc.)
   * @returns Promise with indexing results
   * @throws Error if indexing fails
   */
  async indexDocument(
    text: string,
    metadata: Record<string, any>,
  ): Promise<{
    chunksCreated: number;
    vectorsStored: number;
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      // Validate inputs
      if (!text?.trim()) {
        throw new Error('Text content is required for indexing');
      }
      if (!metadata?.sessionId) {
        throw new Error('SessionId is required in metadata');
      }

      // 1. Chunk the document intelligently
      const chunks = await this.chunker.process(text, metadata);

      if (chunks.length === 0) {
        throw new Error('Document chunking produced no results');
      }

      // 2. Generate embeddings for all chunks (batch processing for efficiency)
      const chunkTexts = chunks.map(({ text }) => text);
      const embeddings = await this.embeddingProvider.embedBatch(chunkTexts);

      // Validate embeddings match chunks
      if (embeddings.length !== chunks.length) {
        throw new Error(
          `Embedding count mismatch: ${embeddings.length} embeddings for ${chunks.length} chunks`,
        );
      }

      // 3. Transform to vector documents with unique IDs
      const vectorDocuments: VectorDocument[] = chunks.map((chunk, index) => ({
        id: this.generateDocumentId(metadata.sessionId, index),
        embedding: embeddings[index],
        text: chunk.text,
        metadata: {
          sessionId: metadata.sessionId,
          therapistId: metadata.therapistId,
          clientId: metadata.clientId,
          timestamp: metadata.timestamp || new Date().toISOString(),
          ...chunk.metadata,
          indexedAt: new Date().toISOString(),
        },
      }));

      // 4. Store in vector database (atomic operation)
      await this.vectorStore.upsertBatch(vectorDocuments);

      const duration = Date.now() - startTime;

      return {
        chunksCreated: chunks.length,
        vectorsStored: vectorDocuments.length,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error with context
      console.error('Failed to index document:', {
        sessionId: metadata?.sessionId,
        error: error.message,
        duration,
      });

      throw new Error(
        `Document indexing failed: ${error.message}`,
      );
    }
  }

  /**
   * Generate unique document ID for vector storage
   */
  private generateDocumentId(sessionId: string, chunkIndex: number): string {
    const timestamp = Date.now();
    return `${sessionId}_chunk_${chunkIndex}_${timestamp}`;
  }


  /**
   * Search with advanced RAG features
   * Pipeline: Embed Query → Hybrid Search → Rerank → Return
   */
  async search(
    query: string,
    options: {
      limit?: number;
      therapistId?: string;
      useHybrid?: boolean;
      useReranking?: boolean;
      diversityMode?: boolean;
    } = {},
  ) {
    const {
      limit = 10,
      therapistId,
      useHybrid = true,
      useReranking = true,
      diversityMode = false,
    } = options;

    // 1. Perform search (hybrid or semantic)
    let results = useHybrid
      ? await this.hybridSearch.search(query, limit * 2, 0.7, { therapistId })
      : await this.vectorStore.search(
          await this.embeddingProvider.embedText(query),
          limit * 2,
          { therapistId } as any,
        );

    // 2. Apply reranking if enabled
    if (useReranking && results.length > 0) {
      results = diversityMode
        ? await this.reranker.rerankWithMMR(query, results, 0.5, limit)
        : await this.reranker.rerank(query, results, limit);
    } else {
      results = results.slice(0, limit);
    }

    return results;
  }

  /**
   * Get embedding provider info
   */
  getProviderInfo() {
    return {
      name: this.embeddingProvider.getProviderName(),
      dimensions: this.embeddingProvider.getDimensions(),
      costPer1K: this.embeddingProvider.getCostPer1KTokens(),
    };
  }

  /**
   * Health check for all components
   */
  async healthCheck() {
    const vectorStoreHealth = await this.vectorStore.healthCheck();

    return {
      vectorStore: vectorStoreHealth,
      embeddingProvider: this.embeddingProvider.getProviderName(),
      status: vectorStoreHealth ? 'healthy' : 'degraded',
    };
  }
}

