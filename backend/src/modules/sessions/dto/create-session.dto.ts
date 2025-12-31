import { IsNotEmpty, IsString, IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Unique identifier for the therapist',
    example: 'therapist-001',
  })
  @IsNotEmpty()
  @IsString()
  therapistId: string;

  @ApiProperty({
    description: 'Unique identifier for the client',
    example: 'client-001',
  })
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @ApiProperty({
    description: 'Session start time in ISO 8601 format',
    example: '2024-01-15T10:00:00Z',
  })
  @IsNotEmpty()
  @IsISO8601()
  startTime: string;
}

