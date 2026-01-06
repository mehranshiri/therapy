# Modern RAG Architecture Analysis

## Executive Summary

This document analyzes the current RAG implementation and identifies **critical gaps** compared to state-of-the-art 2024/2025 approaches. The CTO's feedback was accurate: the current implementation uses techniques from 2022-era RAG systems that have been superseded by significantly better approaches.

---

## Current Implementation Issues

### 1. Embedding Model: **OUTDATED**

**Current:**
```typescript
private readonly model = 'text-embedding-ada-002';  // ❌ Deprecated
private readonly dimensions = 1536;
```

**Problems:**
- `text-embedding-ada-002` was released in Dec 2022 and is now **deprecated**
- Outperformed by newer models on every benchmark
- No support for **Matryoshka Representation Learning (MRL)** / dimension truncation
- Fixed dimensions, no flexibility

**Modern Alternatives (2024-2025):**

| Model | Dimensions | MTEB Score | Key Features |
|-------|-----------|------------|--------------|
| `text-embedding-3-large` | 256-3072 | 64.6 | MRL, dimension control |
| `text-embedding-3-small` | 256-1536 | 62.3 | MRL, 5x cheaper |
| `voyage-3` | 1024 | 67.1 | Best commercial model |
| `voyage-3-lite` | 512 | 64.0 | Fast, efficient |
| `jina-embeddings-v3` | 1024 | 65.5 | Multi-task, open weights |
| `Cohere embed-v3` | 1024 | 64.5 | Multi-lingual |
| `BGE-M3` | 1024 | 65.0 | Multi-lingual, sparse+dense |

**Recommended Fix:**
- Upgrade to `text-embedding-3-large` with MRL for dimension flexibility
- Or use `voyage-3` for best-in-class retrieval quality

---

### 2. Chunking Strategy: **SEVERELY OUTDATED**

**Current (Naive Sentence Chunking):**
```typescript
// ❌ This is 2022-era "naive chunking"
private chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  // Simple token-based chunking with overlap
  // LOSES ALL DOCUMENT CONTEXT
}
```

**Critical Problems:**
1. **Context Loss**: Each chunk loses its relationship to the document
2. **No semantic boundaries**: Splits by character count, not meaning
3. **Overlap is primitive**: Word-based overlap doesn't preserve semantics
4. **No speaker awareness**: Therapy sessions have therapist/client turns that should be preserved

**Modern Chunking Approaches (2024-2025):**

#### A. **Contextual Retrieval (Anthropic, Sep 2024)**
Prepend document context to each chunk before embedding:

```typescript
// Before embedding, use LLM to generate context
const contextualChunk = await llm.generate({
  prompt: `
    Document: "${fullDocument}"
    
    Chunk: "${chunk}"
    
    Generate a brief context that situates this chunk within the document.
    Focus on: who is speaking, what topic is being discussed, and any 
    relevant background from earlier in the document.
  `
});

// Embed: context + original chunk
const embedding = await embed(contextualChunk + "\n\n" + chunk);
```

**Impact**: 49% reduction in retrieval failures (Anthropic research)

#### B. **Late Chunking (Jina AI, 2024)**
Embed the full document first, then extract chunk embeddings:

```typescript
// 1. Encode full document through transformer (gets token embeddings)
const tokenEmbeddings = await model.encodeTokens(fullDocument);

// 2. For each chunk, pool the token embeddings that belong to it
const chunkEmbeddings = chunks.map((chunk, i) => {
  const startToken = tokenBoundaries[i].start;
  const endToken = tokenBoundaries[i].end;
  return meanPool(tokenEmbeddings.slice(startToken, endToken));
});
```

**Impact**: Chunks maintain full document context through attention mechanism

#### C. **Semantic Chunking with Embedding Similarity**
Use embeddings to find natural semantic boundaries:

```typescript
// 1. Split into sentences
// 2. Embed each sentence
// 3. Find breakpoints where cosine similarity drops significantly
// 4. Group sentences between breakpoints
const boundaries = findSemanticBoundaries(sentenceEmbeddings, threshold: 0.5);
```

#### D. **Agentic Chunking**
Use an LLM to decide chunk boundaries based on meaning:

```typescript
const chunks = await llm.generate({
  prompt: `Split this document into semantic chunks. Each chunk should:
    - Contain one complete idea/topic
    - Preserve speaker context
    - Be self-contained but reference context when needed
    
    Document: ${document}
  `
});
```

---

### 3. Search Strategy: **OUTDATED**

**Current:**
```typescript
// ❌ Basic single-vector cosine similarity
const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
```

**Problems:**
- Single-vector representations lose fine-grained information
- No learned sparse representations
- No late interaction/multi-vector matching
- Hybrid search not actually implemented (BM25 returns empty)

**Modern Search Approaches (2024-2025):**

#### A. **ColBERT / Late Interaction Models**
Instead of single vector per document, use token-level embeddings:

```typescript
// ColBERT approach: MaxSim between all query-doc token pairs
const queryTokens = await colbert.encodeQuery(query);  // [n, 128]
const docTokens = await colbert.encodeDoc(document);   // [m, 128]

// MaxSim: for each query token, find max similarity to any doc token
let score = 0;
for (const qToken of queryTokens) {
  const maxSim = Math.max(...docTokens.map(dToken => 
    cosineSimilarity(qToken, dToken)
  ));
  score += maxSim;
}
```

**Impact**: 10-15% better retrieval accuracy than single-vector

#### B. **SPLADE (Learned Sparse Retrieval)**
Learns which terms are important, creates sparse representations:

```typescript
// SPLADE: sparse lexical + semantic
const sparseVector = await splade.encode(text);  // Mostly zeros, few important terms
// Compatible with inverted indexes, extremely efficient
```

**Impact**: Combines lexical precision with semantic understanding

#### C. **Hybrid Dense + Sparse (BGE-M3 Style)**
Best of both worlds:

```typescript
// BGE-M3 produces both dense and sparse vectors
const { dense, sparse, colbert } = await bgeM3.encode(text);

// Search with all three, combine with learned weights
const denseScore = cosineSimilarity(queryDense, docDense);
const sparseScore = bm25Style(querySparse, docSparse);
const colbertScore = maxSim(queryColbert, docColbert);

const finalScore = 0.4 * denseScore + 0.3 * sparseScore + 0.3 * colbertScore;
```

#### D. **Hypothetical Document Embeddings (HyDE)**
Generate a hypothetical answer, then search for similar real documents:

```typescript
// 1. Generate hypothetical answer
const hypothetical = await llm.generate({
  prompt: `Answer this question: "${query}"\n\nProvide a detailed answer as if you had access to the information.`
});

// 2. Embed the hypothetical answer
const hydeEmbedding = await embed(hypothetical);

// 3. Search for real documents similar to the hypothetical
const results = await vectorStore.search(hydeEmbedding);
```

**Impact**: 10-15% improvement on knowledge-intensive tasks

---

### 4. Reranking: **MOCK IMPLEMENTATION**

**Current:**
```typescript
// ❌ Word overlap heuristic - NOT a cross-encoder
private async computeRelevance(query: string, document: string): Promise<number> {
  const queryWords = this.extractSignificantWords(query);
  const documentWords = this.extractSignificantWords(document);
  // ... F1 score based on word overlap
}
```

**Problems:**
- Not using an actual cross-encoder model
- Word overlap is extremely primitive
- Misses semantic similarity entirely

**Modern Reranking (2024-2025):**

#### A. **Actual Cross-Encoder Models**

```typescript
// Use models like: ms-marco-MiniLM-L-12-v2, bge-reranker-v2-m3
const reranker = new CrossEncoder('BAAI/bge-reranker-v2-m3');

const scores = await Promise.all(
  documents.map(doc => reranker.predict(query, doc.text))
);
```

#### B. **Cohere Rerank API**

```typescript
const reranked = await cohere.rerank({
  model: 'rerank-v3.5',
  query: query,
  documents: documents.map(d => d.text),
  top_n: 10
});
```

#### C. **Listwise Reranking with LLMs**
Use LLMs to rerank in a single pass:

```typescript
const reranked = await llm.generate({
  prompt: `Given this query: "${query}"
  
  Rank these documents from most to least relevant:
  ${documents.map((d, i) => `[${i}]: ${d.text}`).join('\n')}
  
  Return only the indices in order of relevance.`
});
```

---

### 5. Vector Storage: **BASIC**

**Current:**
- SQLite with JSON-serialized embeddings
- No vector indexing (linear scan)
- No approximate nearest neighbor support

**Modern Vector Storage:**

| Option | Type | Features |
|--------|------|----------|
| pgvector + HNSW | Extension | Good for PostgreSQL apps, HNSW index |
| Qdrant | Database | Rich filtering, hybrid search |
| Weaviate | Database | Built-in vectorizer, GraphQL |
| Pinecone | Serverless | Managed, auto-scaling |
| Milvus | Database | GPU acceleration, production-ready |

---

## Recommended Modern Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Modern RAG Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INDEXING:                                                      │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │   Document   │───▶│ Late Chunking OR │───▶│  BGE-M3 or   │  │
│  │              │    │ Contextual Chunk │    │  Voyage-3    │  │
│  └──────────────┘    └──────────────────┘    └──────────────┘  │
│                              │                      │           │
│                              ▼                      ▼           │
│                    ┌──────────────────┐    ┌──────────────┐     │
│                    │ Context Metadata │    │ Dense+Sparse │     │
│                    │ (speaker, topic) │    │   Vectors    │     │
│                    └──────────────────┘    └──────────────┘     │
│                                                   │             │
│                                                   ▼             │
│                                         ┌──────────────────┐    │
│                                         │  Vector Store    │    │
│                                         │ (Qdrant/pgvector)│    │
│                                         └──────────────────┘    │
│                                                                 │
│  RETRIEVAL:                                                     │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────────┐ │
│  │  Query   │───▶│ Query Expand  │───▶│  Hybrid Search       │ │
│  │          │    │ (HyDE option) │    │  (Dense + Sparse)    │ │
│  └──────────┘    └───────────────┘    └──────────────────────┘ │
│                                                │                │
│                                                ▼                │
│                                       ┌──────────────────┐     │
│                                       │   Cross-Encoder  │     │
│                                       │    Reranker      │     │
│                                       │ (bge-reranker-v2)│     │
│                                       └──────────────────┘     │
│                                                │                │
│                                                ▼                │
│                                       ┌──────────────────┐     │
│                                       │  Top-K Results   │     │
│                                       └──────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Priority Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)
1. **Upgrade embedding model** to `text-embedding-3-large` or `voyage-3`
2. **Add similarity threshold** (0.3-0.5) to filter low-quality matches
3. **Implement proper BM25** for hybrid search

### Phase 2: Core Improvements (1 week)
1. **Implement Contextual Retrieval** (Anthropic's approach)
   - Use LLM to generate context for each chunk
   - Prepend context before embedding
2. **Add real cross-encoder reranking**
   - Use Cohere Rerank API or local bge-reranker
3. **Implement HyDE** for query expansion

### Phase 3: Advanced Features (2-3 weeks)
1. **Late Chunking** with long-context models (jina-embeddings-v3)
2. **Multi-vector retrieval** (ColBERT-style)
3. **BGE-M3 hybrid** (dense + sparse + ColBERT in one model)
4. **Vector database upgrade** to Qdrant or pgvector with HNSW

### Phase 4: Production Hardening
1. **Matryoshka embeddings** for dimension flexibility
2. **Caching layer** for embeddings and search results
3. **Observability** for retrieval quality monitoring
4. **A/B testing framework** for strategy comparison

---

## Key Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| Recall@K | % of relevant docs in top K | > 0.85 |
| MRR | Mean Reciprocal Rank | > 0.7 |
| Latency P50 | Median search time | < 100ms |
| Latency P99 | 99th percentile search time | < 500ms |
| Embedding cost | Cost per 1M tokens | Monitor |

---

## References

1. [Anthropic Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) - Sep 2024
2. [Late Chunking - Jina AI](https://jina.ai/news/late-chunking-in-long-context-embedding-models/) - 2024
3. [ColBERT Paper](https://arxiv.org/abs/2004.12832)
4. [SPLADE](https://arxiv.org/abs/2107.05720)
5. [HyDE Paper](https://arxiv.org/abs/2212.10496)
6. [BGE-M3](https://huggingface.co/BAAI/bge-m3)
7. [Voyage AI Embeddings](https://docs.voyageai.com/docs/embeddings)
8. [OpenAI Embedding Models](https://platform.openai.com/docs/guides/embeddings)

