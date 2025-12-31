import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Session } from './session.entity';

export type Speaker = 'therapist' | 'client';

@Entity('session_entries')
export class SessionEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => Session, (session) => session.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session: Session;

  @Column({ type: 'text' })
  speaker: Speaker;

  @Column({ type: 'text' })
  content: string;

  @Column()
  timestamp: string;

  @CreateDateColumn()
  createdAt: Date;
}

