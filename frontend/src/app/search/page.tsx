'use client';

import { useState } from 'react';
import { searchApi } from '@/lib/api';
import { format } from 'date-fns';

interface SearchResult {
  session: {
    id: string;
    therapistId: string;
    clientId: string;
    startTime: string;
    summary?: string;
    createdAt: string;
  };
  similarity: number;
  matchedSnippets?: Array<{
    text: string;
    highlighted: string;
    score: number;
    chunkIndex?: number | null;
  }>;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSearched(true);
      
      const response = await searchApi.searchSessions(query);
      setResults(response.data.data.results);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Semantic Session Search</h2>

      <div className="card mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Query
            </label>
            <input
              type="text"
              className="input-field"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., anxiety treatment, depression, coping strategies..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Uses vector embeddings (RAG) to find semantically similar sessions
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Searching...' : 'Search Sessions'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {searched && !loading && (
        <div className="mb-4 text-sm text-gray-600">
          Found {results.length} matching session{results.length !== 1 ? 's' : ''}
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-600">Searching sessions...</div>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.session.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <a
                    href={`/sessions/${result.session.id}`}
                    className="text-lg font-semibold text-primary hover:underline"
                  >
                    Session {result.session.id.slice(0, 8)}...
                  </a>
                  <div className="text-xs text-gray-500 mt-1">
                    {format(new Date(result.session.createdAt), 'PPP')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-700">
                    Similarity
                  </div>
                  <div className="text-lg font-bold text-secondary">
                    {(result.similarity * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div>
                  <span className="text-gray-500">Therapist:</span>{' '}
                  <span className="font-medium">{result.session.therapistId}</span>
                </div>
                <div>
                  <span className="text-gray-500">Client:</span>{' '}
                  <span className="font-medium">{result.session.clientId}</span>
                </div>
              </div>

              {result.matchedSnippets && result.matchedSnippets.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Matched Snippets:
                  </div>
                  <div className="space-y-2">
                    {result.matchedSnippets.map((snippet, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-700 bg-yellow-50 p-2 rounded border border-yellow-100"
                      >
                        <div
                          className="leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: snippet.highlighted || snippet.text }}
                        />
                        <div className="mt-1 flex items-center text-xs text-gray-500">
                          {snippet.chunkIndex !== null && snippet.chunkIndex !== undefined && (
                            <span className="mr-3">Chunk #{snippet.chunkIndex + 1}</span>
                          )}
                          <span>Score: {(snippet.score * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <a
                href={`/sessions/${result.session.id}`}
                className="mt-4 inline-block text-primary hover:underline text-sm"
              >
                View full session →
              </a>
            </div>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No matching sessions found. Try a different search query or make sure 
          sessions have been embedded first.
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">How It Works</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Sessions are chunked and embedded with OpenAI `text-embedding-3-large` (contextualized chunks)</li>
          <li>Search is hybrid: semantic vectors + keyword/BM25, then reranked</li>
          <li>Results include highlighted snippets from matching chunks (with scores)</li>
          <li>Reranker uses OpenAI (or Cohere if provided); similarity threshold filters noise</li>
        </ul>
      </div>
    </div>
  );
}

