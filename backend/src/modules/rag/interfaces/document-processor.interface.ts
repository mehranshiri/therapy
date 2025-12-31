/**
 * Chain of Responsibility Pattern: Document processing pipeline
 */

export interface ProcessedChunk {
  text: string;
  metadata: Record<string, any>;
  index: number;
}

export interface IDocumentProcessor {
  /**
   * Set the next processor in the chain
   */
  setNext(processor: IDocumentProcessor): IDocumentProcessor;

  /**
   * Process the document
   */
  process(text: string, metadata?: Record<string, any>): Promise<ProcessedChunk[]>;
}

