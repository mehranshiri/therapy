import { Injectable } from '@nestjs/common';
import { ProcessedChunk, IDocumentProcessor } from '../../interfaces/document-processor.interface';

/**
 * Semantic Chunking Strategy
 * Splits text intelligently based on sentence boundaries and semantic coherence
 */
@Injectable()
export class SemanticChunker implements IDocumentProcessor {
  private nextProcessor: IDocumentProcessor | null = null;
  private readonly maxChunkSize = 512; // tokens
  private readonly overlap = 50; // tokens overlap between chunks

  setNext(processor: IDocumentProcessor): IDocumentProcessor {
    this.nextProcessor = processor;
    return processor;
  }

  async process(
    text: string,
    metadata: Record<string, any> = {},
  ): Promise<ProcessedChunk[]> {
    const chunks = this.chunkText(text);

    const processedChunks: ProcessedChunk[] = chunks.map((chunk, index) => ({
      text: chunk,
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        chunkSize: chunk.length,
      },
      index,
    }));

    // Pass to next processor if exists
    if (this.nextProcessor) {
      return this.nextProcessor.process(text, metadata);
    }

    return processedChunks;
  }

  private chunkText(text: string): string[] {
    // Split by sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      // Rough token estimation (1 token ≈ 4 chars)
      const estimatedTokens = (currentChunk + sentence).length / 4;

      if (estimatedTokens > this.maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        // Keep overlap
        const words = currentChunk.split(' ');
        currentChunk = words.slice(-this.overlap).join(' ') + ' ' + sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

