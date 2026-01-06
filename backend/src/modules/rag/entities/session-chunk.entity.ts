import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('session_chunks')
export class SessionChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  sessionId: string;

  @Index()
  @Column({ nullable: true })
  therapistId?: string;

  @Column({ nullable: true })
  clientId?: string;

  @Column({ nullable: true })
  timestamp?: string;

  @Column({ type: 'int', nullable: true })
  chunkIndex?: number;

  @Column({ type: 'int', nullable: true })
  totalChunks?: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'simple-json' })
  embedding: number[];

  @Column({ type: 'text', nullable: true })
  contextSummary?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

