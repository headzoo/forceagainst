import { neon } from '@neondatabase/serverless';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { orgs } from '../db/schema';

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

type SidebarDetails = {
  leader?: string;
  leaderTitle?: string;
  leaderUrl?: string;
  address?: string;
  phone?: string;
  contactUrl: string;
};

function sidebar(details: SidebarDetails) {
  const leadership = details.leader
    ? `- **${details.leaderTitle ?? 'Leader'}:** ${details.leaderUrl ? `[${details.leader}](${details.leaderUrl})` : details.leader}`
    : details.leaderUrl
      ? `- [Leadership and staff](${details.leaderUrl})`
      : '';
  const contact = [
    details.address ? `- **Address:** ${details.address}` : '',
    details.phone ? `- **Phone:** ${details.phone}` : '',
    `- [Contact the organization](${details.contactUrl})`,
  ].filter(Boolean).join('\n');

  return `**Leadership**\n\n${leadership}\n\n**Contact**\n\n${contact}`;
}

// Details were checked against each organization's official website in September 2026.
// "Supporters of …" records receive the same sidebar as their corresponding organization.
const sidebarByBaseName: Record<string, string> = {
  'AFL-CIO': sidebar({
    leader: 'Liz Shuler', leaderTitle: 'President', leaderUrl: 'https://aflcio.org/about/leadership/liz-shuler',
    address: '815 Black Lives Matter Plaza NW, Washington, DC 20006', phone: '202-637-5100', contactUrl: 'https://aflcio.org/contact',
  }),
  AFSCME: sidebar({
    leader: 'Lee Saunders', leaderTitle: 'President', leaderUrl: 'https://www.afscme.org/about/leadership/lee-saunders',
    address: '1625 L Street NW, Washington, DC 20036-5687', phone: '202-429-1000', contactUrl: 'https://www.afscme.org/contact/',
  }),
  'Abortion Fund of Maryland': sidebar({
    leader: 'Lynn and Porsha', leaderTitle: 'Co-executive directors', leaderUrl: 'https://abortionfundmd.org/about/meet-the-staff/',
    phone: '443-247-5600 (general); 443-853-8445 (support helpline)', contactUrl: 'https://abortionfundmd.org/contact/',
  }),
  'American Civil Liberties Union': sidebar({
    leader: 'Anthony D. Romero', leaderTitle: 'Executive director', leaderUrl: 'https://www.aclu.org/about/leadership',
    address: '125 Broad Street, 18th Floor, New York, NY 10004', phone: '212-549-2500', contactUrl: 'https://www.aclu.org/about/contact-us',
  }),
  'American Indian College Fund': sidebar({
    leader: 'Cheryl Crazy Bull', leaderTitle: 'President and CEO', leaderUrl: 'https://collegefund.org/about-us/team/cheryl/',
    address: '8333 Greenwood Boulevard, Denver, CO 80221', phone: '303-426-8900', contactUrl: 'https://collegefund.org/about-us/contact/',
  }),
  'Apache Stronghold': sidebar({
    leader: 'Wendsler Nosie Sr.', leaderTitle: 'Leader', leaderUrl: 'https://www.apache-stronghold.com/',
    address: 'PO Box 766, San Carlos, AZ 85550', phone: '928-475-6751 or 928-475-9231', contactUrl: 'https://www.apache-stronghold.com/contact',
  }),
  'Autistic Self Advocacy Network': sidebar({
    leader: 'Colin Killick', leaderTitle: 'Executive director', leaderUrl: 'https://autisticadvocacy.org/about-asan/who-we-are/',
    address: 'PO Box 66122, Washington, DC 20035', contactUrl: 'https://autisticadvocacy.org/about-asan/contact/',
  }),
  'Bazelon Center for Mental Health Law': sidebar({
    leader: 'Holly O’Donnell', leaderTitle: 'CEO', leaderUrl: 'https://www.bazelon.org/about/staff-board/',
    address: '1101 15th Street NW, Suite 205, Washington, DC 20005', phone: '202-467-5730', contactUrl: 'https://www.bazelon.org/contact-us/',
  }),
  'Campaign Legal Center': sidebar({
    leader: 'Adav Noti', leaderTitle: 'Executive director', leaderUrl: 'https://campaignlegal.org/about',
    address: '1101 14th Street NW, Suite 400, Washington, DC 20005', phone: '202-736-2200', contactUrl: 'https://campaignlegal.org/contact-us',
  }),
  'Center for Biological Diversity': sidebar({
    leader: 'Kierán Suckling', leaderTitle: 'Executive director and cofounder', leaderUrl: 'https://www.biologicaldiversity.org/about/staff/',
    address: 'PO Box 710, Tucson, AZ 85702-0710', phone: '520-623-5252', contactUrl: 'https://www.biologicaldiversity.org/about/contact/',
  }),
  'Center for Public Representation': sidebar({
    leaderUrl: 'https://www.centerforpublicrep.org/', contactUrl: 'https://www.centerforpublicrep.org/',
  }),
  'Climate Justice Alliance': sidebar({
    leader: 'KD Chavez', leaderTitle: 'Executive director', leaderUrl: 'https://climatejusticealliance.org/cja-welcomes-new-executive-director/',
    contactUrl: 'https://climatejusticealliance.org/contact/',
  }),
  'Common Cause': sidebar({
    leader: 'Virginia Kase Solomón', leaderTitle: 'President and CEO', leaderUrl: 'https://www.commoncause.org/about-us/our-people/',
    address: '805 15th Street NW, Suite 800, Washington, DC 20005', phone: '202-833-1200', contactUrl: 'https://www.commoncause.org/about-us/contact/',
  }),
  'Disability Rights Education & Defense Fund': sidebar({
    leader: 'Michelle Uzeta', leaderTitle: 'Executive director', leaderUrl: 'https://dredf.org/about-us/staff/',
    address: '3075 Adeline Street, Suite 210, Berkeley, CA 94703', phone: '510-644-2555', contactUrl: 'https://dredf.org/contact-us/',
  }),
  Earthjustice: sidebar({
    leader: 'Abigail Dillen', leaderTitle: 'President', leaderUrl: 'https://earthjustice.org/staff/abigail-dillen',
    address: '180 Steuart Street, #194330, San Francisco, CA 94105', phone: '800-584-6460', contactUrl: 'https://earthjustice.org/about/contact',
  }),
  EdTrust: sidebar({
    leader: 'Denise Forte', leaderTitle: 'President and CEO', leaderUrl: 'https://edtrust.org/about/ceo-corner/',
    address: '1501 K Street NW, Suite 200, Washington, DC 20005', phone: '202-293-1217', contactUrl: 'https://edtrust.org/contact/',
  }),
  'Electronic Frontier Foundation': sidebar({
    leaderUrl: 'https://www.eff.org/about/staff', address: '815 Eddy Street, San Francisco, CA 94109', phone: '415-436-9333', contactUrl: 'https://www.eff.org/about/contact',
  }),
  'Electronic Privacy Information Center': sidebar({
    leader: 'Alan Butler', leaderTitle: 'Executive director and president', leaderUrl: 'https://epic.org/people/alan-butler/',
    address: '1519 New Hampshire Avenue NW, Washington, DC 20036', phone: '202-483-1140', contactUrl: 'https://epic.org/about/contact/',
  }),
  'Everytown Law': sidebar({
    leader: 'Eric Tirschwell', leaderTitle: 'Executive director and chief litigation counsel', leaderUrl: 'https://everytownlaw.org/about-us/',
    contactUrl: 'https://everytownlaw.org/about-us/#contact-us',
  }),
  'Everytown for Gun Safety': sidebar({
    leader: 'John Feinblatt', leaderTitle: 'President', leaderUrl: 'https://www.everytown.org/about-everytown/',
    phone: '646-324-8250', contactUrl: 'https://www.everytown.org/contact-us/',
  }),
  FAMM: sidebar({
    leader: 'Shaneva D. McReynolds', leaderTitle: 'President', leaderUrl: 'https://www.famm.org/team/dr-shaneva-d-mcreynolds/',
    address: '1100 13th Street NW, Suite 201, Washington, DC 20005', phone: '202-822-6700', contactUrl: 'https://www.famm.org/contact/',
  }),
  'Fight for the Future': sidebar({
    leader: 'Sarah Roth-Gaudette', leaderTitle: 'Executive director', leaderUrl: 'https://www.fightforthefuture.org/about/team',
    address: '68 Harrison Avenue, Suite 605, PMB 95005, Boston, MA 02111', phone: '508-368-3026', contactUrl: 'https://www.fightforthefuture.org/contact',
  }),
  GIFFORDS: sidebar({
    leader: 'Gabby Giffords', leaderTitle: 'Founder', leaderUrl: 'https://giffords.org/about/gabby-giffords/', contactUrl: 'https://giffords.org/contact/',
  }),
  Headzoo: sidebar({
    leaderUrl: 'https://headzoo.io/', contactUrl: 'https://headzoo.io/',
  }),
  'Human Rights Campaign': sidebar({
    leader: 'Kelley Robinson', leaderTitle: 'President', leaderUrl: 'https://www.hrc.org/about/leadership',
    address: '1640 Rhode Island Avenue NW, Washington, DC 20036', phone: '202-628-4160', contactUrl: 'https://www.hrc.org/about/contact-us',
  }),
  'Indigenous Environmental Network': sidebar({
    leader: 'Tom Goldtooth', leaderTitle: 'Executive director', leaderUrl: 'https://www.ienearth.org/about/',
    address: 'PO Box 485, Bemidji, MN 56619', phone: '218-751-4967', contactUrl: 'https://www.ienearth.org/contact/',
  }),
  'Innocence Project': sidebar({
    leader: 'Christina Swarns', leaderTitle: 'Executive director', leaderUrl: 'https://innocenceproject.org/team/christina-swarns/',
    address: '40 Worth Street, Suite 701, New York, NY 10013', phone: '212-364-5340', contactUrl: 'https://innocenceproject.org/contact/',
  }),
  'Lambda Legal': sidebar({
    leader: 'Kevin Jennings', leaderTitle: 'CEO', leaderUrl: 'https://lambdalegal.org/newsroom/us_20260901_ll-elects-new-members-to-board-of-directors/',
    address: '120 Wall Street, 19th Floor, New York, NY 10005', phone: '212-809-8585', contactUrl: 'https://lambdalegal.org/contact/',
  }),
  'Leadership Conference on Civil and Human Rights': sidebar({
    leader: 'Maya Wiley', leaderTitle: 'President and CEO', leaderUrl: 'https://civilrights.org/about/leadership/',
    address: '1620 L Street NW, Suite 1100, Washington, DC 20036', phone: '202-466-3311', contactUrl: 'https://civilrights.org/contact/',
  }),
  'League of Women Voters': sidebar({
    leader: 'Celina Stewart', leaderTitle: 'CEO', leaderUrl: 'https://www.lwv.org/about-us/staff',
    address: '1233 20th Street NW, Suite 500, Washington, DC 20036', phone: '202-429-1965', contactUrl: 'https://www.lwv.org/contact-us',
  }),
  'Moms Demand Action': sidebar({
    leader: 'Angela Ferrell-Zabala', leaderTitle: 'Executive director', leaderUrl: 'https://momsdemandaction.org/angela-ferrell-zabala/',
    phone: '646-324-8250', contactUrl: 'https://www.everytown.org/contact-us/',
  }),
  'NAACP Legal Defense Fund': sidebar({
    leader: 'Janai Nelson', leaderTitle: 'President and director-counsel', leaderUrl: 'https://www.naacpldf.org/about-us/staff/',
    address: '40 Rector Street, 5th Floor, New York, NY 10006', phone: '212-965-2200', contactUrl: 'https://www.naacpldf.org/contact-us/',
  }),
  'NDN Collective': sidebar({
    leader: 'Nick Tilsen', leaderTitle: 'President and CEO', leaderUrl: 'https://ndncollective.org/people/',
    address: '408 Knollwood Drive, Rapid City, SD 57701', phone: '605-791-3999', contactUrl: 'https://ndncollective.org/contact/',
  }),
  'National Domestic Workers Alliance': sidebar({
    leader: 'Ai-jen Poo', leaderTitle: 'President', leaderUrl: 'https://www.domesticworkers.org/',
    address: '45 Broadway, Suite 2240, New York, NY 10006', phone: '646-360-5806', contactUrl: 'https://www.domesticworkers.org/contact/',
  }),
  'National Education Association': sidebar({
    leader: 'Princess Moss', leaderTitle: 'President', leaderUrl: 'https://www.nea.org/our-leaders',
    address: '1201 16th Street NW, Washington, DC 20036-3290', phone: '202-833-4000', contactUrl: 'https://www.nea.org/about-nea/contact-us',
  }),
  'National Employment Law Project': sidebar({
    leader: 'Rebecca Dixon', leaderTitle: 'President and CEO', leaderUrl: 'https://www.nelp.org/person/rebecca-dixon/',
    address: 'PO Box 1779, New York, NY 10008', phone: '212-285-3025', contactUrl: 'https://www.nelp.org/about-us/contact-us/',
  }),
  'National Family Planning & Reproductive Health Association': sidebar({
    leader: 'Clare Coleman', leaderTitle: 'President and CEO', leaderUrl: 'https://www.nationalfamilyplanning.org/about',
    phone: '202-293-3114', contactUrl: 'https://www.nationalfamilyplanning.org/contact-us',
  }),
  'National Housing Law Project': sidebar({
    leader: 'Shamus Roller', leaderTitle: 'CEO', leaderUrl: 'https://www.nhlp.org/about/staff/',
    address: '90 New Montgomery Street, Suite 1015, San Francisco, CA 94105', phone: '415-546-7000', contactUrl: 'https://www.nhlp.org/about/contact/',
  }),
  'National Immigration Law Center': sidebar({
    leader: 'Kica Matos', leaderTitle: 'President', leaderUrl: 'https://www.nilc.org/about-us/staff/',
    address: '3450 Wilshire Boulevard #108-62, Los Angeles, CA 90010', phone: '213-639-3900', contactUrl: 'https://www.nilc.org/about-us/contact-us/',
  }),
  'National Low Income Housing Coalition': sidebar({
    leader: 'Renee M. Willis', leaderTitle: 'President and CEO', leaderUrl: 'https://nlihc.org/about/staff',
    address: '1000 Vermont Avenue NW, Suite 500, Washington, DC 20005', phone: '202-662-1530', contactUrl: 'https://nlihc.org/about/contact',
  }),
  'National Network of Abortion Funds': sidebar({
    leaderUrl: 'https://abortionfunds.org/', contactUrl: 'https://abortionfunds.org/contact/',
  }),
  'Native Organizers Alliance Action Fund': sidebar({
    leader: 'Judith LeBlanc', leaderTitle: 'Executive director', leaderUrl: 'https://nativeorganizing.org/who-we-are/our-team/',
    contactUrl: 'https://nativeorganizing.org/contact-us/',
  }),
  PFLAG: sidebar({
    leader: 'Brian K. Bond', leaderTitle: 'CEO', leaderUrl: 'https://pflag.org/our-team/',
    address: '1625 K Street NW, Suite 700, Washington, DC 20006', phone: '202-467-8180', contactUrl: 'https://pflag.org/contact/',
  }),
  'Planned Parenthood Great Northwest': sidebar({
    leader: 'Rebecca Gibron', leaderTitle: 'CEO', leaderUrl: 'https://www.ppgnhaik.org/about-us',
    contactUrl: 'https://www.ppgnhaik.org/contact-us',
  }),
  RAICES: sidebar({
    leaderUrl: 'https://raicestexas.org/leadership', address: 'PO Box 786100, San Antonio, TX 78278', phone: '833-372-4237', contactUrl: 'https://raicestexas.org/contact',
  }),
  'Sunrise Movement': sidebar({
    leader: 'Aru Shiney-Ajay', leaderTitle: 'Executive director', leaderUrl: 'https://www.sunrisemovement.org/about/',
    contactUrl: 'https://www.sunrisemovement.org/contact/',
  }),
  'The Bail Project': sidebar({
    leader: 'David Gaspar', leaderTitle: 'CEO', leaderUrl: 'https://bailproject.org/press/ceo/',
    address: 'PO Box 750, Venice, CA 90294', phone: '323-366-0799', contactUrl: 'https://bailproject.org/contact/',
  }),
  'Vote.org': sidebar({
    leader: 'Andrea Hailey', leaderTitle: 'CEO', leaderUrl: 'https://www.vote.org/team/',
    contactUrl: 'https://www.vote.org/contact/',
  }),
};

const db = drizzle(neon(connectionString));
const organizationRows = await db.select({ id: orgs.id, name: orgs.name }).from(orgs).orderBy(asc(orgs.name));
const baseName = (name: string) => name.replace(/^Supporters of /, '');
const databaseBaseNames = new Set(organizationRows.map((organization) => baseName(organization.name)));
const missingContent = [...databaseBaseNames].filter((name) => !sidebarByBaseName[name]);
const missingOrganizations = Object.keys(sidebarByBaseName).filter((name) => !databaseBaseNames.has(name));

if (missingContent.length || missingOrganizations.length) {
  throw new Error([
    missingContent.length ? `No sidebar content for: ${missingContent.join(', ')}` : '',
    missingOrganizations.length ? `No matching database organization for: ${missingOrganizations.join(', ')}` : '',
  ].filter(Boolean).join('\n'));
}

const now = new Date();
for (const organization of organizationRows) {
  await db.update(orgs).set({
    sidebar: sidebarByBaseName[baseName(organization.name)],
    updatedAt: now,
  }).where(eq(orgs.id, organization.id));
}

console.log(`Backfilled sidebar Markdown for ${organizationRows.length} organization records (${databaseBaseNames.size} distinct organizations).`);
