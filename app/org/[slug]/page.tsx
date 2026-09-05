import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getPublishedOrganizationBySlug } from '@/lib/db';

export const dynamic = 'force-dynamic';

type OrganizationPageProps = { params: Promise<{ slug: string }> };

async function findOrganization(params: OrganizationPageProps['params']) {
  const { slug } = await params;
  return getPublishedOrganizationBySlug(slug);
}

export async function generateMetadata({ params }: OrganizationPageProps): Promise<Metadata> {
  const organization = await findOrganization(params);
  if (!organization) return { title: 'Organization not found' };

  const description = `View actions from ${organization.name} on Force Against Something.`;
  const url = `/o/${organization.slug}`;
  return {
    title: `${organization.name} | Force Against Something`,
    description,
    alternates: { canonical: url },
    openGraph: { url, title: organization.name, description, images: [] },
    twitter: { card: 'summary', title: organization.name, description, images: [] },
  };
}

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const organization = await findOrganization(params);
  if (!organization) notFound();

  return (
    <main className="org-detail-page">
      <SiteHeader />

      <section className="org-detail-hero">
        <div className="org-detail-heading">
          <Link className="back-link" href="/">← Back to all actions</Link>
          <p className="eyebrow"><span /> ORGANIZATION</p>
          <h1>{organization.name}</h1>
        </div>
        <aside className="org-detail-website">
          <p className="step">WEBSITE</p>
          {organization.website
            ? <a href={organization.website} target="_blank" rel="noreferrer">VISIT {organization.name.toUpperCase()} <span aria-hidden="true">↗</span></a>
            : <p>No website listed.</p>}
        </aside>
      </section>

      {organization.description && (
        <section className="org-description-shell">
          <div className="action-description-label"><p className="eyebrow"><span /> ABOUT</p><p>{organization.name}</p></div>
          <article className="markdown-content"><Markdown remarkPlugins={[remarkGfm]}>{organization.description}</Markdown></article>
        </section>
      )}

      <section className="org-actions-section">
        <div className="section-heading">
          <div><p className="eyebrow"><span /> THEIR WORK</p><h2>Actions</h2></div>
          <p>{organization.actions.length} published {organization.actions.length === 1 ? 'action' : 'actions'} from {organization.name}.</p>
        </div>
        <div className="action-list">
          {organization.actions.map((action) => (
            <article className="action-card" key={action.id}>
              <div className="card-main">
                <h3><Link href={`/a/${action.issueSlug}/${action.slug}`}>{action.title}</Link></h3>
                <p>{action.detail}</p>
                <span className="organization">
                  <span className="type-pill">{action.type}</span>{action.urgent && <span className="type-pill urgent">Priority</span>} <Link href={`/i/${action.issueSlug}`}>{action.issue.toUpperCase()}</Link>
                </span>
              </div>
              <div className="card-action"><Link href={`/a/${action.issueSlug}/${action.slug}`} aria-label={`Learn more and take action: ${action.title}`}>TAKE ACTION <b aria-hidden="true">→</b></Link><span>{action.effort}</span></div>
            </article>
          ))}
          {organization.actions.length === 0 && <p className="empty-state">This organization has no published actions yet.</p>}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
