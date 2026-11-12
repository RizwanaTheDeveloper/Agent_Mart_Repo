import { Module } from '@nestjs/common';
import { SummariesController } from './summaries.controller';
import { SummariesService } from './summaries.service';

@Module({
  controllers: [SummariesController],
  providers: [SummariesService],
})
export class SummariesModule {}
