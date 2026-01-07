import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SessionEntry } from '../sessions/entities/session-entry.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI | null;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  /**
   * Generate summary from session entries
   * Uses OpenAI if available; otherwise falls back to a simple template.
   */
  async generateSummary(entries: SessionEntry[]): Promise<string> {
    if (!entries || entries.length === 0) {
      return 'No entries available to summarize.';
    }

    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY not set; using fallback summary.');
      return this.fallbackSummary(entries);
    }
    
    try {
      const recent = entries.slice(-12); // keep prompt small
      const transcript = recent
        .map((e) => `${e.speaker}: ${e.content}`)
        .join('\n');

      const prompt = `
Summarize this therapy session concisely.
Include: main concerns, interventions, and progress/next steps.
Keep under 140 words.

Transcript:
${transcript}
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a concise clinical note summarizer.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 220,
      });

      const summary = response.choices?.[0]?.message?.content?.trim();
      return summary || this.fallbackSummary(entries);
    } catch (err) {
      this.logger.warn(`Summary generation failed, using fallback: ${err}`);
      return this.fallbackSummary(entries);
    }
  }


  /**
   * Transcribe audio to text with speaker diarization
   * Currently mock; can be swapped to Whisper when needed.
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
    // Placeholder mock; replace with Whisper call when available.
    return this.mockTranscribeAudio(audioBuffer);
  }

  // ===== Helpers =====

  private fallbackSummary(entries: SessionEntry[]): string {
    const recent = entries.slice(-3);
    const recentText = recent
      .map((e) => `${e.speaker}: ${e.content}`)
      .join(' ');
    return `Session Summary (Fallback):
    
Exchanges: ${entries.length}
Recent: ${recentText.substring(0, 240)}...`;
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

