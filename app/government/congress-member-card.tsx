import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFacebook,
  faInstagram,
  faTiktok,
  faXTwitter,
  faYoutube,
  type IconDefinition,
} from '@fortawesome/free-brands-svg-icons';
import type { PublicCongressMember } from '@/lib/db';
import { stripHtmlToText } from '@/lib/plain-text';
import { stateHeading } from '@/lib/us-states';

const SOCIAL_ICONS: Record<string, { icon: IconDefinition; label: string }> = {
  twitter: { icon: faXTwitter, label: 'X' },
  facebook: { icon: faFacebook, label: 'Facebook' },
  youtube: { icon: faYoutube, label: 'YouTube' },
  instagram: { icon: faInstagram, label: 'Instagram' },
  tiktok: { icon: faTiktok, label: 'TikTok' },
};

function districtText(member: PublicCongressMember) {
  if (member.chamber === 'senate') {
    if (member.senateClass != null) return `Class ${member.senateClass}`;
    return stateHeading(member.state);
  }

  if (member.district === 0) return `${stateHeading(member.state)} · At-large`;
  if (member.district != null) return `${stateHeading(member.state)} · District ${member.district}`;
  return stateHeading(member.state);
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
      const social = SOCIAL_ICONS[platform];
      if (!href || !social) return null;
      return { platform, href, icon: social.icon, label: social.label };
    })
    .filter((item): item is { platform: string; href: string; icon: IconDefinition; label: string } => item !== null);

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
            {socialLinks.map(({ platform, href, icon, label }) => (
              <a
                key={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
              >
                <FontAwesomeIcon icon={icon} fixedWidth />
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
