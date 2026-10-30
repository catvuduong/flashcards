import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbModule } from './db.module.js';
import { FlashcardsModule } from './flashcards/flashcards.module.js';

@Module({
  imports: [DbModule, FlashcardsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
