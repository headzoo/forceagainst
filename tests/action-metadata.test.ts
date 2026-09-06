import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractActionOpenGraph } from '@/lib/action-metadata';

describe('extractActionOpenGraph', () => {
  it('extracts social-card fields regardless of attribute order', () => {
    const html = `
      <meta content="Demand &amp; Defend" property="og:title">
      <meta property="og:description" content="A concrete &quot;action&quot; people can take.">
      <meta content="/social/card.jpg" property="og:image">
      <meta property="og:image:alt" content="People holding signs">
      <meta property="og:site_name" content="Example Action">
      <meta property="og:url" content="/take-action">
      <meta property="og:type" content="article">
    `;

    assert.deepEqual(extractActionOpenGraph(html, new URL('https://example.org/source')), {
      title: 'Demand & Defend',
      description: 'A concrete "action" people can take.',
      image: 'https://example.org/social/card.jpg',
      imageAlt: 'People holding signs',
      siteName: 'Example Action',
      url: 'https://example.org/take-action',
      type: 'article',
    });
  });

  it('rejects non-public preview URLs while preserving other tags', () => {
    const html = `
      <meta property="og:title" content="Public title">
      <meta property="og:image" content="http://127.0.0.1/private.jpg">
    `;

    assert.deepEqual(extractActionOpenGraph(html, new URL('https://example.org/action')), {
      title: 'Public title',
    });
  });

  it('returns null when the page has no OpenGraph tags', () => {
    assert.equal(extractActionOpenGraph(
      '<meta name="description" content="Regular metadata">',
      new URL('https://example.org/action'),
    ), null);
  });
});
