'use client';

import { useState } from 'react';
import { transcriptionApi, sessionsApi } from '@/lib/api';

export default function TranscribePage() {
  const [sessionId, setSessionId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'upload' | 'processing' | 'complete'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleTranscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !sessionId) {
      setError('Please provide both session ID and audio file');
      return;
    }

    try {
      setLoading(true);
      setStep('processing');
      setError('');

      // Verify session exists
      await sessionsApi.getOne(sessionId);

      // Transcribe audio
      const transcribeResponse = await transcriptionApi.transcribe(sessionId, file);
      
      // Generate embedding
      await transcriptionApi.embed(sessionId);

      setResult(transcribeResponse.data.data);
      setStep('complete');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Transcription failed');
      setStep('upload');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Transcribe Audio Session</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div className="card">
          <form onSubmit={handleTranscribe} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session ID
              </label>
              <input
                type="text"
                className="input-field"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Enter existing session ID"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Create a session first from the home page, then use its ID here
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audio File
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="audio-upload"
                />
                <label
                  htmlFor="audio-upload"
                  className="cursor-pointer"
                >
                  {file ? (
                    <div>
                      <div className="text-green-600 font-medium mb-1">
                        ✓ File selected
                      </div>
                      <div className="text-sm text-gray-600">{file.name}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-gray-600 mb-2">
                        Click to upload audio file
                      </div>
                      <div className="text-xs text-gray-400">
                        Supported formats: MP3, WAV, M4A
                      </div>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !file || !sessionId}
              className="btn-primary w-full"
            >
              {loading ? 'Processing...' : 'Transcribe Audio'}
            </button>
          </form>
        </div>
      )}

      {step === 'processing' && (
        <div className="card text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Processing Audio...</h3>
          <p className="text-gray-600 text-sm mb-6">
            This may take a few moments
          </p>
          <div className="max-w-md mx-auto space-y-2 text-left">
            <div className="flex items-center text-sm">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-3"></div>
              <span className="text-gray-700">Uploading audio file</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-4 h-4 rounded-full bg-primary mr-3 animate-pulse"></div>
              <span className="text-gray-700">Transcribing speech-to-text</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-4 h-4 rounded-full bg-gray-300 mr-3"></div>
              <span className="text-gray-400">Identifying speakers</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-4 h-4 rounded-full bg-gray-300 mr-3"></div>
              <span className="text-gray-400">Generating embeddings</span>
            </div>
          </div>
        </div>
      )}

      {step === 'complete' && result && (
        <div className="space-y-6">
          <div className="card">
            <div className="text-center mb-6">
              <div className="inline-block p-3 bg-green-100 rounded-full mb-3">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-700">
                Transcription Complete!
              </h3>
              <p className="text-gray-600 mt-2">
                {result.segmentsCreated} segments created
              </p>
            </div>

            <div className="space-y-4">
              {result.segments?.map((segment: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg ${
                    segment.speaker === 'therapist'
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'bg-green-50 border-l-4 border-green-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold capitalize">
                      {segment.speaker}
                    </span>
                    <span className="text-xs text-gray-500">
                      {segment.startTime.toFixed(1)}s - {segment.endTime.toFixed(1)}s
                    </span>
                  </div>
                  <p className="text-gray-700">{segment.text}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <a
                href={`/sessions/${sessionId}`}
                className="btn-primary flex-1 text-center"
              >
                View Full Session
              </a>
              <button
                onClick={() => {
                  setStep('upload');
                  setResult(null);
                  setFile(null);
                  setSessionId('');
                }}
                className="btn-secondary flex-1"
              >
                Transcribe Another
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">Mock Mode Enabled</h4>
        <p className="text-sm text-blue-700">
          Currently using mock transcription. The system will generate sample dialogue 
          regardless of the audio file uploaded. When an OpenAI API key is configured, 
          it will use Whisper for real transcription with speaker diarization.
        </p>
      </div>
    </div>
  );
}

