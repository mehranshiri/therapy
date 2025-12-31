import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Session } from '../sessions/entities/session.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Session]), AiModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}

