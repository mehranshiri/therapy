import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { RAGModule } from '../rag/rag.module';

@Module({
  imports: [ConfigModule, RAGModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

