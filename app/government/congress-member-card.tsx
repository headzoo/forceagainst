import Image from 'next/image';
import type { PublicCongressMember } from '@/lib/db';
import { stripHtmlToText } from '@/lib/plain-text';

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', AS: 'American Samoa',
  GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico', VI: 'U.S. Virgin Islands',
};

const SOCIAL_LABELS: Record<string, string> = {
  twitter: 'Twitter',
  facebook: 'Facebook',
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

function stateLabel(state: string) {
  return STATE_NAMES[state] ? `${STATE_NAMES[state]} (${state})` : state;
}

function districtText(member: PublicCongressMember) {
  if (member.chamber === 'senate') {
    if (member.senateClass != null) return `Class ${member.senateClass}`;
    return stateLabel(member.state);
  }

  if (member.district === 0) return `${stateLabel(member.state)} · At-large`;
  if (member.district != null) return `${stateLabel(member.state)} · District ${member.district}`;
  return stateLabel(member.state);
}

function socialUrl(platform: string, value: string) {
  if (/^https?:\/\//i.test(value)) return value;

  const handle = value.replace(/^@/, '');
  switch (platform) {
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'youtube':
      return `https://youtube.com/${handle}`;
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    default:
      return null;
  }
}

type CongressMemberCardProps = {
  member: PublicCongressMember;
};

export function CongressMemberCard({ member }: CongressMemberCardProps) {
  const photoCredit = stripHtmlToText(member.officialImageAttribution);
  const capitolOffice = stripHtmlToText(member.capitolOffice);
  const mailingAddress = stripHtmlToText(member.mailingAddress);
  const socialLinks = Object.entries(member.officialSocialHandles ?? {})
    .map(([platform, value]) => {
      if (!value?.trim()) return null;
      const href = socialUrl(platform, value.trim());
      if (!href) return null;
      return { platform, href, label: SOCIAL_LABELS[platform] ?? platform };
    })
    .filter((item): item is { platform: string; href: string; label: string } => item !== null);

  return (
    <article className="congress-member-card">
      {member.officialImageUrl && (
        <div className="congress-member-photo">
          <Image
            src={member.officialImageUrl}
            alt={`Official portrait of ${member.officialFullName}`}
            width={160}
            height={200}
            unoptimized
          />
          {photoCredit && (
            <p className="congress-member-photo-credit">{photoCredit}</p>
          )}
        </div>
      )}

      <div className="congress-member-body">
        <p className="congress-member-title">{member.displayTitle}</p>
        <h3 className="congress-member-name">{member.officialFullName}</h3>
        <p className="congress-member-meta">
          <span>{member.party}</span>
          <span>{districtText(member)}</span>
        </p>

        <ul className="congress-member-links">
          {member.officialWebsite && (
            <li>
              <a href={member.officialWebsite} target="_blank" rel="noopener noreferrer">
                Official website
              </a>
            </li>
          )}
          {member.contactFormUrl && (
            <li>
              <a href={member.contactFormUrl} target="_blank" rel="noopener noreferrer">
                Contact form
              </a>
            </li>
          )}
          {member.capitolPhone && (
            <li>
              <a href={`tel:${member.capitolPhone.replace(/[^\d+]/g, '')}`}>{member.capitolPhone}</a>
            </li>
          )}
          {member.congressGovProfileUrl && (
            <li>
              <a href={member.congressGovProfileUrl} target="_blank" rel="noopener noreferrer">
                Congress.gov profile
              </a>
            </li>
          )}
        </ul>

        {capitolOffice && <p className="congress-member-office">{capitolOffice}</p>}
        {mailingAddress && mailingAddress !== capitolOffice && (
          <p className="congress-member-office">{mailingAddress}</p>
        )}

        {socialLinks.length > 0 && (
          <div className="congress-member-social">
            {socialLinks.map(({ platform, href, label }) => (
              <a key={platform} href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
