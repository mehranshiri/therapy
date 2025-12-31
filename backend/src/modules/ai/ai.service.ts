import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionEntry } from '../sessions/entities/session-entry.entity';

@Injectable()
export class AiService {
  private readonly mockMode: boolean;
  private readonly embeddingDimensions: number;

  constructor(private configService: ConfigService) {
    this.mockMode = this.configService.get('MOCK_AI') === 'true';
    this.embeddingDimensions = parseInt(
      this.configService.get('EMBEDDING_DIMENSIONS') || '1536',
    );
  }

  /**
   * Generate summary from session entries
   * In mock mode, generates a template-based summary
   * In real mode, would call OpenAI GPT API
   */
  async generateSummary(entries: SessionEntry[]): Promise<string> {
    if (this.mockMode) {
      return this.mockGenerateSummary(entries);
    }
    
    // TODO: Implement real OpenAI API call when key is available
    // const openai = new OpenAI({ apiKey: this.configService.get('OPENAI_API_KEY') });
    // const response = await openai.chat.completions.create({...});
    
    return this.mockGenerateSummary(entries);
  }

  /**
   * Generate embeddings for text
   * In mock mode, generates deterministic vectors based on text content
   * In real mode, would call OpenAI Embeddings API
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (this.mockMode) {
      return this.mockGenerateEmbedding(text);
    }
    
    // TODO: Implement real OpenAI API call
    // const openai = new OpenAI({ apiKey: this.configService.get('OPENAI_API_KEY') });
    // const response = await openai.embeddings.create({...});
    
    return this.mockGenerateEmbedding(text);
  }

  /**
   * Transcribe audio to text with speaker diarization
   * In mock mode, returns simulated transcript
   * In real mode, would call OpenAI Whisper API
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<{
    text: string;
    segments: Array<{
      speaker: 'therapist' | 'client';
      text: string;
      startTime: number;
      endTime: number;
    }>;
  }> {
    if (this.mockMode) {
      return this.mockTranscribeAudio(audioBuffer);
    }
    
    // TODO: Implement real OpenAI Whisper API call
    // const openai = new OpenAI({ apiKey: this.configService.get('OPENAI_API_KEY') });
    // const response = await openai.audio.transcriptions.create({...});
    
    return this.mockTranscribeAudio(audioBuffer);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ===== MOCK IMPLEMENTATIONS =====

  private mockGenerateSummary(entries: SessionEntry[]): string {
    if (entries.length === 0) {
      return 'No entries available to summarize.';
    }

    const therapistEntries = entries.filter((e) => e.speaker === 'therapist');
    const clientEntries = entries.filter((e) => e.speaker === 'client');

    // Use last 3 entries for summary
    const recentEntries = entries.slice(-3);
    const recentText = recentEntries
      .map((e) => `${e.speaker}: ${e.content}`)
      .join(' ');

    return `Session Summary (Mock Generated):
    
Duration: ${entries.length} exchanges
Therapist statements: ${therapistEntries.length}
Client statements: ${clientEntries.length}

Key Discussion Points:
${recentText.substring(0, 200)}...

Assessment: This was a productive session with active engagement from both parties. 
The client demonstrated good insight and willingness to explore difficult topics.

Recommended Follow-up: Continue current therapeutic approach and monitor progress.

Note: This is a mock summary. With OpenAI API key, this would provide detailed, 
contextual analysis using GPT-4.`;
  }

  /**
   * Generate deterministic mock embedding based on text content
   * This ensures similar text gets similar embeddings
   */
  private mockGenerateEmbedding(text: string): number[] {
    // Normalize text for consistent embeddings
    const normalizedText = text.toLowerCase().trim();
    
    // Extract keywords (words > 3 chars, remove common words)
    const stopWords = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'been', 'were', 'was']);
    const words = normalizedText
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    
    // Create a deterministic seed from text
    const textHash = this.simpleHash(normalizedText);
    
    // Generate base vector using seeded random
    const vector: number[] = [];
    let rng = this.seededRandom(textHash);
    
    for (let i = 0; i < this.embeddingDimensions; i++) {
      // Base random value from hash
      const baseValue = (rng() - 0.5) * 2;
      
      // Add influence from keywords to create semantic similarity
      let keywordInfluence = 0;
      words.forEach((word, idx) => {
        // Each keyword contributes to certain dimensions
        const wordHash = this.simpleHash(word);
        const influenceIdx = wordHash % this.embeddingDimensions;
        if (Math.abs(influenceIdx - i) < 50) { // Influence nearby dimensions
          keywordInfluence += 0.1 * Math.cos((wordHash + i) * 0.01);
        }
      });
      
      vector.push(baseValue + keywordInfluence);
    }
    
    // Normalize to unit vector
    const sumSquares = vector.reduce((sum, v) => sum + v * v, 0);
    const norm = Math.sqrt(sumSquares);
    
    return vector.map((v) => v / norm);
  }
  
  /**
   * Simple hash function for deterministic seed generation
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Seeded pseudo-random number generator
   * Returns a function that generates deterministic "random" numbers
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      // Linear congruential generator
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  private mockTranscribeAudio(audioBuffer: Buffer): {
    text: string;
    segments: Array<{
      speaker: 'therapist' | 'client';
      text: string;
      startTime: number;
      endTime: number;
    }>;
  } {
    // Simulate processing time based on buffer size
    const estimatedDuration = audioBuffer.length / 16000; // Assuming 16kHz audio

    // Mock transcript segments
    const segments = [
      {
        speaker: 'therapist' as const,
        text: 'Hello, how have you been feeling since our last session?',
        startTime: 0,
        endTime: 3.5,
      },
      {
        speaker: 'client' as const,
        text: "I've been doing better. I tried the breathing exercises you suggested.",
        startTime: 4.0,
        endTime: 8.2,
      },
      {
        speaker: 'therapist' as const,
        text: "That's great to hear. Can you tell me more about your experience with them?",
        startTime: 8.5,
        endTime: 12.3,
      },
      {
        speaker: 'client' as const,
        text: 'They really helped when I felt anxious at work. I used them three times this week.',
        startTime: 13.0,
        endTime: 18.5,
      },
      {
        speaker: 'therapist' as const,
        text: "Excellent progress. Let's discuss how we can build on this momentum.",
        startTime: 19.0,
        endTime: 23.0,
      },
    ];

    const fullText = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');

    return {
      text: fullText,
      segments,
    };
  }
}

