import { Module } from '@nestjs/common';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { SessionsModule } from '../sessions/sessions.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [SessionsModule, AiModule],
  controllers: [TranscriptionController],
  providers: [TranscriptionService],
})
export class TranscriptionModule {}

