import { cn, s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { OpenGraphPreview } from '@/app/open-graph-preview';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getPublishedOrganizationBySlug } from '@/lib/db';
import { OrganizationActionsList } from '../organization-actions-list';

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
  const actions = organization.actions.map((action) => ({
    id: action.id,
    slug: action.slug,
    title: action.title,
    detail: action.detail,
    type: action.type,
    urgent: action.urgent,
    issue: action.issue,
    issueSlug: action.issueSlug,
    effort: action.effort,
    commentCount: action.commentCount,
  }));

  return (
    <main>
      <SiteHeader />

      <section className={s.orgDetailHero}>
        <div className={s.orgDetailHeading}>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">All actions</Link></li>
              <li aria-current="page"><span>{organization.name}</span></li>
            </ol>
          </nav>
          <p className={cn(s.eyebrow, s.orgHeadingEyebrow)}><span /> ORGANIZATION</p>
          <h1 className={s.orgDetailTitle}>{organization.name}</h1>
        </div>
        <aside className={s.orgDetailWebsite}>
          <p className={s.step}>WEBSITE</p>
          {organization.website ? (
            <>
              {organization.openGraph && (
                <div className={s.orgWebsitePreview}>
                  <OpenGraphPreview href={organization.website} openGraph={organization.openGraph} />
                </div>
              )}
              <a href={organization.website} target="_blank" rel="noreferrer">VISIT {organization.name.toUpperCase()} <span aria-hidden="true">↗</span></a>
            </>
          ) : <p>No website listed.</p>}
        </aside>
      </section>

      {(organization.description || organization.sidebar) && (
        <section className={s.orgDescriptionShell}>
          <div>
            <p className={s.eyebrow}><span /> ABOUT</p>
            {organization.sidebar && <div className={s.markdownContent}><Markdown remarkPlugins={[remarkGfm]}>{organization.sidebar}</Markdown></div>}
          </div>
          <article className={s.descriptionContent}>
            <p className={s.eyebrow}><span /> WHO THEY ARE</p>
            {organization.description && <div className={s.markdownContent}><Markdown remarkPlugins={[remarkGfm]}>{organization.description}</Markdown></div>}
          </article>
        </section>
      )}

      <section className={s.orgActionsSection}>
        <div className={s.sectionHeading}>
          <div><p className={s.eyebrow}><span /> THEIR WORK</p><h2>Actions</h2></div>
        </div>
        <OrganizationActionsList actions={actions} />
      </section>

      <SiteFooter />
    </main>
  );
}
