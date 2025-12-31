# Visual Architecture Diagram

## System Architecture - Therapy Session Management with RAG

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT APPLICATIONS                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Web Browser │  │  Mobile App  │  │   Admin UI   │  │  API Clients │   │
│  └───────┬──────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
└──────────┼─────────────────┼─────────────────┼─────────────────┼───────────┘
           │                 │                 │                 │
           └─────────────────┴─────────────────┴─────────────────┘
                                     │ HTTP/REST
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY (NestJS)                                │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  Port: 3001                                                         │     │
│  │  - CORS Enabled                                                     │     │
│  │  - Input Validation (class-validator)                              │     │
│  │  - Swagger Documentation (/api)                                    │     │
│  │  - Global Error Handling                                           │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└──────────┬──────────────────┬──────────────────┬───────────────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────┐ ┌─────────────────┐ ┌────────────────────┐
│  SESSIONS        │ │  TRANSCRIPTION  │ │    SEARCH          │
│  MODULE          │ │  MODULE         │ │    MODULE          │
├──────────────────┤ ├─────────────────┤ ├────────────────────┤
│ • Create Session │ │ • Upload Audio  │ │ • Semantic Search  │
│ • Add Entry      │ │ • STT (Whisper) │ │ • Filter Results   │
│ • Get Session    │ │ • Diarization   │ │ • Rank by Score    │
│ • Get Summary    │ │ • Generate Emb. │ │ • Return Snippets  │
└────────┬─────────┘ └────────┬────────┘ └────────┬───────────┘
         │                    │                   │
         └────────────────────┴───────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │          AI SERVICE (Strategy Layer)         │
        ├─────────────────────────────────────────────┤
        │  ┌────────────────┐  ┌─────────────────┐   │
        │  │  Summarization │  │  Embeddings     │   │
        │  │  (GPT-4)       │  │  (Ada-002)      │   │
        │  │  Mock: ✓       │  │  1536-dim       │   │
        │  └────────────────┘  └─────────────────┘   │
        │                                             │
        │  ┌────────────────┐  ┌─────────────────┐   │
        │  │  Transcription │  │  Cosine         │   │
        │  │  (Whisper)     │  │  Similarity     │   │
        │  │  Mock: ✓       │  │  Calculation    │   │
        │  └────────────────┘  └─────────────────┘   │
        └─────────────┬───────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────────────┐
        │       ADVANCED RAG MODULE (NEW!)             │
        ├─────────────────────────────────────────────┤
        │                                              │
        │  [Document Processing Pipeline]              │
        │   Chunker → Embedder → Vector Store          │
        │                                              │
        │  [Search Strategies]                         │
        │   • Semantic Search (Vector)                 │
        │   • Hybrid Search (Vector + Keyword)         │
        │   • Metadata Filtered                        │
        │                                              │
        │  [Reranking]                                 │
        │   • Cross-Encoder (Relevance)                │
        │   • MMR (Diversity)                          │
        │                                              │
        └──────────────┬───────────────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────────────────┐
        │          DATABASE LAYER (TypeORM)            │
        ├─────────────────────────────────────────────┤
        │                                              │
        │  ┌──────────────────────────────────────┐   │
        │  │       SQLite (Development)            │   │
        │  │  File: ./data/therapy.db              │   │
        │  │                                       │   │
        │  │  Tables:                              │   │
        │  │  • sessions                           │   │
        │  │    - id (UUID)                        │   │
        │  │    - therapistId                      │   │
        │  │    - clientId                         │   │
        │  │    - startTime                        │   │
        │  │    - summary (TEXT)                   │   │
        │  │    - embedding (JSON)                 │   │
        │  │    - transcript (TEXT)                │   │
        │  │                                       │   │
        │  │  • session_entries                    │   │
        │  │    - id (UUID)                        │   │
        │  │    - sessionId (FK)                   │   │
        │  │    - speaker (enum)                   │   │
        │  │    - content (TEXT)                   │   │
        │  │    - timestamp                        │   │
        │  │                                       │   │
        │  │  Indexes:                             │   │
        │  │  • therapistId (performance)          │   │
        │  │  • clientId (performance)             │   │
        │  │  • sessionId (foreign key)            │   │
        │  └──────────────────────────────────────┘   │
        │                                              │
        │  Production Migration Path:                  │
        │  → PostgreSQL + pgvector                     │
        └──────────────────────────────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────────────────┐
        │      EXTERNAL SERVICES (Optional)            │
        ├─────────────────────────────────────────────┤
        │  ┌────────────┐  ┌─────────────────────┐   │
        │  │  OpenAI    │  │  Redis (Cache)      │   │
        │  │  API       │  │  (Future)           │   │
        │  └────────────┘  └─────────────────────┘   │
        │                                              │
        │  ┌────────────┐  ┌─────────────────────┐   │
        │  │ Pinecone   │  │  Monitoring         │   │
        │  │ (Future)   │  │  (Future)           │   │
        │  └────────────┘  └─────────────────────┘   │
        └──────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Session Creation & Entry Flow
```
[Client] 
   │
   │ POST /sessions
   │ {therapistId, clientId, startTime}
   ▼
[Sessions Controller]
   │
   │ Validate DTO
   ▼
[Sessions Service]
   │
   │ Generate UUID
   │ Set timestamps
   ▼
[Database (TypeORM)]
   │
   │ INSERT INTO sessions
   │ RETURNING id
   ▼
[Response]
   │
   │ {sessionId: "uuid"}
   ▼
[Client receives sessionId]

---

[Client adds entry]
   │
   │ POST /sessions/:id/entries
   │ {speaker: "therapist", content: "...", timestamp: "..."}
   ▼
[Sessions Controller]
   │
   │ Validate speaker enum
   │ Validate timestamp format
   ▼
[Sessions Service]
   │
   │ Check session exists
   │ Create entry object
   ▼
[Database]
   │
   │ INSERT INTO session_entries
   ▼
[Response: {entryId: "uuid"}]
```

### 2. Audio Transcription Pipeline
```
[Client uploads audio]
   │
   │ POST /sessions/:id/transcribe
   │ Content-Type: multipart/form-data
   │ File: audio.mp3 (max 50MB)
   ▼
[Transcription Controller]
   │
   │ Multer file interceptor
   │ Validate file exists
   ▼
[Transcription Service]
   │
   │ Verify session exists
   ▼
[AI Service - Whisper]
   │
   │ Mock Mode: Generate sample dialogue
   │ Real Mode: Call OpenAI Whisper API
   │
   │ Return: {
   │   text: "full transcript",
   │   segments: [
   │     {speaker: "therapist", text: "...", start: 0, end: 3.5},
   │     {speaker: "client", text: "...", start: 4.0, end: 8.2}
   │   ]
   │ }
   ▼
[Transcription Service]
   │
   │ For each segment:
   │   Create SessionEntry
   │   Save to database
   │
   │ Update Session.transcript
   ▼
[Response]
   │
   │ {
   │   transcription: "full text",
   │   segmentsCreated: 5,
   │   segments: [...]
   │ }
   ▼
[Client displays transcript]
```

### 3. RAG Pipeline: Embedding & Storage
```
[Client requests embedding]
   │
   │ POST /sessions/:id/embed
   ▼
[Transcription Controller]
   ▼
[Transcription Service]
   │
   │ Get or generate summary
   ▼
[AI Service]
   │
   │ Mock: Generate 1536-dim random normalized vector
   │ Real: Call OpenAI Ada-002
   │
   │ text-embedding-ada-002
   │ Input: summary text
   │ Output: [0.023, -0.145, ..., 0.089] (1536 floats)
   ▼
[Sessions Service]
   │
   │ UPDATE sessions
   │ SET embedding = '[0.023, -0.145, ...]'
   │ WHERE id = sessionId
   ▼
[Response: {message: "Embedding stored"}]
```

### 4. Semantic Search with RAG
```
[Client searches]
   │
   │ GET /search/sessions?q=anxiety+treatment&therapistId=therapist-001
   ▼
[Search Controller]
   ▼
[Search Service]
   │
   │ 1. Generate query embedding
   ▼
[AI Service]
   │
   │ Embed("anxiety treatment")
   │ → [0.034, -0.211, ..., 0.156]
   ▼
[Search Service]
   │
   │ 2. Fetch sessions from DB
   │    WHERE therapistId = 'therapist-001'
   │    AND embedding IS NOT NULL
   │
   │ 3. For each session:
   │      score = cosineSimilarity(queryEmbed, sessionEmbed)
   │
   │    Cosine Similarity Formula:
   │    similarity = (A·B) / (||A|| × ||B||)
   │
   │ 4. Filter by threshold (0.7)
   │
   │ 5. Sort by similarity DESC
   │
   │ 6. Extract matched snippets
   ▼
[Response]
   │
   │ {
   │   results: [
   │     {
   │       session: {...},
   │       similarity: 0.87,
   │       matchedSnippets: [
   │         "discussed anxiety coping strategies",
   │         "breathing exercises for treatment"
   │       ]
   │     }
   │   ]
   │ }
   ▼
[Client displays ranked results]
```

### 5. Advanced RAG Pipeline (New Architecture)
```
[Document Indexing]
   │
   │ Long Session Transcript (10,000 words)
   ▼
[Semantic Chunker]
   │
   │ Split at sentence boundaries
   │ 512 tokens per chunk
   │ 50 token overlap
   │
   │ Output: 20 chunks
   ▼
[Embedding Provider] (Strategy Pattern)
   │
   │ Batch embed all chunks (1 API call!)
   │
   │ embedBatch([chunk1, chunk2, ..., chunk20])
   │ → [embed1, embed2, ..., embed20]
   ▼
[Vector Store] (Repository Pattern)
   │
   │ Store each chunk with metadata:
   │ {
   │   id: "session-123_chunk_5",
   │   embedding: [1536 floats],
   │   text: "chunk content",
   │   metadata: {
   │     sessionId: "session-123",
   │     therapistId: "therapist-001",
   │     chunkIndex: 5,
   │     totalChunks: 20
   │   }
   │ }
   ▼
[Vector Database]
   │
   │ SQLite/PostgreSQL/Pinecone
   │ Indexed for fast similarity search

---

[Semantic Search]
   │
   │ Query: "anxiety coping mechanisms"
   ▼
[Hybrid Search Strategy]
   │
   │ 1. Semantic Search (Vector)
   │    - Embed query
   │    - Cosine similarity
   │    - Get top 20 chunks
   │
   │ 2. Keyword Search (BM25)
   │    - Text matching
   │    - Get top 20 chunks
   │
   │ 3. Reciprocal Rank Fusion
   │    - Merge both result sets
   │    - Weight: 70% semantic, 30% keyword
   ▼
[Reranker Strategy]
   │
   │ Cross-Encoder:
   │   For each (query, chunk):
   │     compute relevance score
   │
   │ MMR (Maximal Marginal Relevance):
   │   Balance relevance with diversity
   │   Avoid redundant results
   ▼
[Top 10 Results]
   │
   │ Ranked by relevance + diversity
   │ With highlighted snippets
   ▼
[Response to Client]
```

---

## Component Interactions

```
SessionsModule ←→ AiModule        (for summaries)
SessionsModule ←→ DatabaseModule  (for persistence)
TranscriptionModule ←→ AiModule   (for STT)
TranscriptionModule ←→ SessionsModule (create entries)
SearchModule ←→ AiModule          (for embeddings)
SearchModule ←→ DatabaseModule    (for queries)
RAGModule ←→ All Modules          (advanced features)
```

---

## Technology Stack

```
Frontend:
  - Next.js 14 (React Framework)
  - Tailwind CSS (Styling)
  - Axios (API Client)

Backend:
  - NestJS 11 (Node.js Framework)
  - TypeScript 5.7 (Language)
  - TypeORM (ORM)
  - class-validator (Validation)

Database:
  - SQLite (Development)
  - PostgreSQL + pgvector (Production)

AI/ML:
  - OpenAI GPT-4 (Summarization)
  - OpenAI Whisper (Transcription)
  - OpenAI Ada-002 (Embeddings)
  - Mock implementations for all

Design Patterns:
  - Strategy (Swappable AI providers)
  - Repository (Abstract data layer)
  - Factory (Create instances)
  - Decorator (Add functionality)
  - Chain of Responsibility (Pipeline)
```

---

## Deployment Architecture (Production)

```
[Load Balancer]
       │
       ├───────────┬───────────┐
       ▼           ▼           ▼
   [Node 1]   [Node 2]   [Node 3]  (Horizontal Scaling)
       │           │           │
       └───────────┴───────────┘
               │
               ▼
      [PostgreSQL Primary]
               │
        ┌──────┴──────┐
        ▼             ▼
   [Replica 1]   [Replica 2]  (Read replicas)
               │
               ▼
         [Pinecone]  (Vector DB)
               │
               ▼
           [Redis]  (Cache)
               │
               ▼
         [OpenAI API]
```

---

This diagram can be imported into draw.io or visualized as-is for the interview.

