import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPasskeyRecoveryContext,
  generatePasskeyRecoveryCodes,
  hashPasskeyRecoveryCode,
  isPasskeyRecoveryCode,
  normalizePasskeyRecoveryCode,
  parsePasskeyRecoveryContext,
  passkeyRecoveryVerificationValue,
  readPasskeyRecoveryVerificationValue,
} from './passkey-recovery';

process.env.BETTER_AUTH_SECRET = 'passkey-recovery-test-secret-with-enough-entropy';

test('generates five distinct, formatted recovery codes', () => {
  const codes = generatePasskeyRecoveryCodes();
  assert.equal(codes.length, 5);
  assert.equal(new Set(codes).size, 5);
  for (const code of codes) {
    assert.match(code, /^(?:[2-9A-HJ-NP-Z]{5}-){4}[2-9A-HJ-NP-Z]{5}$/);
    assert.equal(isPasskeyRecoveryCode(code), true);
  }
});

test('normalizes recovery-code presentation before hashing', () => {
  const code = 'ABCDE-FGHJK-MNPQR-STUVW-XYZ23';
  assert.equal(normalizePasskeyRecoveryCode(` ${code.toLowerCase()} `), code.replaceAll('-', ''));
  assert.equal(hashPasskeyRecoveryCode(code), hashPasskeyRecoveryCode(code.toLowerCase().replaceAll('-', ' ')));
  assert.equal(isPasskeyRecoveryCode('AAAAA-AAAAA-AAAAA-AAAAA-AAAA1'), false);
});

test('round-trips an opaque recovery context without exposing the secret', () => {
  const context = createPasskeyRecoveryContext('member_123');
  const parsed = parsePasskeyRecoveryContext(context);
  assert.equal(parsed?.userId, 'member_123');
  assert.match(parsed?.identifier ?? '', /^passkey-recovery:member_123:[a-f0-9]{64}$/);
  assert.equal(parsePasskeyRecoveryContext(`${context}x`), null);
  assert.equal(parsePasskeyRecoveryContext('not-a-context'), null);
});

test('accepts only typed passkey recovery verification values', () => {
  const value = passkeyRecoveryVerificationValue('member_123');
  assert.equal(readPasskeyRecoveryVerificationValue(value), 'member_123');
  assert.equal(readPasskeyRecoveryVerificationValue('{"type":"other","userId":"member_123"}'), null);
  assert.equal(readPasskeyRecoveryVerificationValue('invalid json'), null);
});
