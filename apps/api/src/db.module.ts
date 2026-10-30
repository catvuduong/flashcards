import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service.js';

// One shared connection pool for every feature module.
@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
