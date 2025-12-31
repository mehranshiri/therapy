import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsModule } from './modules/sessions/sessions.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { SearchModule } from './modules/search/search.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH || './data/therapy.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // Auto-create tables (disable in production)
      logging: process.env.NODE_ENV === 'development',
    }),
    SessionsModule,
    TranscriptionModule,
    SearchModule,
    AiModule,
  ],
})
export class AppModule {}

