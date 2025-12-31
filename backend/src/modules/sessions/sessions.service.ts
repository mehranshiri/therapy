import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { SessionEntry } from './entities/session-entry.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { AddEntryDto } from './dto/add-entry.dto';
import { AiService } from '../ai/ai.service';
import { RAGService } from '../rag/rag.service';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    @InjectRepository(SessionEntry)
    private entriesRepository: Repository<SessionEntry>,
    private aiService: AiService,
    private ragService: RAGService,
  ) {}

  async create(createSessionDto: CreateSessionDto): Promise<Session> {
    const session = this.sessionsRepository.create(createSessionDto);
    return await this.sessionsRepository.save(session);
  }

  async findAll(therapistId?: string): Promise<Session[]> {
    if (therapistId) {
      return await this.sessionsRepository.find({
        where: { therapistId },
        order: { createdAt: 'DESC' },
      });
    }
    return await this.sessionsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Session> {
    const session = await this.sessionsRepository.findOne({
      where: { id },
      relations: ['entries'],
    });
    
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    
    return session;
  }

  async addEntry(
    sessionId: string,
    addEntryDto: AddEntryDto,
  ): Promise<SessionEntry> {
    const session = await this.findOne(sessionId);
    
    const entry = this.entriesRepository.create({
      ...addEntryDto,
      sessionId: session.id,
    });
    
    const savedEntry = await this.entriesRepository.save(entry);
    
    // Auto-generate embedding after adding entry
    // This runs asynchronously without blocking the response
    this.updateSessionEmbedding(sessionId).catch(err => {
      console.error('Failed to auto-generate embedding:', err);
    });
    
    return savedEntry;
  }

  /**
   * Update session embedding based on current entries
   * Called automatically after adding entries
   */
  private async updateSessionEmbedding(sessionId: string): Promise<void> {
    const session = await this.findOne(sessionId);
    
    // Skip if no entries
    if (!session.entries || session.entries.length === 0) {
      return;
    }
    
    // Generate or update summary
    const summary = await this.aiService.generateSummary(session.entries);
    
    // Generate embedding from summary (keep for backward compatibility)
    const embedding = await this.aiService.generateEmbedding(summary);
    
    // Update session
    await this.sessionsRepository.update(sessionId, {
      summary,
      embedding,
    });

    // Index the content using RAG for chunk-level search
    // Build text from entries or use transcript if available
    const textToIndex = session.transcript || 
      session.entries.map(e => `${e.speaker}: ${e.content}`).join('\n');
    
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

  async generateSummary(sessionId: string): Promise<string> {
    const session = await this.findOne(sessionId);
    
    // If already summarized, return existing
    if (session.summary) {
      // return session.summary;
      // we can cache the summary in Redis for 3 hours
    }

    // Get all entries
    const entries = session.entries || [];
    
    // Generate summary using AI service
    const summary = await this.aiService.generateSummary(entries);
    
    // Save summary to session
    session.summary = summary;
    await this.sessionsRepository.save(session);
    
    return summary;
  }

  async updateSession(
    id: string,
    updates: Partial<Session>,
  ): Promise<Session> {
    await this.sessionsRepository.update(id, updates);
    return await this.findOne(id);
  }
}

