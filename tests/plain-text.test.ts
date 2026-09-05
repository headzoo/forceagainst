import assert from 'node:assert/strict';
import test from 'node:test';
import { stripHtmlToText } from '../lib/plain-text';

test('strips tags and decodes entities into plain text', () => {
  assert.equal(
    stripHtmlToText('<a href="http://www.senate.gov/photo.htm">U.S. Senate&nbsp;Historical Office</a>'),
    'U.S. Senate Historical Office',
  );
  assert.equal(stripHtmlToText('  plain credit  '), 'plain credit');
  assert.equal(stripHtmlToText('<p></p>'), null);
  assert.equal(stripHtmlToText(null), null);
});
