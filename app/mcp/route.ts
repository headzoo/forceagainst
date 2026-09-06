import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import {
  getDirectoryData,
  getPublishedAction,
  getPublishedIssue,
  getPublishedOrganization,
  searchPublishedContent,
  type PublicAction,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

type PublicActionWithContext = PublicAction & {
  organization?: string;
  organizationSlug?: string;
  issue?: string;
  issueSlug?: string;
};

const maxDescriptionLength = 20_000;

function serializeAction(action: PublicActionWithContext, includeDescription = false) {
  const description = includeDescription
    ? action.description.slice(0, maxDescriptionLength)
    : undefined;

  return {
    id: action.id,
    slug: action.slug,
    title: action.title,
    type: action.type,
    detail: action.detail,
    ...(description !== undefined ? {
      description,
      descriptionTruncated: action.description.length > maxDescriptionLength,
    } : {}),
    effort: action.effort,
    href: action.href,
    urgent: action.urgent,
    verified: action.verified,
    organization: action.organization
      ? { id: action.orgId, name: action.organization, slug: action.organizationSlug }
      : { id: action.orgId },
    issue: action.issue
      ? { id: action.issueId, name: action.issue, slug: action.issueSlug }
      : { id: action.issueId },
  };
}

function toolResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

async function runTool(name: string, operation: () => Promise<ReturnType<typeof toolResult>>) {
  try {
    return await operation();
  } catch (error) {
    console.error(`MCP tool ${name} failed`, error);
    return toolError('The directory is temporarily unavailable. Please try again.');
  }
}

const handler = createMcpHandler((server) => {
  server.registerTool(
    'list_directory',
    {
      title: 'List action directory',
      description: 'List public issues and published actions, optionally restricted to one issue.',
      inputSchema: z.object({
        issueSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional()
          .describe('Optional issue slug to filter by.'),
        limit: z.number().int().min(1).max(100).default(50)
          .describe('Maximum number of actions to return.'),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ issueSlug, limit }) => runTool('list_directory', async () => {
      const { issues, actions } = await getDirectoryData();
      const selectedIssue = issueSlug
        ? issues.find((issue) => issue.slug === issueSlug)
        : undefined;

      if (issueSlug && !selectedIssue) {
        return toolError(`No public issue was found with slug "${issueSlug}".`);
      }

      const visibleIssues = selectedIssue ? [selectedIssue] : issues;
      const issueById = new Map(issues.map((issue) => [issue.id, issue]));
      const matchingActions = selectedIssue
        ? actions.filter((action) => action.issueId === selectedIssue.id)
        : actions;
      const visibleActions = matchingActions.slice(0, limit);

      return toolResult({
        issues: visibleIssues.map((issue) => ({
          id: issue.id,
          slug: issue.slug,
          name: issue.name,
          detail: issue.detail,
          description: issue.description,
          status: issue.status,
          actionCount: actions.filter((action) => action.issueId === issue.id).length,
        })),
        actions: visibleActions.map((action) => {
          const issue = issueById.get(action.issueId);
          return serializeAction({
            ...action,
            issue: issue?.name,
            issueSlug: issue?.slug,
          });
        }),
        totalActions: matchingActions.length,
        truncated: visibleActions.length < matchingActions.length,
      });
    }),
  );

  server.registerTool(
    'search_directory',
    {
      title: 'Search action directory',
      description: 'Search published actions and organizations using a short natural-language query.',
      inputSchema: z.object({
        query: z.string().trim().min(2).max(80).describe('Search query, from 2 to 80 characters.'),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ query }) => runTool('search_directory', async () => {
      const normalizedQuery = query.replace(/\s+/g, ' ');
      return toolResult(await searchPublishedContent(normalizedQuery));
    }),
  );

  server.registerTool(
    'get_action',
    {
      title: 'Get action',
      description: 'Get the public details for one published action by numeric ID.',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Published action ID.'),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ id }) => runTool('get_action', async () => {
      const action = await getPublishedAction(id);
      if (!action) return toolError(`No published action was found with ID ${id}.`);
      return toolResult(serializeAction(action, true));
    }),
  );

  server.registerTool(
    'get_issue',
    {
      title: 'Get issue',
      description: 'Get one public issue and its published actions by slug.',
      inputSchema: z.object({
        slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .describe('Issue slug.'),
        limit: z.number().int().min(1).max(100).default(50)
          .describe('Maximum number of actions to return.'),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ slug, limit }) => runTool('get_issue', async () => {
      const issue = await getPublishedIssue(slug);
      if (!issue) return toolError(`No public issue was found with slug "${slug}".`);

      const visibleActions = issue.actions.slice(0, limit);

      return toolResult({
        id: issue.id,
        slug: issue.slug,
        name: issue.name,
        detail: issue.detail,
        description: issue.description,
        status: issue.status,
        actions: visibleActions.map((action) => serializeAction({
          ...action,
          issue: issue.name,
          issueSlug: issue.slug,
        })),
        totalActions: issue.actions.length,
        truncated: visibleActions.length < issue.actions.length,
      });
    }),
  );

  server.registerTool(
    'get_organization',
    {
      title: 'Get organization',
      description: 'Get one public organization and its published actions by numeric ID.',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Organization ID.'),
        limit: z.number().int().min(1).max(100).default(50)
          .describe('Maximum number of actions to return.'),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ id, limit }) => runTool('get_organization', async () => {
      const organization = await getPublishedOrganization(id);
      if (!organization) return toolError(`No public organization was found with ID ${id}.`);

      const visibleActions = organization.actions.slice(0, limit);

      return toolResult({
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        website: organization.website,
        description: organization.description,
        sidebar: organization.sidebar,
        actions: visibleActions.map((action) => serializeAction({
          ...action,
          organization: organization.name,
          organizationSlug: organization.slug,
        })),
        totalActions: organization.actions.length,
        truncated: visibleActions.length < organization.actions.length,
      });
    }),
  );
}, {
  serverInfo: {
    name: 'force-against-something',
    version: '1.0.0',
  },
  instructions: 'Use these read-only tools to discover published civic actions, issues, and organizations from Force Against Something.',
  maxSubscriptions: 0,
});

export { handler as GET, handler as POST };
