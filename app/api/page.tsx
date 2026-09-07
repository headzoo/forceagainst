import { cn, s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { createSiteMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = createSiteMetadata({
  title: 'API | Force Against',
  description: 'Use the Force Against JSON API and read-only MCP server.',
  path: '/api',
});

const jsonEndpoints = [
  {
    path: '/action/:issueSlug/:actionSlug.json',
    description: 'Returns one published action, including its issue and organization.',
  },
  {
    path: '/issue/:issueSlug.json',
    description: 'Returns an issue and its 20 most recently created published actions.',
  },
  {
    path: '/org/:organizationSlug.json',
    description: 'Returns an organization and its 20 most recently created published actions.',
  },
];

const mcpTools = [
  ['list_directory', 'List issues and published actions. Accepts an optional issueSlug and a limit from 1–100.'],
  ['search_directory', 'Search published actions and organizations with a query from 2–80 characters.'],
  ['get_action', 'Get one published action by numeric id.'],
  ['get_issue', 'Get one issue by slug, with an optional action limit from 1–100.'],
  ['get_organization', 'Get one organization by numeric id, with an optional action limit from 1–100.'],
] as const;

export default function ApiPage() {
  return (
    <main>
      <SiteHeader />

      <section className={s.apiHero}>
        <div className={s.apiHeroHeading}>
          <Link className={s.apiBackLink} href="/">← Back to all actions</Link>
          <p className={s.eyebrow}><span /> PUBLIC ACCESS</p>
          <h1 className={s.apiTitle}>Build with<br /><em>action.</em></h1>
          <p className={s.apiHeroCopy}>Read published directory data as JSON or connect an AI client to the read-only MCP server. No account or API key is required.</p>
        </div>
        <aside className={s.apiHeroAside}>
          <p className={s.step}>TWO WAYS IN</p>
          <strong>JSON</strong>
          <span>For scripts, feeds, and direct requests.</span>
          <strong>MCP</strong>
          <span>For assistants and agent tools.</span>
        </aside>
      </section>

      <section className={s.apiDocs}>
        <article className={s.apiSection} id="json">
          <div className={s.apiSectionHeading}>
            <p className={s.eyebrow}><span /> JSON API</p>
            <h2>Add <code>.json</code></h2>
          </div>
          <div className={s.apiSectionContent}>
            <p>Add <code>.json</code> to any canonical action, issue, or organization page URL. Responses use <code>application/json</code> and only expose published directory records.</p>

            <div className={s.apiEndpointList}>
              {jsonEndpoints.map((endpoint) => (
                <div className={s.apiEndpoint} key={endpoint.path}>
                  <span>GET</span>
                  <div><code>{endpoint.path}</code><p>{endpoint.description}</p></div>
                </div>
              ))}
            </div>

            <h3>Example</h3>
            <pre><code>{`curl https://forceagainst.com/issue/criminal-justice.json`}</code></pre>
            <p>For local development, use <code>http://localhost:3000</code> as the base URL. Missing or unpublished records return a JSON response with a <code>404</code> status.</p>

          </div>
        </article>

        <article className={cn(s.apiSection, s.apiMcpSection)} id="mcp">
          <div className={s.apiSectionHeading}>
            <p className={s.eyebrow}><span /> MODEL CONTEXT PROTOCOL</p>
            <h2>Connect<br />with MCP</h2>
          </div>
          <div className={s.apiSectionContent}>
            <p>The MCP server gives compatible AI clients structured, read-only tools for finding civic actions. It uses Streamable HTTP and does not require authentication.</p>

            <div className={s.apiMcpAddress}>
              <small>REMOTE MCP URL</small>
              <code>https://forceagainst.com/mcp</code>
              <small>LOCAL MCP URL</small>
              <code>http://localhost:3000/mcp</code>
            </div>

            <h3>Client configuration</h3>
            <p>In a client that supports remote MCP servers, add a server named <code>force-against</code> with the remote URL above. Clients that accept JSON configuration commonly use this shape:</p>
            <pre><code>{`{
  "mcpServers": {
    "force-against": {
      "url": "https://forceagainst.com/mcp"
    }
  }
}`}</code></pre>
            <p className={s.apiNote}>MCP configuration formats vary by client. If yours provides an “Add remote server” form, enter the server name and URL directly instead.</p>

            <h3>Available tools</h3>
            <div className={s.apiToolList}>
              {mcpTools.map(([name, description]) => (
                <div key={name}><code>{name}</code><p>{description}</p></div>
              ))}
            </div>
          </div>
        </article>

        <article className={s.apiSection} id="source">
          <div className={cn(s.apiSectionHeading, s.apiSectionHeadingSource)}>
            <p className={s.eyebrowLight}><span /> OPEN SOURCE</p>
            <h2>Source<br />Code</h2>
          </div>
          <div className={s.apiSectionContent}>
            <p>The source code for Force Against is available on GitHub. Browse the implementation, report an issue, or run your own local copy.</p>
            <a className={s.apiSourceLink} href="https://github.com/headzoo/forceagainstsomething" target="_blank" rel="noreferrer">
              <span>VIEW ON GITHUB</span>
              <b aria-hidden="true">↗</b>
            </a>

            <h3>Run it locally</h3>
            <ol className={s.apiSetupSteps}>
              <li>
                <strong>Clone the repository</strong>
                <pre><code>{`git clone https://github.com/headzoo/forceagainstsomething.git
cd forceagainstsomething`}</code></pre>
              </li>
              <li>
                <strong>Install dependencies</strong>
                <p>Use Node.js 22.13 or newer.</p>
                <pre><code>npm install</code></pre>
              </li>
              <li>
                <strong>Configure the environment</strong>
                <p>Copy the example file to <code>.env.local</code>, then add your PostgreSQL connection and the other required settings documented in that file.</p>
                <pre><code>cp .env.example .env.local</code></pre>
              </li>
              <li>
                <strong>Prepare and start the site</strong>
                <pre><code>{`npm run db:migrate
npm run dev`}</code></pre>
                <p>Open <a href="http://localhost:3000">http://localhost:3000</a> once the development server is ready.</p>
              </li>
            </ol>
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
