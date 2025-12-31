import { IsNotEmpty, IsString, IsIn, IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddEntryDto {
  @ApiProperty({
    description: 'Who is speaking',
    enum: ['therapist', 'client'],
    example: 'therapist',
  })
  @IsNotEmpty()
  @IsIn(['therapist', 'client'])
  speaker: 'therapist' | 'client';

  @ApiProperty({
    description: 'Content of what was said',
    example: 'How have you been feeling this week?',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Timestamp of when this was said',
    example: '2024-01-15T10:05:30Z',
  })
  @IsNotEmpty()
  @IsISO8601()
  timestamp: string;
}

