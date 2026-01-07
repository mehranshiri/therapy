# RAG Decisions (live log)

## Embeddings (2025-01)
- Provider: OpenAI
- Model: `text-embedding-3-large`
- Dimension: 1024 (Matryoshka-capable)
- Batch size: up to 128 inputs per call
- Max input length: 200,000 characters (trim + warn)
- Retries: exponential backoff, 3 attempts, starting at 1s
- Normalization: validate and normalize defensively
- API key: `OPENAI_API_KEY` (env only, no hardcoding)

## Search (2025-01)
- Architecture: Single-stage chunk search (sufficient for current scale < 1000 sessions)
- Method: Pure semantic search (vector similarity)
- Similarity threshold: default 0.3 (filter low-quality vector hits)
- Hybrid search: Available but disabled by default due to architectural issue (session-level BM25 vs chunk-level semantic search = granularity mismatch)
- RAG service: accepts `minSimilarity`, propagates to vector store
- Vector store: pgvector adapter filters by similarity; interface supports `minSimilarity`
- Next planned: 
  - Fix hybrid search to work at chunk-level (requires chunk-level BM25 implementation)
  - Consider dedicated search backend (Elasticsearch/Meilisearch) for production keyword search
  - HyDE query expansion
- Future consideration: Two-stage hierarchical retrieval (sessions → chunks) if scaling to 10,000+ sessions

## Reranking (2025-01)
- Architecture: Two-stage sequential pipeline (industry best practice)
  1. Cross-encoder reranking (Cohere/OpenAI) - 10-30% quality improvement over semantic search alone
  2. MMR diversity filtering - prevents redundant results, ensures varied techniques
- Default: BOTH ENABLED (`useReranking: true, diversityMode: true`)
- Provider: Cohere Rerank (`rerank-english-v3.0` preferred), fallback to OpenAI (`gpt-4o-mini`)
- Rationale: Quality-first approach for therapy application; follows LangChain/LlamaIndex standard
- Why cross-encoder: Sees query+document together (vs bi-encoder semantic search that encodes separately)
- Budget option: Set `useReranking: false` to skip API reranking (uses only MMR diversity)

## Contextual Retrieval (2025-01)
- Enabled by default (`CONTEXTUAL_RETRIEVAL_ENABLED=true`)
- At indexing time, generate a brief context summary per chunk via OpenAI (`gpt-4o-mini`), prepend to chunk before embedding
- Store original chunk text; store `contextSummary` and `contextualized` flag in metadata
- Goal: Preserve document/session context in embeddings; improves recall and relevance
- Fallback: if context generation fails or disabled, embed raw chunk

## Diversity Reranking (2025-01)
- Enabled by default (`diversityMode=true`)
- Uses MMR (Maximal Marginal Relevance) algorithm
- Lambda: 0.7 (70% relevance, 30% diversity)
- Balances relevance with diversity to avoid redundant results
- Computed locally (no extra API calls)
- Best for therapy session search (returns varied techniques instead of similar ones)

