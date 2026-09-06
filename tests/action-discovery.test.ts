import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDiverseCandidates, stripDiscoverySourceLinks, type DiscoveredAction } from '../lib/action-discovery';

type Candidate = Pick<DiscoveredAction, 'perspective' | 'organization'> & { id: string };

function candidate(id: string, organization: string, perspective: string): Candidate {
  return {
    id,
    perspective,
    organization: { name: organization, website: '', description: '' },
  };
}

test('selectDiverseCandidates favors new organizations and perspectives', () => {
  const selected = selectDiverseCandidates([
    candidate('one', 'Organization A', 'expand access'),
    candidate('two', 'Organization A', 'restrict access'),
    candidate('three', 'Organization B', 'expand access'),
    candidate('four', 'Organization C', 'preserve current law'),
  ], 3);

  assert.deepEqual(selected.map(({ id }) => id), ['one', 'four', 'three']);
});

test('selectDiverseCandidates preserves source order when diversity scores tie', () => {
  const selected = selectDiverseCandidates([
    candidate('one', 'Organization A', 'expand access'),
    candidate('two', 'Organization B', 'restrict access'),
    candidate('three', 'Organization C', 'preserve current law'),
  ], 2);

  assert.deepEqual(selected.map(({ id }) => id), ['one', 'two']);
});

test('stripDiscoverySourceLinks removes generated Markdown citations', () => {
  assert.equal(
    stripDiscoverySourceLinks('The organization is asking for a veto. ([example.org](https://example.org/action?utm_source=openai))'),
    'The organization is asking for a veto.',
  );
  assert.equal(
    stripDiscoverySourceLinks('Review the filing at [example.org](https://example.org/case).'),
    'Review the filing at.',
  );
});
