import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStoredGovernmentSignature } from '../lib/government-signature-storage';

const pngDataUrl = 'data:image/png;base64,iVBORw0KGgo=';

test('accepts a flattened typed signature', () => {
  const signature = parseStoredGovernmentSignature({
    version: 1,
    kind: 'typed',
    imageDataUrl: pngDataUrl,
    typedName: 'Ada Lovelace',
    updatedAt: '2026-09-07T12:00:00.000Z',
  });

  assert.deepEqual(signature, {
    version: 1,
    kind: 'typed',
    imageDataUrl: pngDataUrl,
    typedName: 'Ada Lovelace',
    updatedAt: '2026-09-07T12:00:00.000Z',
  });
});

test('accepts a flattened drawn signature without drawing history', () => {
  const signature = parseStoredGovernmentSignature({
    version: 1,
    kind: 'drawn',
    imageDataUrl: pngDataUrl,
    typedName: null,
    updatedAt: '2026-09-07T12:00:00.000Z',
  });

  assert.equal(signature?.kind, 'drawn');
  assert.equal(signature?.typedName, null);
  assert.deepEqual(Object.keys(signature ?? {}).sort(), ['imageDataUrl', 'kind', 'typedName', 'updatedAt', 'version']);
});

test('rejects non-PNG and malformed signature records', () => {
  assert.equal(parseStoredGovernmentSignature({
    version: 1,
    kind: 'typed',
    imageDataUrl: 'data:image/jpeg;base64,aGVsbG8=',
    typedName: 'Ada Lovelace',
    updatedAt: '2026-09-07T12:00:00.000Z',
  }), null);

  assert.equal(parseStoredGovernmentSignature({
    version: 1,
    kind: 'drawn',
    imageDataUrl: pngDataUrl,
    typedName: 'Unexpected name',
    updatedAt: 'not-a-date',
  }), null);
});
