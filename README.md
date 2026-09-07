# Force Against Something

Force Against Something is a curated directory that helps people turn concern about an issue into concrete action. It brings verified petitions, lawsuits, and campaigns into one focused place, with context about the organization behind each effort and a direct path to participate.

## What it includes

- Browse actions by issue and filter them by petition, lawsuit, or campaign
- View action details and verified organization profiles
- Create an account and like actions
- Submit an action for review
- Manage organization information
- Review and publish submissions through an admin workflow

## Tech stack

- [Next.js](https://nextjs.org/) and React
- TypeScript and Tailwind CSS
- PostgreSQL with Drizzle ORM and the Neon serverless driver
- Better Auth for email-and-password accounts
- Vercel Analytics

## Local development

This project requires Node.js 22.13 or newer and a PostgreSQL database.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and provide database, authentication, and admin settings:

   ```bash
   cp .env.example .env.local
   ```

3. Apply the database migrations:

   ```bash
   pnpm run db:migrate
   ```

4. Start the development server:

   ```bash
   pnpm run dev
   ```

Open site [http://localhost:3000](http://localhost:3000) in your browser.

## Public JSON API

Append `.json` to a public action, issue, or organization URL to receive the same published record as JSON:

- `/action/:issueSlug/:actionSlug.json`
- `/issue/:issueSlug.json` (includes the 20 most recently created published actions)
- `/org/:organizationSlug.json` (includes the 20 most recently created published actions)

## Automatic action discovery

The action discovery job searches the web once for each issue and adds genuinely new results to the admin review queue. Every automatically imported action belongs to the shared `Supporters of Force` organization; the action copy and destination URL continue to identify the organization responsible for the original action.

Set `OPENAI_API_KEY` in `.env.local`, then run:

```bash
pnpm run actions:discover
pnpm run actions:discover lgbtq
```

Pass an issue slug positionally to search only that issue. Useful local options are `--dry-run`, `--issue=<slug>` (an alternative to the positional slug), and `--max=<count>`. A dry run searches and reports candidates without changing the database.

Production uses the secured `/api/cron/discover-actions` route and the weekly schedule in `vercel.json`. Add `OPENAI_API_KEY` and a random `CRON_SECRET` of at least 16 characters to the Vercel project. `ACTION_DISCOVERY_MODEL` and `ACTION_DISCOVERY_LIMIT` are optional overrides.

## Congressional roster sync

The government directory reads its roster only from the local database. A daily secured Vercel cron refreshes it from Congress.gov, which is authoritative for currently seated members. The published `congress-legislators` feeds add optional contact, social, and district-office details but cannot add members.

Set `CONGRESS_API_KEY` (a Congress.gov/API.data.gov key) and `CRON_SECRET`, then bootstrap or inspect a sync:

```bash
pnpm run government:sync -- --dry-run
pnpm run government:sync
```

The production job calls `/api/cron/sync-congress` daily using the same `CRON_SECRET` bearer authorization as the weekly action-discovery cron. `GOOGLE_CIVIC_API_KEY` is reserved for the separate private address-to-district lookup. `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` powers optional street-address autocomplete on that form; restrict it to Places API (New) and this site’s HTTP referrers.

## Available scripts

- `pnpm run dev` — start the development server
- `pnpm run build` — create a production build
- `pnpm start` — run the production build
- `pnpm run lint` — lint the project
- `pnpm run actions:discover` — search for new actions and add them to the admin review queue
- `pnpm run government:sync` — mirror the current Congress roster into the database
- `pnpm run db:generate` — generate a Drizzle migration from schema changes
- `pnpm run db:migrate` — apply pending database migrations
- `pnpm run auth:generate` — regenerate the Better Auth database schema
