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
- Similarity threshold: default 0.3 (filter low-quality vector hits)
- Hybrid search: semantic + keyword/BM25 (in-app BM25 over session text, capped to 500 docs; RRF fusion)
- RAG service: accepts `minSimilarity`, propagates to vector store and hybrid
- Vector store: pgvector adapter filters by similarity; interface supports `minSimilarity`
- Next planned: hierarchical retrieval; HyDE query expansion; real cross-encoder rerank; swap BM25 to dedicated search backend for scale

## Reranking (2025-01)
- Default: Enabled (`useReranking: true`) using OpenAI listwise rerank (`gpt-4o-mini`) when `OPENAI_API_KEY` is set
- Optional: Cohere Rerank (`rerank-english-v3.0`) when `COHERE_API_KEY` is set (preferred if available)
- Fallback heuristic exists but is low-quality; used only if no APIs succeed
- Next: Optionally replace with an on-prem cross-encoder (e.g., `bge-reranker-v2-m3`) if avoiding external calls

## Contextual Retrieval (2025-01)
- Enabled by default (`CONTEXTUAL_RETRIEVAL_ENABLED=true`)
- At indexing time, generate a brief context summary per chunk via OpenAI (`gpt-4o-mini`), prepend to chunk before embedding
- Store original chunk text; store `contextSummary` and `contextualized` flag in metadata
- Goal: Preserve document/session context in embeddings; improves recall and relevance
- Fallback: if context generation fails or disabled, embed raw chunk

## Hierarchical Retrieval (2025-01)
- Enabled by default (`useHierarchical=true`)
- Two-stage: doc-level semantic search (sessions) → search limited to those session IDs (semantic or hybrid keyword/BM25)
- Combines doc score + chunk/keyword score (weighted) and trims to top-K
- Filters support `sessionIds` in vector store and hybrid keyword path
- Goal: reduce search space and boost relevance by focusing on top candidate sessions

