import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { SessionEntry } from './entities/session-entry.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { AddEntryDto } from './dto/add-entry.dto';
import { RAGService } from '../rag/rag.service';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    @InjectRepository(SessionEntry)
    private entriesRepository: Repository<SessionEntry>,
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
    
    // Trigger async background indexing (non-blocking)
    this.updateSessionEmbedding(sessionId);
    
    return savedEntry;
  }

  /**
   * Background indexing into RAG system
   * Called automatically after adding entries
   */
  private async updateSessionEmbedding(sessionId: string): Promise<void> {
    try {
      const session = await this.findOne(sessionId);
      
      // Skip if no entries
      if (!session.entries || session.entries.length === 0) {
        return;
      }

      // Pass structured sessionEntries directly to RAG service
      // The chunker will use sessionEntries for speaker-aware chunking
      await this.ragService.indexDocument('', {
        sessionId: session.id,
        therapistId: session.therapistId,
        clientId: session.clientId,
        timestamp: session.startTime,
        sessionEntries: session.entries,
      });
      
      this.logger.debug(`Successfully indexed session ${sessionId} with ${session.entries.length} entries`);
    } catch (error) {
      // Log error with structured context for debugging
      this.logger.error('Background indexing failed', {
        sessionId,
        error: error.message,
        stack: error.stack,
      });
      // Don't throw - this is background processing
    }
  }

  /**
   * Generate session summary
   * For demo/test: Returns simple concatenation of last 3 entries
   */
  async generateSummary(sessionId: string): Promise<string> {
    const session = await this.findOne(sessionId);
    
    // Return cached summary if exists
    if (session.summary) {
      return session.summary;
    }

    const entries = session.entries || [];
    
    // MOCK IMPLEMENTATION: Concatenate last 3 entries (per test requirements)
    // In production, replace with: await this.aiService.generateSummary(entries)
    const lastThreeEntries = entries.slice(-3);
    const summary = lastThreeEntries.length > 0
      ? lastThreeEntries.map(e => `${e.speaker}: ${e.content}`).join('\n')
      : 'No entries yet';
    
    // Cache summary
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

