import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { Session } from './entities/session.entity';
import { SessionEntry } from './entities/session-entry.entity';
import { RAGModule } from '../rag/rag.module';

@Module({
  imports: [TypeOrmModule.forFeature([Session, SessionEntry]), RAGModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}

