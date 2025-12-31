import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';
import { AiService } from '../ai/ai.service';
import { RAGService } from '../rag/rag.service';

@Injectable()
export class TranscriptionService {
  constructor(
    private sessionsService: SessionsService,
    private aiService: AiService,
    private ragService: RAGService,
  ) {}

  /**
   * Transcribe audio and create session entries
   * Automatically generates embeddings after transcription
   */
  async transcribe(sessionId: string, audioBuffer: Buffer) {
    // Verify session exists
    const session = await this.sessionsService.findOne(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Transcribe audio using AI service
    const transcription = await this.aiService.transcribeAudio(audioBuffer);

    // Create session entries from segments
    for (const segment of transcription.segments) {
      await this.sessionsService.addEntry(sessionId, {
        speaker: segment.speaker,
        content: segment.text,
        timestamp: new Date(
          Date.now() + segment.startTime * 1000,
        ).toISOString(),
      });
    }

    // Store full transcript in session
    await this.sessionsService.updateSession(sessionId, {
      transcript: transcription.text,
    });

    // Auto-generate embeddings after transcription
    // Note: addEntry() already triggers embedding generation,
    // but we ensure it's up-to-date with the full transcript
    try {
      await this.generateAndStoreEmbedding(sessionId);
    } catch (error) {
      console.error('Failed to auto-generate embedding after transcription:', error);
      // Don't fail the transcription if embedding generation fails
    }

    return {
      transcription: transcription.text,
      segmentsCreated: transcription.segments.length,
      segments: transcription.segments,
    };
  }

  /**
   * Generate embedding for session and store it
   * Uses RAGService.indexDocument to chunk and index the full transcript
   */
  async generateAndStoreEmbedding(sessionId: string): Promise<void> {
    const session = await this.sessionsService.findOne(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Generate summary if not exists (still needed for session entity)
    let summaryText = session.summary;
    if (!summaryText) {
      summaryText = await this.sessionsService.generateSummary(sessionId);
    }

    // Generate embedding from summary (keep for backward compatibility)
    const embedding = await this.aiService.generateEmbedding(summaryText);

    // Store embedding in session (for backward compatibility)
    await this.sessionsService.updateSession(sessionId, {
      embedding,
    });

    // Index the full transcript using RAG for chunk-level search
    // Use transcript if available, otherwise use summary
    const textToIndex = session.transcript || summaryText;
    
    if (textToIndex && textToIndex.trim()) {
      try {
        await this.ragService.indexDocument(textToIndex, {
          sessionId: session.id,
          therapistId: session.therapistId,
          clientId: session.clientId,
          timestamp: session.startTime,
        });
      } catch (error) {
        console.error('Failed to index document in RAG system:', error);
        // Don't fail the whole operation if RAG indexing fails
      }
    }
  }
}

