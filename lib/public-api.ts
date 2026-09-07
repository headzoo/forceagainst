import type { PublicAction } from '@/lib/db';

type IssueReference = { id: number; slug: string; name: string };
type OrganizationReference = { id: number; slug: string; name: string };

export function publicActionJson(action: PublicAction, issue: IssueReference, organization: OrganizationReference) {
  return {
    id: action.id,
    slug: action.slug,
    url: `/a/${issue.slug}/${action.slug}`,
    type: action.type,
    title: action.title,
    detail: action.detail,
    description: action.description,
    governmentSubject: action.governmentSubject,
    governmentBackground: action.governmentBackground,
    governmentRequest: action.governmentRequest,
    effort: action.effort,
    href: action.href,
    urgent: action.urgent,
    verified: action.verified,
    issue,
    organization,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
  };
}
