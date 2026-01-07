import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
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
  private readonly logger = new Logger(RAGService.name);
  private readonly contextualRetrievalEnabled: boolean;
  private readonly openai: OpenAI | null;

  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(VECTOR_STORE)
    private readonly vectorStore: IVectorStore,
    private readonly chunker: SemanticChunker,
    private readonly hybridSearch: HybridSearchStrategy,
    private readonly reranker: CrossEncoderReranker,
    private readonly configService: ConfigService,
  ) {
    this.contextualRetrievalEnabled =
      (this.configService.get<string>('CONTEXTUAL_RETRIEVAL_ENABLED') ?? 'true') !==
      'false';

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  /**
   * Index a document into the RAG system
   * Pipeline: Chunk → Embed → Store
   * 
   * OPTIMIZED: Accepts either text OR sessionEntries in metadata
   * - If sessionEntries provided: Uses structured data for speaker-aware chunking
   * - If text provided: Falls back to text-based chunking
   * 
   * @param text - The document text to index (optional if sessionEntries provided)
   * @param metadata - Metadata (sessionId, therapistId, sessionEntries, etc.)
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
      // Validate inputs: Require either text OR sessionEntries
      const hasText = text?.trim();
      const hasSessionEntries = metadata?.sessionEntries && Array.isArray(metadata.sessionEntries) && metadata.sessionEntries.length > 0;
      
      if (!hasText && !hasSessionEntries) {
        throw new Error('Either text content or sessionEntries is required for indexing');
      }
      if (!metadata?.sessionId) {
        throw new Error('SessionId is required in metadata');
      }

      // 1. Chunk the document intelligently
      const chunks = await this.chunker.process(text, metadata);

      if (chunks.length === 0) {
        throw new Error('Document chunking produced no results');
      }

      // 2. Generate embeddings with contextual retrieval (batch processing)
      let contextualizedTexts: string[];
      let contextSummaries: string[];

      if (this.contextualRetrievalEnabled && this.openai) {
        const contextPromises = chunks.map(chunk => 
          this.generateContextForChunk(chunk.text, metadata)
        );
        contextSummaries = await Promise.all(contextPromises);
        
        // Combine context with chunk text
        contextualizedTexts = chunks.map((chunk, index) => {
          const context = contextSummaries[index];
          return context ? `${context}\n\n${chunk.text}` : chunk.text;
        });
      } else {
        // No contextual retrieval: use raw chunks
        contextualizedTexts = chunks.map(chunk => chunk.text);
        contextSummaries = chunks.map(() => '');
      }

      const embeddings = await this.embeddingProvider.embedBatch(contextualizedTexts);

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
        text: chunk.text, // store original chunk text
        metadata: {
          sessionId: metadata.sessionId,
          therapistId: metadata.therapistId,
          clientId: metadata.clientId,
          timestamp: metadata.timestamp || new Date().toISOString(),
          ...chunk.metadata,
          indexedAt: new Date().toISOString(),
          contextSummary: contextSummaries[index] || null,
          contextualized: !!contextSummaries[index],
        },
      }));

      // 4. Store in vector database using upsert (atomic operation)
      // With deterministic IDs, upsert will UPDATE existing chunks and CREATE new ones
      // This is safe for test mode where entries are only added (never deleted)
      // 
      // Note: If entries can be deleted in production, add cleanup for orphaned chunks:
      // await this.vectorStore.deleteByMetadata({ 
      //   sessionId: metadata.sessionId, 
      //   chunkIndex: { $gte: chunks.length } 
      // });
      await this.vectorStore.upsertBatch(vectorDocuments);

      const duration = Date.now() - startTime;

      return {
        chunksCreated: chunks.length,
        vectorsStored: vectorDocuments.length,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error with structured context
      this.logger.error('Failed to index document', {
        sessionId: metadata?.sessionId,
        error: error.message,
        stack: error.stack,
        duration,
      });

      // Re-throw with context for caller to handle
      throw new Error(
        `Document indexing failed for session ${metadata?.sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * Generate deterministic document ID for vector storage
   * 
   * CRITICAL: ID must be deterministic (no timestamp) to enable proper upserts.
   * Without this, every reindex creates duplicate chunks instead of updating existing ones.
   * 
   * Format: sessionId_chunk_index
   * Example: abc123_chunk_0, abc123_chunk_1, etc.
   */
  private generateDocumentId(sessionId: string, chunkIndex: number): string {
    return `${sessionId}_chunk_${chunkIndex}`;
  }

  /**
   * Generate brief context for a chunk using OpenAI (if enabled).
   * Keeps output short to minimize cost and latency.
   */
  private async generateContextForChunk(
    chunkText: string,
    metadata: Record<string, any>,
  ): Promise<string> {
    if (!this.contextualRetrievalEnabled || !this.openai) return '';

    try {
      const truncatedChunk = chunkText.slice(0, 1200); // limit prompt size
      const speakerInfo = metadata?.speaker
        ? `Speaker: ${metadata.speaker}.`
        : '';
      const therapistInfo = metadata?.therapistId
        ? `Therapist ID: ${metadata.therapistId}.`
        : '';

      const prompt = `
Summarize and situate this chunk within its session context.
Include: who is speaking (if evident), topic/theme, and any prior relevant background.
Keep it under 80 words.

${speakerInfo} ${therapistInfo}

Chunk:
"${truncatedChunk}"
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You write concise context summaries for retrieval.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 120,
        temperature: 0.2,
      });

      const summary =
        response.choices?.[0]?.message?.content?.trim() ?? '';
      return summary;
    } catch (err) {
      this.logger.warn(`Context generation failed; using raw chunk: ${err}`);
      return '';
    }
  }


  /**
   * Search with advanced RAG features
   * 
   * DEFAULT PIPELINE (Industry Best Practice) ⭐:
   * 1. Semantic search (OpenAI text-embedding-3-large)
   * 2. Cross-encoder reranking (Cohere Rerank or OpenAI GPT-4o-mini)
   * 3. MMR diversity filtering (prevents redundant results)
   * 
   * Quality: Excellent (cross-encoder provides 10-30% improvement over semantic search alone)
   * This is the standard approach used by LangChain, LlamaIndex, and recommended by Cohere/OpenAI
   * 
   * Why This Pipeline:
   * 
   * Stage 1 - Semantic Search (Bi-encoder):
   *   - Fast, approximate retrieval from large corpus
   *   - Encodes query and documents separately
   *   - Good recall, but may miss nuanced relevance
   * 
   * Stage 2 - Cross-encoder Reranking:
   *   - Sees query + document together (better understanding)
   *   - Directly models relevance (not just similarity)
   *   - Significantly improves precision for complex queries
   *   - Example: "techniques that didn't work" vs "techniques that helped"
   * 
   * Stage 3 - MMR Diversity:
   *   - Balances relevance with diversity
   *   - For therapy: returns breathing, CBT, relaxation (not 3x breathing)
   *   - Lambda=0.7: 70% relevance, 30% diversity
   * 
   * Alternative Configurations:
   * 
   * Budget Mode (useReranking: false, diversityMode: true):
   *   - Skip cross-encoder reranking (no API cost)
   *   - Quality: Good, but lower than default
   *   - Use when: Cost is primary concern
   * 
   * Precision Only (useReranking: true, diversityMode: false):
   *   - Skip diversity filtering
   *   - Returns top most relevant (may be similar)
   *   - Use when: Looking for single best match
   * 
   * Raw Search (useReranking: false, diversityMode: false):
   *   - No post-processing
   *   - Use when: Debugging, benchmarking
   * 
   * @param query Search query text
   * @param options Search configuration
   * @returns Ranked search results
   */
  async search(
    query: string,
    options: {
      limit?: number;
      therapistId?: string;
      useHybrid?: boolean;
      useReranking?: boolean;
      diversityMode?: boolean;
      diversityLambda?: number;
      minSimilarity?: number;
    } = {},
  ) {
    const {
      limit = 10,
      therapistId,
      useHybrid = false, // Disabled: Current hybrid has granularity mismatch (session-level BM25 vs chunk-level semantic)
      useReranking = true, // ENABLED: Industry best practice - cross-encoder reranking improves quality 10-30%
      diversityMode = true, // ENABLED: MMR diversity for varied results (prevents redundant results)
      diversityLambda = 0.7, // 70% relevance, 30% diversity
      minSimilarity = 0.3,
    } = options;

    const queryEmbedding = await this.embeddingProvider.embedText(query);

    // 1. Initial retrieval (semantic or hybrid)
    let results = useHybrid
      ? await this.hybridSearch.search(
          query,
          limit * 2,
          0.7,
          { therapistId },
          minSimilarity,
        )
      : await this.vectorStore.search(
          queryEmbedding,
          limit * 2,
          { therapistId } as any,
          minSimilarity,
        );

    if (results.length === 0) {
      return [];
    }

    // 2. Optional: API-based reranking for quality (industry best practice)
    // COST: ~$0.001 per search (OpenAI) or $0.002 (Cohere)
    // BENEFIT: Significantly improves relevance for complex queries
    if (useReranking) {
      this.logger.debug('Applying API reranking (Cohere/OpenAI)');
      results = await this.reranker.rerank(query, results, limit * 2);
    }

    // 3. Diversity filtering with MMR (recommended for therapy sessions)
    // FREE: Local computation, no API calls
    // BENEFIT: Prevents redundant results, returns varied techniques
    if (diversityMode) {
      this.logger.debug('Applying MMR diversity filtering');
      results = await this.reranker.rerankWithMMR(
        query,
        results,
        diversityLambda,
        limit,
      );
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

