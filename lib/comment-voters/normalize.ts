import { createHash } from 'node:crypto';

const invisibleCharacters = /[\u200B-\u200D\u2060\uFEFF]/g;

export function normalizeCommentBody(body: string) {
  return body
    .normalize('NFKC')
    .replace(invisibleCharacters, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

export function hashNormalizedCommentBody(normalizedBody: string) {
  return createHash('sha256').update(normalizedBody).digest('hex');
}
