import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { FlashcardsService, parseGrade } from './flashcards.service.js';

@Controller()
export class FlashcardsController {
  constructor(private readonly flashcards: FlashcardsService) {}

  @Get('decks')
  listDecks() {
    return this.flashcards.listDecks();
  }

  @Post('decks')
  createDeck(@Body() body: { name?: unknown; description?: unknown }) {
    return this.flashcards.createDeck(body ?? {});
  }

  @Get('decks/:id')
  getDeck(@Param('id', ParseIntPipe) id: number) {
    return this.flashcards.getDeck(id);
  }

  @Patch('decks/:id')
  updateDeck(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: unknown; description?: unknown }) {
    return this.flashcards.updateDeck(id, body ?? {});
  }

  @Delete('decks/:id')
  @HttpCode(204)
  deleteDeck(@Param('id', ParseIntPipe) id: number) {
    return this.flashcards.deleteDeck(id);
  }

  @Get('decks/:id/study')
  study(@Param('id', ParseIntPipe) id: number) {
    return this.flashcards.studyQueue(id);
  }

  @Post('decks/:id/cards/bulk')
  bulkAddCards(@Param('id', ParseIntPipe) id: number, @Body() body: { text?: unknown }) {
    return this.flashcards.bulkAddCards(id, body?.text);
  }

  @Post('cards')
  createCard(@Body() body: { deck_id?: unknown; front?: unknown; back?: unknown }) {
    return this.flashcards.createCard(body ?? {});
  }

  @Patch('cards/:id')
  updateCard(@Param('id', ParseIntPipe) id: number, @Body() body: { front?: unknown; back?: unknown }) {
    return this.flashcards.updateCard(id, body ?? {});
  }

  @Delete('cards/:id')
  @HttpCode(204)
  deleteCard(@Param('id', ParseIntPipe) id: number) {
    return this.flashcards.deleteCard(id);
  }

  @Post('cards/:id/review')
  review(@Param('id', ParseIntPipe) id: number, @Body() body: { grade?: unknown }) {
    return this.flashcards.review(id, parseGrade(body?.grade));
  }

  @Get('stats')
  stats() {
    return this.flashcards.stats();
  }
}
