'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { sessionsApi } from '@/lib/api';
import { format } from 'date-fns';

interface SessionEntry {
  id: string;
  speaker: 'therapist' | 'client';
  content: string;
  timestamp: string;
}

interface Session {
  id: string;
  therapistId: string;
  clientId: string;
  startTime: string;
  summary?: string;
  transcript?: string;
  entries: SessionEntry[];
}

export default function SessionDetail() {
  const params = useParams();
  const sessionId = params.id as string;
  
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const response = await sessionsApi.getOne(sessionId);
      setSession(response.data.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch session');
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    try {
      setSummaryLoading(true);
      const response = await sessionsApi.getSummary(sessionId);
      if (session) {
        setSession({ ...session, summary: response.data.data.summary });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12 text-red-600">
        Session not found
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <a href="/" className="text-primary hover:underline">
          ← Back to Sessions
        </a>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="card mb-6">
        <h2 className="text-2xl font-bold mb-4">Session Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Session ID:</span>
            <div className="font-mono text-xs mt-1">{session.id}</div>
          </div>
          <div>
            <span className="text-gray-500">Start Time:</span>
            <div className="mt-1">
              {format(new Date(session.startTime), 'PPpp')}
            </div>
          </div>
          <div>
            <span className="text-gray-500">Therapist ID:</span>
            <div className="font-medium mt-1">{session.therapistId}</div>
          </div>
          <div>
            <span className="text-gray-500">Client ID:</span>
            <div className="font-medium mt-1">{session.clientId}</div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">AI Summary</h3>
          {!session.summary && (
            <button
              onClick={generateSummary}
              disabled={summaryLoading}
              className="btn-primary"
            >
              {summaryLoading ? 'Generating...' : 'Generate Summary'}
            </button>
          )}
        </div>
        {session.summary ? (
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded">
              {session.summary}
            </pre>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">
            No summary available. Click "Generate Summary" to create one.
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">
          Session Transcript ({session.entries?.length || 0} entries)
        </h3>
        {session.entries && session.entries.length > 0 ? (
          <div className="space-y-4">
            {session.entries.map((entry) => (
              <div
                key={entry.id}
                className={`p-4 rounded-lg ${
                  entry.speaker === 'therapist'
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'bg-green-50 border-l-4 border-green-500'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold capitalize">
                    {entry.speaker}
                  </span>
                  <span className="text-xs text-gray-500">
                    {format(new Date(entry.timestamp), 'HH:mm:ss')}
                  </span>
                </div>
                <p className="text-gray-700">{entry.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">
            No entries yet. Transcribe audio or add entries manually.
          </div>
        )}
      </div>
    </div>
  );
}

