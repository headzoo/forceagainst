const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntity(entity: string) {
  if (entity[0] === '#') {
    const code = entity[1] === 'x' || entity[1] === 'X'
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    if (!Number.isFinite(code) || code < 0) return '';
    try {
      return String.fromCodePoint(code);
    } catch {
      return '';
    }
  }

  return NAMED_ENTITIES[entity.toLowerCase()] ?? '';
}

export function stripHtmlToText(value: string | null | undefined) {
  if (!value) return null;

  const text = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => decodeEntity(entity))
    .replace(/\s+/g, ' ')
    .trim();

  return text || null;
}
