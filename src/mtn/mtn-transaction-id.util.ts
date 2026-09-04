import { randomInt } from 'crypto';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

/** 8-char id: character, digit, character, digit, … (e.g. a1b2c3d4). */
export function generateMtnRequestTransactionId(): string {
  let id = '';

  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) {
      id += LETTERS[randomInt(0, LETTERS.length)];
    } else {
      id += DIGITS[randomInt(0, DIGITS.length)];
    }
  }

  return id;
}

export function generateUniqueMtnRequestTransactionIds(count: number): string[] {
  const ids = new Set<string>();

  while (ids.size < count) {
    ids.add(generateMtnRequestTransactionId());
  }

  return [...ids];
}
