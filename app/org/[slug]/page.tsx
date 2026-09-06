import { cn, s } from '@/app/tailwind-styles';
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
    <main>
      <SiteHeader />

      <section className={s.orgDetailHero}>
        <div className={s.orgDetailHeading}>
          <Link className={s.backLink} href="/">← Back to all actions</Link>
          <p className={cn(s.eyebrow, s.orgHeadingEyebrow)}><span /> ORGANIZATION</p>
          <h1 className={s.orgDetailTitle}>{organization.name}</h1>
        </div>
        <aside className={s.orgDetailWebsite}>
          <p className={s.step}>WEBSITE</p>
          {organization.website
            ? <a href={organization.website} target="_blank" rel="noreferrer">VISIT {organization.name.toUpperCase()} <span aria-hidden="true">↗</span></a>
            : <p>No website listed.</p>}
        </aside>
      </section>

      {organization.description && (
        <section className={s.orgDescriptionShell}>
          <div><p className={s.eyebrow}><span /> ABOUT</p><p>{organization.name}</p></div>
          <article className={s.markdownContent}><Markdown remarkPlugins={[remarkGfm]}>{organization.description}</Markdown></article>
        </section>
      )}

      <section className={s.orgActionsSection}>
        <div className={s.sectionHeading}>
          <div><p className={s.eyebrow}><span /> THEIR WORK</p><h2>Actions</h2></div>
          <p>{organization.actions.length} published {organization.actions.length === 1 ? 'action' : 'actions'} from {organization.name}.</p>
        </div>
        <div>
          {organization.actions.map((action) => (
            <article className={s.actionCard} key={action.id}>
              <div className={s.cardMain}>
                <h3><Link href={`/a/${action.issueSlug}/${action.slug}`}>{action.title}</Link></h3>
                <p>{action.detail}</p>
                <span className={s.organization}>
                  <span className={s.typePill}>{action.type}</span>{action.urgent && <span className={cn(s.typePill, s.typePillUrgent)}>Priority</span>} <Link href={`/i/${action.issueSlug}`}>{action.issue.toUpperCase()}</Link>
                </span>
              </div>
              <div className={s.cardAction}><Link href={`/a/${action.issueSlug}/${action.slug}`} aria-label={`Learn more and take action: ${action.title}`}>TAKE ACTION <b aria-hidden="true">→</b></Link><span>{action.effort}</span></div>
            </article>
          ))}
          {organization.actions.length === 0 && <p className={s.emptyState}>This organization has no published actions yet.</p>}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
