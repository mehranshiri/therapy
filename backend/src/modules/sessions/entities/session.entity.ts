import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SessionEntry } from './session-entry.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  therapistId: string;

  @Column()
  clientId: string;

  @Column()
  startTime: string;

  @Column({ nullable: true })
  endTime?: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'simple-json', nullable: true })
  embedding?: number[];

  @Column({ type: 'text', nullable: true })
  transcript?: string;

  @OneToMany(() => SessionEntry, (entry) => entry.session, { cascade: true })
  entries: SessionEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

