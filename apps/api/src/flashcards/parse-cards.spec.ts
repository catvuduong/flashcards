import { MAX_BULK_CARDS, parseBulkCards } from './parse-cards.js';

describe('parseBulkCards', () => {
  it('splits each line on the first pipe and trims both sides', () => {
    expect(parseBulkCards('  hola  |  hello \n gracias|thank you')).toEqual({
      cards: [
        { front: 'hola', back: 'hello' },
        { front: 'gracias', back: 'thank you' },
      ],
      errors: [],
    });
  });

  it('keeps later pipes inside the back of the card', () => {
    expect(parseBulkCards('a | b | c').cards).toEqual([{ front: 'a', back: 'b | c' }]);
  });

  it('ignores blank lines and accepts Windows line endings', () => {
    expect(parseBulkCards('a | 1\r\n\r\n   \r\nb | 2\r\n').cards).toHaveLength(2);
  });

  it('reports lines without a separator with their line number', () => {
    expect(parseBulkCards('a | 1\njust text\nb | 2').errors).toEqual([
      'line 2: expected "front | back"',
    ]);
  });

  it('reports lines where one side is empty', () => {
    expect(parseBulkCards('| back only\nfront only |').errors).toEqual([
      'line 1: both sides need text',
      'line 2: both sides need text',
    ]);
  });

  it('rejects overly long sides', () => {
    const long = 'x'.repeat(2001);
    expect(parseBulkCards(`${long} | ok`).errors).toEqual([
      'line 1: each side must be 2000 characters or fewer',
    ]);
  });

  it('refuses batches above the card limit', () => {
    const text = Array.from({ length: MAX_BULK_CARDS + 1 }, (_, i) => `q${i} | a${i}`).join('\n');
    const { cards, errors } = parseBulkCards(text);
    expect(cards).toHaveLength(MAX_BULK_CARDS + 1);
    expect(errors).toEqual([`at most ${MAX_BULK_CARDS} cards can be added at once`]);
  });
});
