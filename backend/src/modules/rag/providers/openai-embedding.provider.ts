import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';

/**
 * OpenAI Embedding Provider (Strategy Implementation)
 * Uses OpenAI's text-embedding-ada-002 or text-embedding-3-small
 */
@Injectable()
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private readonly model = 'text-embedding-ada-002';
  private readonly dimensions = 1536;
  private readonly mockMode: boolean;

  constructor(private configService: ConfigService) {
    this.mockMode = this.configService.get('MOCK_AI') === 'true';
  }

  async embedText(text: string): Promise<number[]> {
    if (this.mockMode) {
      return this.generateMockEmbedding();
    }

    // TODO: Implement real OpenAI API call
    // const openai = new OpenAI({ apiKey: this.configService.get('OPENAI_API_KEY') });
    // const response = await openai.embeddings.create({
    //   model: this.model,
    //   input: text,
    // });
    // return response.data[0].embedding;

    return this.generateMockEmbedding();
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.mockMode) {
      return texts.map(() => this.generateMockEmbedding());
    }

    // TODO: Implement batch embedding
    // const openai = new OpenAI({ apiKey: this.configService.get('OPENAI_API_KEY') });
    // const response = await openai.embeddings.create({
    //   model: this.model,
    //   input: texts,
    // });
    // return response.data.map(d => d.embedding);

    return texts.map(() => this.generateMockEmbedding());
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getProviderName(): string {
    return 'OpenAI';
  }

  getCostPer1KTokens(): number {
    return 0.0001; // $0.0001 per 1K tokens for ada-002
  }

  /**
   * Generate a normalized random embedding for mock mode
   */
  private generateMockEmbedding(): number[] {
    const vector: number[] = [];
    let sumSquares = 0;

    for (let i = 0; i < this.dimensions; i++) {
      const value = (Math.random() - 0.5) * 2;
      vector.push(value);
      sumSquares += value * value;
    }

    // Normalize to unit vector
    const norm = Math.sqrt(sumSquares);
    return vector.map((v) => v / norm);
  }
}

