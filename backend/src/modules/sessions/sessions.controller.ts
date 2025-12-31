import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { AddEntryDto } from './dto/add-entry.dto';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new therapy session' })
  @ApiResponse({
    status: 201,
    description: 'Session created successfully',
  })
  async createSession(@Body() createSessionDto: CreateSessionDto) {
    const session = await this.sessionsService.create(createSessionDto);
    return {
      success: true,
      data: { sessionId: session.id },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all sessions, optionally filtered by therapist' })
  @ApiQuery({ name: 'therapistId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Sessions retrieved successfully',
  })
  async getAllSessions(@Query('therapistId') therapistId?: string) {
    const sessions = await this.sessionsService.findAll(therapistId);
    return {
      success: true,
      data: sessions,
    };
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get session details with all entries' })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Session details retrieved',
  })
  async getSession(@Param('sessionId') sessionId: string) {
    const session = await this.sessionsService.findOne(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return {
      success: true,
      data: session,
    };
  }

  @Post(':sessionId/entries')
  @ApiOperation({ summary: 'Add an entry to a session' })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiResponse({
    status: 201,
    description: 'Entry added successfully',
  })
  async addEntry(
    @Param('sessionId') sessionId: string,
    @Body() addEntryDto: AddEntryDto,
  ) {
    const entry = await this.sessionsService.addEntry(sessionId, addEntryDto);
    return {
      success: true,
      data: { entryId: entry.id },
    };
  }

  @Get(':sessionId/summary')
  @ApiOperation({ summary: 'Get AI-generated summary of session' })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Summary generated successfully',
  })
  async getSummary(@Param('sessionId') sessionId: string) {
    const summary = await this.sessionsService.generateSummary(sessionId);
    return {
      success: true,
      data: { summary },
    };
  }
}

