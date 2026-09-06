export const SUPPORTERS_PREFIX = 'Supporters of ';

function comparableText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function organizationKey(value: string) {
  return comparableText(value.replace(/^supporters of\s+/i, ''));
}

export function supportersName(value: string) {
  const cleanName = value.trim().replace(/\s+/g, ' ').slice(0, 160).replace(/^supporters of\s+/i, '');
  return `${SUPPORTERS_PREFIX}${cleanName || 'an unnamed organization'}`;
}
