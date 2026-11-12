import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { DocumentsService } from './documents.service';

/** Metadata only - no download / plaintext endpoint exists by design. */
@ApiTags('documents')
@ApiBearerAuth()
@RequirePermission('documents', 'read')
@Controller('platform/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.documents.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.get(id);
  }
}
