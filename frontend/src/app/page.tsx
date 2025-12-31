'use client';

import { useEffect, useState } from 'react';
import { sessionsApi } from '@/lib/api';
import { format } from 'date-fns';

interface Session {
  id: string;
  therapistId: string;
  clientId: string;
  startTime: string;
  summary?: string;
  createdAt: string;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    therapistId: '',
    clientId: '',
    startTime: new Date().toISOString(),
  });

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await sessionsApi.getAll();
      setSessions(response.data.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sessionsApi.create(formData);
      setShowCreateForm(false);
      setFormData({
        therapistId: '',
        clientId: '',
        startTime: new Date().toISOString(),
      });
      fetchSessions();
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Therapy Sessions</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary"
        >
          {showCreateForm ? 'Cancel' : 'Create New Session'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {showCreateForm && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Session</h3>
          <form onSubmit={handleCreateSession} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Therapist ID
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.therapistId}
                onChange={(e) =>
                  setFormData({ ...formData, therapistId: e.target.value })
                }
                placeholder="e.g., therapist-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.clientId}
                onChange={(e) =>
                  setFormData({ ...formData, clientId: e.target.value })
                }
                placeholder="e.g., client-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                className="input-field"
                value={formData.startTime.slice(0, 16)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    startTime: new Date(e.target.value).toISOString(),
                  })
                }
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Create Session
            </button>
          </form>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No sessions found. Create your first session!
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <a
              key={session.id}
              href={`/sessions/${session.id}`}
              className="card cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium text-gray-500">
                  Session ID
                </div>
                <div className="text-xs text-gray-400">
                  {format(new Date(session.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
              <div className="text-xs text-gray-600 mb-3 font-mono">
                {session.id.slice(0, 8)}...
              </div>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-500">Therapist:</span>{' '}
                  <span className="font-medium">{session.therapistId}</span>
                </div>
                <div>
                  <span className="text-gray-500">Client:</span>{' '}
                  <span className="font-medium">{session.clientId}</span>
                </div>
              </div>
              {session.summary && (
                <div className="mt-3 pt-3 border-t text-xs text-gray-600">
                  {session.summary.substring(0, 100)}...
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

