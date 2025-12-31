import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Session } from '../sessions/entities/session.entity';

// Service
import { RAGService } from './rag.service';

// DI Tokens
import { EMBEDDING_PROVIDER, VECTOR_STORE } from './constants/tokens';

// Implementations
import { OpenAIEmbeddingProvider } from './providers/openai-embedding.provider';
import { PgVectorAdapter } from './adapters/pgvector.adapter';

// Strategies
import { SemanticChunker } from './strategies/chunking/semantic-chunker.strategy';
import { HybridSearchStrategy } from './strategies/search/hybrid-search.strategy';
import { CrossEncoderReranker } from './strategies/reranking/cross-encoder-reranker.strategy';

/**
 * RAG Module - Enterprise-grade Retrieval Augmented Generation
 * 
 * Features:
 * - Multiple embedding providers (Strategy Pattern)
 * - Multiple vector stores (Repository Pattern)
 * - Document chunking pipeline (Chain of Responsibility)
 * - Hybrid search (semantic + keyword)
 * - Advanced reranking (Cross-Encoder, MMR)
 * - Extensible and testable architecture
 */
@Module({
  imports: [TypeOrmModule.forFeature([Session]), ConfigModule],
  providers: [
    RAGService,
    
    // Embedding Provider (Strategy Pattern)
    // Use symbol token instead of interface for DI
    {
      provide: EMBEDDING_PROVIDER,
      useClass: OpenAIEmbeddingProvider, // Easy to swap: CohereEmbeddingProvider, LocalEmbeddingProvider
    },
    
    // Vector Store (Repository Pattern)
    // Use symbol token instead of interface for DI
    {
      provide: VECTOR_STORE,
      useClass: PgVectorAdapter, // Easy to swap: PineconeAdapter, WeaviateAdapter
    },
    
    // Strategies
    SemanticChunker,
    HybridSearchStrategy,
    CrossEncoderReranker,
  ],
  exports: [RAGService, EMBEDDING_PROVIDER, VECTOR_STORE],
})
export class RAGModule {}

