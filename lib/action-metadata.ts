import type { OpenGraphMetadata } from '@/db/schema';

const MAX_HTML_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

export type ActionMetadata = {
  href: string;
  suggestedTitle: string;
  suggestedDetail: string;
  effort: string;
  openGraph: OpenGraphMetadata | null;
};

export type WebsiteMetadata = {
  href: string;
  openGraph: OpenGraphMetadata | null;
};

function decodeEntities(value: string) {
  const entities: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }

    return entities[entity.toLowerCase()] ?? match;
  });
}

function cleanText(value: string, maxLength: number) {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, maxLength);
}

function firstTag(html: string, tag: 'h1' | 'h2' | 'title') {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? cleanText(match[1], 180) : '';
}

function tagAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of tag.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }

  return attributes;
}

function metaValues(html: string) {
  const values = new Map<string, string>();
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const attributes = tagAttributes(tag);
    const key = (attributes.get('property') || attributes.get('name'))?.toLowerCase();
    const content = attributes.get('content');
    if (key && content !== undefined && !values.has(key)) values.set(key, content);
  }

  return values;
}

function metaContent(values: Map<string, string>, names: string[], maxLength = 320) {
  for (const name of names) {
    const value = values.get(name);
    if (value !== undefined) return cleanText(value, maxLength);
  }
  return '';
}

function publicAbsoluteUrl(value: string, baseUrl: URL) {
  if (!value) return '';
  try {
    return parsePublicHttpUrl(new URL(decodeEntities(value), baseUrl).toString()).toString();
  } catch {
    return '';
  }
}

export function extractOpenGraph(html: string, baseUrl: URL): OpenGraphMetadata | null {
  const values = metaValues(html);
  const openGraph: OpenGraphMetadata = {};
  const title = metaContent(values, ['og:title'], 300);
  const description = metaContent(values, ['og:description'], 1_000);
  const image = publicAbsoluteUrl(
    metaContent(values, ['og:image:secure_url', 'og:image:url', 'og:image'], 2_048),
    baseUrl,
  );
  const imageAlt = metaContent(values, ['og:image:alt'], 300);
  const siteName = metaContent(values, ['og:site_name'], 160);
  const url = publicAbsoluteUrl(metaContent(values, ['og:url'], 2_048), baseUrl);
  const type = metaContent(values, ['og:type'], 80);

  if (title) openGraph.title = title;
  if (description) openGraph.description = description;
  if (image) openGraph.image = image;
  if (imageAlt) openGraph.imageAlt = imageAlt;
  if (siteName) openGraph.siteName = siteName;
  if (url) openGraph.url = url;
  if (type) openGraph.type = type;

  return Object.keys(openGraph).length > 0 ? openGraph : null;
}

export const extractActionOpenGraph = extractOpenGraph;

function isPrivateIpv4(hostname: string) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;
  const parts = hostname.split('.').map(Number);
  if (parts.some((part) => part > 255)) return true;

  return parts[0] === 0
    || parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] >= 224;
}

export function parsePublicHttpUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a complete http:// or https:// link.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only public http:// or https:// links are supported.');
  }

  if ((url.protocol === 'http:' && url.port && url.port !== '80')
    || (url.protocol === 'https:' && url.port && url.port !== '443')) {
    throw new Error('Links using custom ports are not supported.');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const blockedName = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal');
  const blockedIpv6 = hostname.includes(':')
    && (hostname === '::' || hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe8') || hostname.startsWith('fe9') || hostname.startsWith('fea') || hostname.startsWith('feb'));

  if (blockedName || isPrivateIpv4(hostname) || blockedIpv6) {
    throw new Error('That link does not point to a public website.');
  }

  url.hash = '';
  return url;
}

async function readLimitedHtml(response: Response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error('That page is too large to analyze.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function inferEffort(html: string) {
  const text = cleanText(
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' '),
    MAX_HTML_BYTES,
  ).toLowerCase();
  const inputCount = (html.match(/<input\b/gi) ?? []).length + (html.match(/<textarea\b/gi) ?? []).length;

  if (/lawsuit|litigation|court case|legal challenge|case docket/.test(text)) return 'Follow case';
  if (/volunteer|join (?:our|the) (?:team|campaign)|organizer training|canvass/.test(text)) return 'Volunteer';
  if (/donate|contribution|make a gift/.test(text)) return 'Donate';
  if (/share (?:this|with|the)|spread the word/.test(text)) return 'Share';
  if (/call (?:your|congress|senator|representative|lawmakers)/.test(text)) return '5 min';
  if (/sign (?:the|this|our) petition|add your name|take the pledge/.test(text)) return inputCount > 8 ? '3 min' : '2 min';
  if (/email (?:your|congress)|write (?:to )?(?:your|congress)|contact (?:your|a) representative/.test(text)) return '5 min';
  return inputCount > 8 ? '5 min' : '2 min';
}

export function slugifyTitle(title: string) {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

  return slug || 'action';
}

async function fetchPublicHtml(input: string) {
  let url = parsePublicHttpUrl(input);
  let response: Response | undefined;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    response = await fetch(url, {
      headers: { 'User-Agent': 'ForceAgainstSomethingBot/1.0 (+https://forceagainstsomething.com)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === MAX_REDIRECTS) throw new Error('That page redirects too many times.');
      url = parsePublicHttpUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }

  if (!response?.ok) throw new Error(`The page returned HTTP ${response?.status ?? 'an error'}.`);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error('That link is not an HTML page.');
  }

  const html = await readLimitedHtml(response);
  return { href: url.toString(), html, url };
}

export async function analyzeWebsiteHref(input: string): Promise<WebsiteMetadata> {
  const { href, html, url } = await fetchPublicHtml(input);
  return { href, openGraph: extractOpenGraph(html, url) };
}

export async function analyzeActionHref(input: string): Promise<ActionMetadata> {
  const { href, html, url } = await fetchPublicHtml(input);
  const metadata = metaValues(html);
  const suggestedTitle = firstTag(html, 'h1')
    || firstTag(html, 'h2')
    || metaContent(metadata, ['og:title', 'twitter:title'])
    || firstTag(html, 'title');

  if (!suggestedTitle) throw new Error('We could not find a page heading. You can try another link.');

  return {
    href,
    suggestedTitle,
    suggestedDetail: metaContent(metadata, ['description', 'og:description', 'twitter:description']),
    effort: inferEffort(html),
    openGraph: extractOpenGraph(html, url),
  };
}
