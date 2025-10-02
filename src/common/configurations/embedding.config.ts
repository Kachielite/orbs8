import { Global, Module } from '@nestjs/common';
import { EmbeddingConfig } from '../embedding/embedding.config';

@Global()
@Module({
  providers: [EmbeddingConfig],
  exports: [EmbeddingConfig],
})
export class EmbeddingModule {}
