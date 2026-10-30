export const MAX_BULK_CARDS = 200;
export const MAX_FIELD_LENGTH = 2000;

export interface ParsedCard {
  front: string;
  back: string;
}

export interface ParseResult {
  cards: ParsedCard[];
  errors: string[];
}

// One "front | back" pair per line. Blank lines are ignored. Only the first "|" separates the sides,
// so the back of a card may itself contain a pipe.
export function parseBulkCards(text: string): ParseResult {
  const cards: ParsedCard[] = [];
  const errors: string[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;

    const separator = line.indexOf('|');
    if (separator === -1) {
      errors.push(`line ${index + 1}: expected "front | back"`);
      return;
    }

    const front = line.slice(0, separator).trim();
    const back = line.slice(separator + 1).trim();
    if (!front || !back) {
      errors.push(`line ${index + 1}: both sides need text`);
    } else if (front.length > MAX_FIELD_LENGTH || back.length > MAX_FIELD_LENGTH) {
      errors.push(`line ${index + 1}: each side must be ${MAX_FIELD_LENGTH} characters or fewer`);
    } else {
      cards.push({ front, back });
    }
  });

  if (cards.length + errors.length > MAX_BULK_CARDS) {
    errors.unshift(`at most ${MAX_BULK_CARDS} cards can be added at once`);
  }

  return { cards, errors };
}
