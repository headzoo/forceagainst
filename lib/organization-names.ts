export const AUTO_IMPORTED_ORGANIZATION_NAME = 'Supporters of Force';
export const AUTO_IMPORTED_ORGANIZATION_SLUG = 'supporters-of-force';

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
