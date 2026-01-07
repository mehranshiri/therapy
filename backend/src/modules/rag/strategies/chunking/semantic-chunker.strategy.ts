import { Injectable, Logger } from '@nestjs/common';
import { encoding_for_model } from 'tiktoken';
import { ProcessedChunk, IDocumentProcessor } from '../../interfaces/document-processor.interface';

/**
 * Semantic Chunking Strategy
 * Splits text intelligently based on:
 * - Proper token counting (tiktoken)
 * - Speaker turn boundaries (therapist/client dialogue)
 * - Sentence boundaries with abbreviation handling
 * - Semantic coherence with overlap
 */
@Injectable()
export class SemanticChunker implements IDocumentProcessor {
  private readonly logger = new Logger(SemanticChunker.name);
  private nextProcessor: IDocumentProcessor | null = null;
  private readonly maxChunkSize = 512; // tokens (accurate with tiktoken)
  private readonly overlap = 50; // tokens overlap between chunks
  private readonly model = 'text-embedding-3-large';

  setNext(processor: IDocumentProcessor): IDocumentProcessor {
    this.nextProcessor = processor;
    return processor;
  }

  async process(
    text: string,
    metadata: Record<string, any> = {},
  ): Promise<ProcessedChunk[]> {
    const chunks = await this.chunkText(text);

    const processedChunks: ProcessedChunk[] = chunks.map((chunk, index) => ({
      text: chunk,
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        chunkSize: chunk.length,
        tokenCount: this.countTokens(chunk),
      },
      index,
    }));

    // Pass to next processor if exists
    if (this.nextProcessor) {
      return this.nextProcessor.process(text, metadata);
    }

    return processedChunks;
  }

  /**
   * Chunk text using proper token counting and speaker awareness
   */
  private async chunkText(text: string): Promise<string[]> {
    // Check if text contains speaker turns (therapy session format)
    const hasSpeakerTurns = this.detectSpeakerTurns(text);

    if (hasSpeakerTurns) {
      return this.chunkByDialogue(text);
    } else {
      return this.chunkBySentences(text);
    }
  }

  /**
   * Detect if text contains speaker turns (e.g., "therapist: ..." or "client: ...")
   */
  private detectSpeakerTurns(text: string): boolean {
    const speakerPattern = /^(therapist|client|speaker \d+):/im;
    return speakerPattern.test(text);
  }

  /**
   * Chunk by dialogue turns - preserves therapeutic context
   * Ensures we don't split mid-conversation exchange
   */
  private chunkByDialogue(text: string): string[] {
    const lines = text.split('\n').filter(line => line.trim());
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = this.countTokens(line);

      // Check if adding this line would exceed max chunk size
      if (currentTokens + lineTokens > this.maxChunkSize && currentChunk.length > 0) {
        // Try to end on a complete dialogue exchange
        if (this.isCompleteExchange(currentChunk)) {
          chunks.push(currentChunk.join('\n'));
          
          // Create overlap by keeping last few lines
          const overlapLines = this.getOverlapLines(currentChunk);
          currentChunk = [...overlapLines, line];
          currentTokens = this.countTokens(currentChunk.join('\n'));
        } else {
          // Add current line to complete the exchange
          currentChunk.push(line);
          chunks.push(currentChunk.join('\n'));
          
          currentChunk = [];
          currentTokens = 0;
        }
      } else {
        currentChunk.push(line);
        currentTokens += lineTokens;
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  /**
   * Check if we have a complete dialogue exchange (therapist + client or vice versa)
   */
  private isCompleteExchange(lines: string[]): boolean {
    if (lines.length < 2) return false;

    const lastLine = lines[lines.length - 1];
    const secondLastLine = lines[lines.length - 2];

    const lastSpeaker = this.extractSpeaker(lastLine);
    const secondLastSpeaker = this.extractSpeaker(secondLastLine);

    // Complete exchange if speakers are different
    return lastSpeaker !== secondLastSpeaker && lastSpeaker !== null && secondLastSpeaker !== null;
  }

  /**
   * Extract speaker from line (e.g., "therapist: hello" -> "therapist")
   */
  private extractSpeaker(line: string): string | null {
    const match = line.match(/^(therapist|client|speaker \d+):/i);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Get lines for overlap - keep last few lines that fit within overlap token limit
   */
  private getOverlapLines(lines: string[]): string[] {
    const overlapLines: string[] = [];
    let overlapTokens = 0;

    // Work backwards to get the most recent lines
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineTokens = this.countTokens(lines[i]);
      if (overlapTokens + lineTokens > this.overlap) break;
      
      overlapLines.unshift(lines[i]);
      overlapTokens += lineTokens;
    }

    return overlapLines;
  }

  /**
   * Chunk by sentences - for non-dialogue text
   * Uses improved sentence splitting with abbreviation handling
   */
  private chunkBySentences(text: string): string[] {
    const sentences = this.splitIntoSentences(text);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.countTokens(sentence);

      if (currentTokens + sentenceTokens > this.maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        
        // Create overlap
        const overlapSentences = this.getOverlapSentences(currentChunk);
        currentChunk = [...overlapSentences, sentence];
        currentTokens = this.countTokens(currentChunk.join(' '));
      } else {
        currentChunk.push(sentence);
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  /**
   * Split text into sentences with proper handling of abbreviations
   * Handles: Dr., Mr., Mrs., Ms., Ph.D., etc., e.g., i.e., vs.
   */
  private splitIntoSentences(text: string): string[] {
    // Common abbreviations that should NOT trigger sentence breaks
    const abbreviations = [
      'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr',
      'Ph.D', 'M.D', 'B.A', 'M.A', 'B.S', 'M.S',
      'etc', 'e.g', 'i.e', 'vs', 'approx', 'esp'
    ];

    // Temporarily replace abbreviations with placeholders
    let processed = text;
    const abbrevMap = new Map<string, string>();
    
    abbreviations.forEach((abbr, index) => {
      const placeholder = `__ABBR${index}__`;
      const patterns = [
        new RegExp(`\\b${abbr}\\.`, 'g'),
        new RegExp(`\\b${abbr.toUpperCase()}\\.`, 'g')
      ];
      
      patterns.forEach(pattern => {
        if (pattern.test(processed)) {
          abbrevMap.set(placeholder, abbr + '.');
          processed = processed.replace(pattern, placeholder);
        }
      });
    });

    // Split on sentence boundaries: . ! ? followed by space and capital letter or end of string
    const sentencePattern = /([.!?]+)(\s+|$)/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentencePattern.exec(processed)) !== null) {
      const endIndex = match.index + match[0].length;
      
      // Check if next character is uppercase or we're at the end
      const nextChar = processed[endIndex];
      if (!nextChar || /[A-Z]/.test(nextChar)) {
        let sentence = processed.substring(lastIndex, endIndex).trim();
        
        // Restore abbreviations
        abbrevMap.forEach((original, placeholder) => {
          sentence = sentence.replace(new RegExp(placeholder, 'g'), original);
        });
        
        if (sentence) sentences.push(sentence);
        lastIndex = endIndex;
      }
    }

    // Add remaining text
    if (lastIndex < processed.length) {
      let remaining = processed.substring(lastIndex).trim();
      abbrevMap.forEach((original, placeholder) => {
        remaining = remaining.replace(new RegExp(placeholder, 'g'), original);
      });
      if (remaining) sentences.push(remaining);
    }

    return sentences.length > 0 ? sentences : [text];
  }

  /**
   * Get sentences for overlap
   */
  private getOverlapSentences(sentences: string[]): string[] {
    const overlapSentences: string[] = [];
    let overlapTokens = 0;

    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentenceTokens = this.countTokens(sentences[i]);
      if (overlapTokens + sentenceTokens > this.overlap) break;
      
      overlapSentences.unshift(sentences[i]);
      overlapTokens += sentenceTokens;
    }

    return overlapSentences;
  }

  /**
   * Count tokens using tiktoken (accurate OpenAI token counting)
   */
  private countTokens(text: string): number {
    try {
      const encoder = encoding_for_model(this.model);
      const tokens = encoder.encode(text);
      const count = tokens.length;
      encoder.free(); // Important: free memory
      return count;
    } catch (error) {
      // Fallback to rough estimation if tiktoken fails
      this.logger.warn(`Tiktoken encoding failed, using fallback: ${error.message}`);
      return Math.ceil(text.length / 4);
    }
  }
}

