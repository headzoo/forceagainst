import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { s } from '@/app/tailwind-styles';
import { getOrganizationDirectory } from '@/lib/db';
import { createSiteMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Organizations | Force Against Something',
  description: 'Browse the organizations behind actions listed on Force Against Something.',
  path: '/orgs',
});

function websiteLabel(website: string) {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

function shortDescription(description: string) {
  const text = description
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-+*>]\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
}

export default async function OrganizationsPage() {
  const organizations = await getOrganizationDirectory();

  return (
    <main>
      <SiteHeader />

      <section className={s.likedHero}>
        <div className={s.likedHeading}>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">All actions</Link></li>
              <li aria-current="page"><span>Orgs</span></li>
            </ol>
          </nav>
          <p className={s.eyebrow}><span /> ORGANIZATION DIRECTORY</p>
          <h1 className={s.orgDirectoryTitle}>Organizations.</h1>
          <p className={s.likedHeadingCopy}>Meet the organizations behind the petitions, lawsuits, and campaigns in the directory.</p>
        </div>
        <aside className={s.likedSummary}>
          <p className={s.step}>ORGANIZATIONS</p>
          <strong>{String(organizations.length).padStart(2, '0')}</strong>
          <span>{organizations.length === 1 ? 'organization in the directory.' : 'organizations in the directory.'}</span>
        </aside>
      </section>

      <section className={s.orgDirectorySection} aria-labelledby="organizations-heading">
        <div className={s.sectionHeading}>
          <div>
            <p className={s.eyebrow}><span /> WHO IS TAKING ACTION</p>
            <h2 id="organizations-heading">All orgs.</h2>
          </div>
          <p>Browse every organization, then open a profile to see its published actions and learn more about its work.</p>
        </div>
        <ul className={s.orgDirectoryList}>
          {organizations.map((organization) => {
            const description = shortDescription(organization.description);
            return (
              <li key={organization.id}>
                <Link className={s.orgDirectoryLink} href={`/o/${organization.slug}`}>
                  <span className={s.orgDirectoryAvatar} aria-hidden="true">
                    <span>{organization.name.trim().charAt(0).toUpperCase()}</span>
                    {organization.avatar && <Image src={organization.avatar} alt="" fill sizes="74px" unoptimized />}
                  </span>
                  <div className={s.orgDirectoryCopy}>
                    <h3>{organization.name}</h3>
                    {description && <p className={s.orgDirectoryDescription}>{description}</p>}
                    {organization.website && <small className={s.orgDirectoryWebsite}>{websiteLabel(organization.website)}</small>}
                  </div>
                  <span className={s.orgDirectoryMeta}>
                    {organization.actionCount} published {organization.actionCount === 1 ? 'action' : 'actions'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <SiteFooter />
    </main>
  );
}
