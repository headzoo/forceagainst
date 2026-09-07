import { createHmac, randomBytes } from 'node:crypto';

export const PASSKEY_RECOVERY_CODE_COUNT = 5;
export const PASSKEY_RECOVERY_CODE_LENGTH = 25;
export const PASSKEY_RECOVERY_TTL_MS = 10 * 60 * 1_000;

const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const RECOVERY_CONTEXT_PREFIX = 'passkey-recovery';

function recoverySecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required for passkey recovery.');
  return secret;
}

function hmac(value: string) {
  return createHmac('sha256', recoverySecret()).update(value).digest('hex');
}

export function normalizePasskeyRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isPasskeyRecoveryCode(value: string) {
  const normalized = normalizePasskeyRecoveryCode(value);
  return normalized.length === PASSKEY_RECOVERY_CODE_LENGTH
    && [...normalized].every((character) => RECOVERY_ALPHABET.includes(character));
}

export function hashPasskeyRecoveryCode(value: string) {
  return hmac(`code:${normalizePasskeyRecoveryCode(value)}`);
}

export function generatePasskeyRecoveryCodes() {
  return Array.from({ length: PASSKEY_RECOVERY_CODE_COUNT }, () => {
    const bytes = randomBytes(PASSKEY_RECOVERY_CODE_LENGTH);
    const code = [...bytes]
      .map((byte) => RECOVERY_ALPHABET[byte & 31])
      .join('');
    return code.match(/.{1,5}/g)!.join('-');
  });
}

export function createPasskeyRecoveryContext(userId: string) {
  const encodedUserId = Buffer.from(userId, 'utf8').toString('base64url');
  return `${encodedUserId}.${randomBytes(32).toString('base64url')}`;
}

export function parsePasskeyRecoveryContext(context: string | null | undefined) {
  if (!context || context.length > 512) return null;
  const separator = context.indexOf('.');
  if (separator < 1 || separator === context.length - 1) return null;
  const encodedUserId = context.slice(0, separator);
  const randomToken = context.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(encodedUserId) || !/^[A-Za-z0-9_-]{43}$/.test(randomToken)) return null;

  try {
    const userId = Buffer.from(encodedUserId, 'base64url').toString('utf8');
    if (
      !userId
      || userId.length > 255
      || Buffer.from(userId, 'utf8').toString('base64url') !== encodedUserId
    ) return null;
    return {
      userId,
      identifier: `${RECOVERY_CONTEXT_PREFIX}:${userId}:${hmac(`context:${context}`)}`,
    };
  } catch {
    return null;
  }
}

export function passkeyRecoveryIdentifierPrefix(userId: string) {
  return `${RECOVERY_CONTEXT_PREFIX}:${userId}:`;
}

export function passkeyRecoveryVerificationValue(userId: string) {
  return JSON.stringify({ type: RECOVERY_CONTEXT_PREFIX, userId });
}

export function readPasskeyRecoveryVerificationValue(value: string) {
  try {
    const parsed = JSON.parse(value) as { type?: unknown; userId?: unknown };
    return parsed.type === RECOVERY_CONTEXT_PREFIX && typeof parsed.userId === 'string'
      ? parsed.userId
      : null;
  } catch {
    return null;
  }
}

export function passkeyRecoveryRateLimitKey(kind: 'email' | 'ip', value: string) {
  return `passkey-recovery:${kind}:${hmac(`${kind}:${value.trim().toLowerCase()}`)}`;
}
