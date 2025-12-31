import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('sessions')
  @ApiOperation({
    summary: 'Semantic search across sessions using RAG',
    description:
      'Performs vector similarity search on session embeddings to find relevant sessions',
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query',
    example: 'anxiety treatment progress',
  })
  @ApiQuery({
    name: 'therapistId',
    required: false,
    description: 'Filter by therapist ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of results',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results with similarity scores',
  })
  async searchSessions(
    @Query('q') query: string,
    @Query('therapistId') therapistId?: string,
    @Query('limit') limit?: number,
  ) {
    const results = await this.searchService.searchSessions(
      query,
      therapistId,
      limit ? parseInt(limit.toString()) : 10,
    );

    return {
      success: true,
      data: {
        query,
        results,
        count: results.length,
      },
    };
  }
}

