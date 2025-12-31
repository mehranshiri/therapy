import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { TranscriptionService } from './transcription.service';

@ApiTags('transcription')
@Controller('sessions')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post(':sessionId/transcribe')
  @ApiOperation({
    summary: 'Transcribe audio file and create session entries',
  })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
          description: 'Audio file (MP3, WAV, M4A, etc.)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription completed successfully',
  })
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeSession(
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No audio file provided');
    }

    const result = await this.transcriptionService.transcribe(
      sessionId,
      file.buffer,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post(':sessionId/embed')
  @ApiOperation({
    summary: 'Generate and store embeddings for session summary',
  })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Embedding generated and stored successfully',
  })
  async embedSession(@Param('sessionId') sessionId: string) {
    await this.transcriptionService.generateAndStoreEmbedding(sessionId);

    return {
      success: true,
      data: {
        message: 'Embedding generated and stored successfully',
      },
    };
  }
}

