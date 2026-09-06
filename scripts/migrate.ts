import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { count, inArray } from 'drizzle-orm';
import { actions, issues, orgs } from '../db/schema';
import { organizationKey, supportersName } from '../lib/organization-names';

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED is missing from .env.local.');
}

const client = neon(connectionString);
const db = drizzle(client);

await migrate(db, { migrationsFolder: './drizzle' });

const issueSeeds: Array<typeof issues.$inferInsert> = [
  { slug: 'voting-rights', name: 'Voting rights', status: 'active', sortOrder: 1 },
  { slug: 'criminal-justice', name: 'Criminal justice', status: 'active', sortOrder: 2 },
  { slug: 'reproductive-freedom', name: 'Reproductive freedom', status: 'active', sortOrder: 3 },
  { slug: 'climate-justice', name: 'Climate justice', status: 'active', sortOrder: 4 },
  {
    slug: 'racial-justice',
    name: 'Racial justice',
    detail: 'Issues related to race and ethnicity, including discrimination, civil rights, equal protection, public policy, representation, and institutional practices.',
    description: 'This issue covers topics related to race and ethnicity, including discrimination, civil rights, equal protection, voting, housing, policing, education, healthcare, employment, representation, and government or institutional policy.\n\nListings may reflect different viewpoints and may support, oppose, or propose changes to related laws, policies, or practices.',
    status: 'active',
    sortOrder: 5,
  },
  { slug: 'immigrant-rights', name: 'Immigrant rights', status: 'active', sortOrder: 6 },
  { slug: 'lgbtq-rights', name: 'LGBTQ+ rights', status: 'active', sortOrder: 7 },
  { slug: 'housing-justice', name: 'Housing justice', status: 'active', sortOrder: 8 },
  { slug: 'disability-rights', name: 'Disability rights', status: 'active', sortOrder: 9 },
  { slug: 'workers-rights', name: 'Workers’ rights', status: 'active', sortOrder: 10 },
  { slug: 'gun-violence', name: 'Gun violence', status: 'active', sortOrder: 11 },
  { slug: 'indigenous-rights', name: 'Indigenous rights', status: 'active', sortOrder: 12 },
  { slug: 'digital-rights', name: 'Digital rights', status: 'active', sortOrder: 13 },
  { slug: 'education-equity', name: 'Education equity', status: 'active', sortOrder: 14 },
];

const [{ issueCount: issueCountBeforeSeed }] = await db.select({ issueCount: count() }).from(issues);

if (issueCountBeforeSeed === 0) {
  await db.insert(issues).values(issueSeeds).onConflictDoNothing({ target: issues.slug });
}

const issueRows = await db
  .select({ id: issues.id, slug: issues.slug, status: issues.status, sortOrder: issues.sortOrder })
  .from(issues)
  .where(inArray(issues.slug, issueSeeds.map((issue) => issue.slug)));

const placeholderIssue = { id: 0, slug: '', status: 'planned' as const, sortOrder: 0 };
const missingIssueSlugs = issueSeeds
  .map((issue) => issue.slug)
  .filter((slug) => !issueRows.some((issue) => issue.slug === slug));

if (missingIssueSlugs.length > 0) {
  console.warn(`Skipping seed actions because these issue slugs are not present: ${missingIssueSlugs.join(', ')}`);
}

const votingRights = issueRows.find((issue) => issue.slug === 'voting-rights') ?? placeholderIssue;
const criminalJustice = issueRows.find((issue) => issue.slug === 'criminal-justice') ?? placeholderIssue;
const reproductiveFreedom = issueRows.find((issue) => issue.slug === 'reproductive-freedom') ?? placeholderIssue;
const climateJustice = issueRows.find((issue) => issue.slug === 'climate-justice') ?? placeholderIssue;
const immigrantRights = issueRows.find((issue) => issue.slug === 'immigrant-rights') ?? placeholderIssue;
const lgbtqRights = issueRows.find((issue) => issue.slug === 'lgbtq-rights') ?? placeholderIssue;
const housingJustice = issueRows.find((issue) => issue.slug === 'housing-justice') ?? placeholderIssue;
const disabilityRights = issueRows.find((issue) => issue.slug === 'disability-rights') ?? placeholderIssue;
const workersRights = issueRows.find((issue) => issue.slug === 'workers-rights') ?? placeholderIssue;
const gunViolence = issueRows.find((issue) => issue.slug === 'gun-violence') ?? placeholderIssue;
const indigenousRights = issueRows.find((issue) => issue.slug === 'indigenous-rights') ?? placeholderIssue;
const digitalRights = issueRows.find((issue) => issue.slug === 'digital-rights') ?? placeholderIssue;
const educationEquity = issueRows.find((issue) => issue.slug === 'education-equity') ?? placeholderIssue;

type SeedOrganization = {
  name: string;
  website?: string;
  description?: string;
};

type SeedAction = {
  issueId: number;
  organization: SeedOrganization;
  slug: string;
  type: 'Petition' | 'Lawsuit' | 'Campaign';
  title: string;
  detail: string;
  description: string;
  effort: string;
  href: string;
  urgent?: boolean;
  sortOrder: number;
};

const org = (name: string, website?: string, description?: string): SeedOrganization => ({
  name,
  ...(website ? { website } : {}),
  ...(description ? { description } : {}),
});

function slugifyOrganization(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '') || 'organization';
}

function uniqueSeedOrganizationSlug(name: string, usedSlugs: Set<string>) {
  const base = slugifyOrganization(name);
  let candidate = base;
  let suffix = 2;
  while (usedSlugs.has(candidate)) {
    const ending = `-${suffix}`;
    candidate = `${base.slice(0, 80 - ending.length).replace(/-+$/g, '')}${ending}`;
    suffix += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

const seedActions: SeedAction[] = missingIssueSlugs.length === 0 ? [
  { issueId: votingRights.id, organization: org('Leadership Conference on Civil and Human Rights'), slug: 'pass-john-lewis-voting-rights-act', type: 'Petition', title: 'Pass the John R. Lewis Voting Rights Advancement Act', detail: 'Tell Congress to restore and strengthen protections against discriminatory voting rules.', description: '## Why this matters\n\nThe John R. Lewis Voting Rights Advancement Act would restore and modernize federal protections against discriminatory voting practices.\n\n## What you can do\n\nAdd your name and urge Congress to pass the bill.', effort: '2 min', href: 'https://civilrights.org/john-lewis-voting-rights-act/', urgent: true, sortOrder: 1 },
  { issueId: votingRights.id, organization: org('Campaign Legal Center'), slug: 'defend-voters-discriminatory-maps', type: 'Lawsuit', title: 'Defend voters from discriminatory maps', detail: 'Support an active case challenging Florida’s 2026 congressional map as an illegal partisan gerrymander.', description: '## About the case\n\nCampaign Legal Center is challenging Florida’s congressional map and working to protect voters from discriminatory district lines.\n\nFollow the case for filings, decisions, and ways to support fair representation.', effort: 'Follow case', href: 'https://campaignlegal.org/cases-actions/fighting-partisan-gerrymandering-florida-thompson-wynn-v-byrd', sortOrder: 2 },
  { issueId: votingRights.id, organization: org('Common Cause'), slug: 'join-local-voting-rights-team', type: 'Campaign', title: 'Join a local voting rights team', detail: 'Get trained to protect elections, contact lawmakers, and organize in your community.', description: '## Make an impact locally\n\nJoin volunteers working in their communities to protect elections and expand access to the ballot. Opportunities can include voter education, contacting lawmakers, and election protection.', effort: 'Volunteer', href: 'https://www.commoncause.org/articles/why-do-people-volunteer-to-help-with-elections/', sortOrder: 3 },
  { issueId: votingRights.id, organization: org('League of Women Voters'), slug: 'support-expansion-voting-rights', type: 'Petition', title: 'Support the expansion of voting rights', detail: 'Add your voice to the national push for accessible, secure, and fair elections.', description: '## Add your voice\n\nTell elected officials that accessible, secure, and fair elections are a priority. The League of Women Voters provides a direct way to support expanded voting rights.', effort: '3 min', href: 'https://www.lwv.org/take-action/support-expansion-voting-rights', sortOrder: 4 },
  { issueId: votingRights.id, organization: org('Vote.org'), slug: 'help-voters-prepare-next-election', type: 'Campaign', title: 'Help voters get ready for the next election', detail: 'Share trusted registration, ballot, and polling-place tools with your network.', description: '## Help someone vote\n\nShare trusted tools that help people check their registration, request a ballot, find a polling place, and understand important election deadlines.', effort: 'Share', href: 'https://www.vote.org/', sortOrder: 5 },
  { issueId: criminalJustice.id, organization: org('The Bail Project'), slug: 'stop-harmful-federal-bail-bills', type: 'Petition', title: 'Tell Congress to reject harmful federal bail bills', detail: 'Email your representative to oppose bills that would punish state and local governments for adopting bail reform.', description: '## What is happening\n\nCongress is considering federal proposals aimed at pressuring state and local governments to roll back evidence-based bail reforms. The Bail Project warns that the measures would deepen a two-tiered pretrial system in which freedom depends on wealth.\n\n## What you can do\n\nUse the Bail Project’s action link to email your House representative and ask for a no vote on H.R. 5213, H.R. 5625, and H.R. 6260.', effort: '3 min', href: 'https://bailproject.org/policy/take-action-stop-harmful-bail-legislation-in-congress/', urgent: true, sortOrder: 1 },
  { issueId: criminalJustice.id, organization: org('Innocence Project'), slug: 'compensate-exoneree-dion-harrell', type: 'Petition', title: 'Demand compensation for exoneree Dion Harrell', detail: 'Ask New Jersey’s attorney general to compensate Dion Harrell after DNA evidence cleared his wrongful conviction.', description: '## Why this matters\n\nDion Harrell spent four years in prison and more than two decades on New Jersey’s sex-offender registry before DNA evidence proved his innocence. The state agrees he is innocent but has opposed compensation on a filing-deadline technicality.\n\n## What you can do\n\nSign the Innocence Project petition asking the New Jersey attorney general to compensate him now.', effort: '2 min', href: 'https://innocenceproject.org/petitions/compensate-dion/', sortOrder: 2 },
  { issueId: criminalJustice.id, organization: org('FAMM'), slug: 'end-mandatory-minimums-state', type: 'Campaign', title: 'Tell your state lawmakers to end mandatory minimums', detail: 'Send a state-specific message supporting sentencing laws that let judges consider the facts of each case.', description: '## The issue\n\nMandatory minimum laws require fixed prison terms and prevent judges from tailoring a sentence to the person and circumstances before them. FAMM is campaigning state by state to repeal or reform these laws.\n\n## What you can do\n\nEnter your address to contact the lawmakers who represent you and urge them to oppose new mandatory minimums and reform the ones already in place.', effort: '5 min', href: 'https://secure.everyaction.com/BQjj7tbFcEaTHEFM1pyy2w2', sortOrder: 3 },
  { issueId: criminalJustice.id, organization: org('American Civil Liberties Union'), slug: 'challenge-facial-recognition-wrongful-arrest', type: 'Lawsuit', title: 'Follow the challenge to a facial-recognition wrongful arrest', detail: 'Track a 2026 lawsuit seeking accountability and policy changes after police arrested the wrong person using an incorrect facial-recognition match.', description: '## About the case\n\nRobert Dillon is suing three Florida law-enforcement defendants after officers relied on an incorrect facial-recognition result, allowed it to influence a photo lineup, and arrested him for a crime committed hundreds of miles from his home.\n\nThe ongoing lawsuit seeks damages and policy changes designed to prevent future wrongful arrests driven by unreliable facial-recognition matches.', effort: 'Follow case', href: 'https://www.aclu.org/cases/dillon-v-city-of-jacksonville-beach', sortOrder: 4 },
  { issueId: criminalJustice.id, organization: org('American Civil Liberties Union'), slug: 'defend-family-visits-in-jail', type: 'Lawsuit', title: 'Defend families’ right to visit loved ones in jail', detail: 'Follow an ongoing Colorado case challenging a county jail’s ban on in-person family visits.', description: '## About the case\n\nFamilies of people incarcerated in Adams County Jail are challenging a ban on in-person visits under the Colorado Constitution. The appeal also asks whether state courts can directly stop ongoing violations of constitutional rights.\n\nFollow the case for filings and updates about family association and the enforceability of state constitutional protections.', effort: 'Follow case', href: 'https://www.aclu.org/cases/e-l-v-claps', sortOrder: 5 },
  { issueId: reproductiveFreedom.id, organization: org('American Civil Liberties Union'), slug: 'protect-emergency-abortion-care', type: 'Petition', title: 'Demand protection for emergency abortion care', detail: 'Tell the administration to stop weakening federal protections for pregnant patients who need stabilizing abortion care.', description: '## Why this is urgent\n\nThe federal government withdrew from litigation challenging Idaho’s abortion ban, weakening enforcement of the Emergency Medical Treatment and Labor Act for pregnant patients who need stabilizing care.\n\n## What you can do\n\nAdd your name to the ACLU petition demanding an end to federal actions that put emergency abortion care at risk.', effort: '2 min', href: 'https://action.aclu.org/petition/president-trump-stop-risking-pregnant-patients-lives', urgent: true, sortOrder: 1 },
  { issueId: reproductiveFreedom.id, organization: org('American Civil Liberties Union'), slug: 'demand-federal-abortion-rights-access', type: 'Petition', title: 'Tell Congress to protect abortion access nationwide', detail: 'Send Congress a message supporting the right to abortion, medication abortion, and meaningful access for everyone.', description: '## The issue\n\nAfter the loss of the federal constitutional right to abortion, access has depended heavily on geography and resources. Medication abortion and the ability to receive it by mail remain targets of legal and political attacks.\n\n## What you can do\n\nUse the ACLU’s form to tell Congress that any federal solution should protect abortion rights nationwide and remove barriers to care.', effort: '3 min', href: 'https://action.aclu.org/send-message/demand-federal-action-abortion-rights-and-access', sortOrder: 2 },
  { issueId: reproductiveFreedom.id, organization: org('Planned Parenthood Great Northwest'), slug: 'fight-alaska-telehealth-abortion-ban', type: 'Lawsuit', title: 'Follow the fight for telehealth medication abortion in Alaska', detail: 'Track the 2026 lawsuit challenging a ban that forces Alaskans to travel to receive medication abortion.', description: '## About the case\n\nPlanned Parenthood Great Northwest filed suit against Alaska’s ban on direct-to-patient telehealth medication abortion. The restriction can force patients to travel hundreds of miles to Anchorage or Fairbanks, including people in communities reachable only by plane.\n\nThe lawsuit argues that this medically unnecessary travel burden violates the Alaska Constitution’s protection for abortion access.', effort: 'Follow case', href: 'https://www.aclu.org/cases/planned-parenthood-great-northwest-hawai%CA%BBi-alaska-indiana-and-kentucky-v-state-of-alaska-et-al', sortOrder: 3 },
  { issueId: reproductiveFreedom.id, organization: org('National Family Planning & Reproductive Health Association'), slug: 'protect-title-x-family-planning-care', type: 'Lawsuit', title: 'Protect Title X family planning care', detail: 'Follow a lawsuit challenging political conditions that could push qualified providers out of the federal family-planning program.', description: '## About the case\n\nThe National Family Planning & Reproductive Health Association and the Family Health Council of Central Pennsylvania sued over the federal government’s fiscal-year 2027 Title X funding process.\n\nThey argue that political alignment requirements could displace qualified providers and undermine a program that supports contraception, cancer screening, STI care, and other preventive services for patients with low incomes.', effort: 'Follow case', href: 'https://www.aclu.org/cases/national-family-planning-reproductive-health-association-et-al-v-robert-f-kennedy-jr-et-al', sortOrder: 4 },
  { issueId: reproductiveFreedom.id, organization: org('National Network of Abortion Funds'), slug: 'support-local-abortion-fund', type: 'Campaign', title: 'Support a local abortion fund', detail: 'Find a fund in your community to donate, volunteer, or help with travel, lodging, childcare, and other access needs.', description: '## Turn support into access\n\nLocal abortion funds help people cover the cost of care and overcome logistical barriers such as travel, lodging, translation, and childcare. Their capacity and availability can change quickly.\n\n## What you can do\n\nSearch the National Network of Abortion Funds directory, choose a fund serving your community, and use its page to donate or find other ways to get involved.', effort: 'Find a fund', href: 'https://abortionfunds.org/find-a-fund/', sortOrder: 5 },
  {
    issueId: climateJustice.id,
    organization: org(
      'Earthjustice',
      'https://earthjustice.org/',
      'Earthjustice is a nonprofit public-interest environmental law organization that partners with communities to protect health, advance clean energy, and combat climate change.',
    ),
    slug: 'address-environmental-injustice-congress',
    type: 'Petition',
    title: 'Tell Congress to address environmental injustice',
    detail: 'Urge Congress to stop pollution rollbacks and hold industries accountable for harms that fall hardest on communities of color and low-income neighborhoods.',
    description: '## Why this matters\n\nCommunities near ports, petrochemical corridors, warehouses, and industrial sites still breathe dirtier air and live with higher toxic exposure than others.\n\nEarthjustice is asking Congress to defend environmental justice protections and refuse policy that lets polluters expand that burden.\n\n## What you can do\n\nSend a letter through Earthjustice’s action page telling your members of Congress to address environmental injustice and hold polluting industries accountable.',
    effort: '3 min',
    href: 'https://earthjustice.org/action/congress-must-address-environmental-injustices-and-hold-polluters-accountable',
    urgent: true,
    sortOrder: 1,
  },
  {
    issueId: climateJustice.id,
    organization: org(
      'Center for Biological Diversity',
      'https://www.biologicaldiversity.org/',
      'The Center for Biological Diversity uses science, law, and creative media to protect endangered species and the lands, waters, and climate they need to survive.',
    ),
    slug: 'force-cleanup-abandoned-oil-gas-wells',
    type: 'Lawsuit',
    title: 'Follow the fight to make oil companies clean up abandoned wells',
    detail: 'Track a 2026 New Mexico lawsuit seeking enforcement against thousands of idle oil and gas wells that threaten nearby communities.',
    description: '## About the case\n\nThe Center for Biological Diversity, San Juan Citizens Alliance, and Tó Nizhóní Ání sued New Mexico for failing to require operators to plug roughly 3,300 illegal inactive wells.\n\nIdle wells can emit methane and other toxins, contaminate land and water, and raise the risk of mechanical failures near homes and workplaces. The plaintiffs argue the state must enforce the Oil and Gas Act and make polluters pay for cleanup rather than leave communities with the toxic legacy.\n\n## What you can do\n\nFollow the case for filings, updates, and ways to support accountability for abandoned oil and gas infrastructure.',
    effort: 'Follow case',
    href: 'https://biologicaldiversity.org/w/news/press-releases/new-mexico-sued-over-failure-to-hold-fossil-fuel-companies-accountable-for-well-cleanup-2026-03-09/',
    sortOrder: 2,
  },
  {
    issueId: climateJustice.id,
    organization: org(
      'Climate Justice Alliance',
      'https://climatejusticealliance.org/',
      'Climate Justice Alliance unites frontline communities to organize a Just Transition from extractive systems toward regenerative, equitable, and locally rooted economies.',
    ),
    slug: 'reinvest-in-frontline-community-power',
    type: 'Campaign',
    title: 'Reinvest in frontline community power',
    detail: 'Support a campaign moving capital into democratically governed projects owned and operated by communities on the frontlines of climate harm.',
    description: '## The campaign\n\nReinvest in Our Power calls on philanthropy to divert money away from Wall Street extractive investments and into regenerative projects led by frontline communities.\n\nThrough the Our Power Loan Fund, Climate Justice Alliance members finance worker-owned cooperatives, resiliency hubs, community solar, and other Just Transition projects with non-extractive capital and technical support.\n\n## What you can do\n\nLearn how the campaign works, explore community-led projects, and use Climate Justice Alliance’s Reinvest in Our Power page to find ways to get involved.',
    effort: 'Learn & share',
    href: 'https://climatejusticealliance.org/workgroup/reinvest/',
    sortOrder: 3,
  },
  {
    issueId: climateJustice.id,
    organization: org(
      'Sunrise Movement',
      'https://www.sunrisemovement.org/',
      'Sunrise Movement organizes young people to stop the climate crisis, build people power, and win a Green New Deal rooted in justice.',
    ),
    slug: 'organize-local-green-new-deal',
    type: 'Campaign',
    title: 'Organize for a local Green New Deal',
    detail: 'Join local campaigns for green public housing, affordable clean transit, publicly owned renewable power, and resilient public spaces.',
    description: '## Why local action matters\n\nSunrise’s Green New Deal for Communities campaign fights city by city for policies that cut fossil fuel dependence while making daily life more affordable and resilient.\n\nChapter campaigns include weatherizing and electrifying public housing, expanding clean transit, shifting utilities toward public renewable power, and rebuilding parks and community spaces that help neighborhoods withstand extreme weather.\n\n## What you can do\n\nVisit the campaign page to learn the demands, find local organizing opportunities, and help build public support for a Green New Deal where you live.',
    effort: 'Volunteer',
    href: 'https://www.sunrisemovement.org/campaign/green-new-deal-for-communities/',
    sortOrder: 4,
  },
  {
    issueId: climateJustice.id,
    organization: org(
      'Indigenous Environmental Network',
      'https://www.ienearth.org/',
      'Indigenous Environmental Network is an alliance of Indigenous Peoples working to protect sacred lands, waters, and communities from contamination and extractive exploitation.',
    ),
    slug: 'support-indigenous-led-resistance-extraction',
    type: 'Campaign',
    title: 'Support Indigenous-led resistance to extraction',
    detail: 'Follow Keep It In The Ground work defending Indigenous self-determination, free prior and informed consent, and frontline resistance to fossil-fuel and mining expansion.',
    description: '## Why this matters\n\nIndigenous Environmental Network’s Keep It In The Ground campaign supports grassroots leaders confronting pipelines, uranium and critical-mineral mining, and other extractive projects on or near Indigenous territories.\n\nThe work centers Indigenous knowledge, treaty rights, and the right to say no—while building solidarity across communities fighting for water, sacred sites, and a just transition away from fossil fuels.\n\n## What you can do\n\nRead current campaign updates, amplify Indigenous-led calls to action, and use IEN’s Keep It In The Ground reporting to stay connected to frontline fights.',
    effort: 'Follow & amplify',
    href: 'https://www.ienearth.org/keep-it-in-the-ground/',
    sortOrder: 5,
  },
  {
    issueId: immigrantRights.id,
    organization: org('American Civil Liberties Union'),
    slug: 'force-vote-dream-and-promise-act',
    type: 'Petition',
    title: 'Tell Congress to force a vote on the Dream and Promise Act',
    detail: 'Urge lawmakers to sign the discharge petition that would bring a pathway to citizenship for Dreamers, TPS holders, and other long-term residents to the House floor.',
    description: '## Why this is urgent\n\nThe Dream and Promise Act would create a pathway to citizenship for Dreamers who came to the country as children, people with Temporary Protected Status, and other long-term residents who are already part of American communities.\n\nA House discharge petition can force a floor vote if enough members sign on. The ACLU is asking constituents to pressure Congress now, while DACA and TPS protections remain under attack.\n\n## What you can do\n\nUse the ACLU’s form to tell your members of Congress to sign the discharge petition and pass the Dream and Promise Act.',
    effort: '3 min',
    href: 'https://action.aclu.org/send-message/pathway-citizenship-now',
    urgent: true,
    sortOrder: 1,
  },
  {
    issueId: immigrantRights.id,
    organization: org(
      'National Immigration Law Center',
      'https://www.nilc.org/',
      'The National Immigration Law Center advances the rights and opportunities of low-income immigrants and their loved ones through litigation, policy advocacy, and community education.',
    ),
    slug: 'challenge-tennessee-anti-immigrant-law',
    type: 'Lawsuit',
    title: 'Follow the challenge to Tennessee’s anti-immigrant law',
    detail: 'Track the June 2026 federal class action seeking to block HB 1704, which would criminalize certain immigrants for remaining in Tennessee.',
    description: '## About the case\n\nIn Lucy v. Skrmetti, the National Immigration Law Center, the ACLU Immigrants’ Rights Project, and the ACLU of Tennessee sued to stop Tennessee’s HB 1704 before it took effect.\n\nThe law would make it a state crime for some people with final removal orders to remain in Tennessee—even people with pending humanitarian applications—usurping federal immigration authority and putting longstanding residents at risk of arrest and prosecution.\n\n## What you can do\n\nFollow the case for filings, injunction rulings, and updates that show how the challenge is protecting immigrant communities.',
    effort: 'Follow case',
    href: 'https://www.nilc.org/litigation/lucy-v-skrmetti/',
    sortOrder: 2,
  },
  {
    issueId: immigrantRights.id,
    organization: org('American Civil Liberties Union'),
    slug: 'challenge-camp-east-montana-detention',
    type: 'Lawsuit',
    title: 'Follow the fight over Camp East Montana detention conditions',
    detail: 'Track the ongoing lawsuit challenging unsafe and inhumane conditions at ICE’s large tent detention camp on a military base near El Paso.',
    description: '## About the case\n\nPeople detained at Camp East Montana sued ICE over conditions that include crowded windowless tents, inadequate healthcare, solitary confinement, and disease outbreaks. The facility is among the largest ICE detention sites in the country, and multiple deaths have already been reported there.\n\nThe class action challenges the camp’s operation under the Constitution and the Administrative Procedure Act.\n\n## What you can do\n\nFollow the ACLU case page for the complaint, declarations, and updates as the litigation continues.',
    effort: 'Follow case',
    href: 'https://www.aclu.org/cases/akari-angye-et-al-v-ice',
    sortOrder: 3,
  },
  {
    issueId: immigrantRights.id,
    organization: org(
      'National Immigration Law Center',
      'https://www.nilc.org/',
      'The National Immigration Law Center advances the rights and opportunities of low-income immigrants and their loved ones through litigation, policy advocacy, and community education.',
    ),
    slug: 'demand-congress-hold-ice-accountable',
    type: 'Petition',
    title: 'Demand Congress hold ICE accountable',
    detail: 'Tell Congress to conduct rigorous oversight of ICE, curb abusive enforcement, and investigate detention-center rights violations.',
    description: '## Why this matters\n\nNILC warns that allowing ICE to operate without meaningful oversight endangers immigrants and weakens basic democratic accountability.\n\nTheir action asks members of Congress to visit facilities, oppose unchecked funding expansion, demand visible identification for agents, and shut down detention centers with documented abuse.\n\n## What you can do\n\nSend NILC’s message to your representatives urging immediate congressional oversight of ICE.',
    effort: '3 min',
    href: 'https://act.nilc.org/page/86225/action/1?locale=en-US',
    sortOrder: 4,
  },
  {
    issueId: immigrantRights.id,
    organization: org(
      'RAICES',
      'https://raicestexas.org/',
      'RAICES is a Texas-based immigrant and refugee rights nonprofit that provides legal aid, social services, and nationwide advocacy for people seeking safety and due process.',
    ),
    slug: 'join-raices-volunteer-advocacy',
    type: 'Campaign',
    title: 'Join RAICES volunteer and advocacy work',
    detail: 'Get trained for national volunteer roles and take actions that defend due process, end family detention, and demand accountability.',
    description: '## Make an impact\n\nRAICES runs a national volunteer program with remote and in-person opportunities, from phone banking and pro se clinic support to community education and fundraising.\n\nIts Action Center also hosts current advocacy campaigns focused on restoring due process, ending family detention, and holding immigration agencies accountable.\n\n## What you can do\n\nApply to volunteer, attend orientation, and use the RAICES Action Center to take the latest advocacy steps.',
    effort: 'Volunteer',
    href: 'https://raicestexas.org/volunteer',
    sortOrder: 5,
  },
  {
    issueId: lgbtqRights.id,
    organization: org(
      'Human Rights Campaign',
      'https://www.hrc.org/',
      'The Human Rights Campaign is the nation’s largest LGBTQ+ civil rights organization, working to elect pro-equality leaders and advance inclusive policies in schools, workplaces, healthcare, and communities.',
    ),
    slug: 'pass-transgender-health-care-access-act',
    type: 'Petition',
    title: 'Tell Congress to pass the Transgender Health Care Access Act',
    detail: 'Urge the House to expand access to medically necessary, affirming care and invest in culturally competent provider training.',
    description: '## Why this matters\n\nThe Transgender Health Care Access Act aims to increase access to evidence-based, affirming care and strengthen the provider workforce that transgender people rely on.\n\nAt a time when state and federal attacks are restricting care, HRC is mobilizing public support to show Congress that health equity is a priority.\n\n## What you can do\n\nUse HRC’s form to tell your representatives to pass the Transgender Health Care Access Act.',
    effort: '3 min',
    href: 'https://act.hrc.org/page/173347/action/1?locale=en-US',
    sortOrder: 1,
  },
  {
    issueId: lgbtqRights.id,
    organization: org(
      'Lambda Legal',
      'https://lambdalegal.org/',
      'Lambda Legal is a national organization working to achieve full recognition of the civil rights of LGBTQ+ people and everyone living with HIV through impact litigation, education, and public policy.',
    ),
    slug: 'block-doj-trans-youth-medical-records',
    type: 'Lawsuit',
    title: 'Follow the fight to protect transgender youths’ medical records',
    detail: 'Track the New York class action blocking the Department of Justice from seizing identities and sensitive health information of transgender youth.',
    description: '## About the case\n\nIn Coe v. Blanche, Lambda Legal, the ACLU, and NYCLU sued after DOJ grand jury subpoenas sought patient identities and sensitive records from New York City hospitals that provided gender-affirming care to minors.\n\nA federal court issued a temporary restraining order and later a preliminary injunction; in August 2026 the Second Circuit denied the government’s request to pause that protection while the appeal continues.\n\n## What you can do\n\nFollow the case for injunction updates and filings defending patient privacy and transgender youth healthcare.',
    effort: 'Follow case',
    href: 'https://lambdalegal.org/case/coe-v-blanche/',
    urgent: true,
    sortOrder: 2,
  },
  {
    issueId: lgbtqRights.id,
    organization: org(
      'Lambda Legal',
      'https://lambdalegal.org/',
      'Lambda Legal is a national organization working to achieve full recognition of the civil rights of LGBTQ+ people and everyone living with HIV through impact litigation, education, and public policy.',
    ),
    slug: 'challenge-idaho-bathroom-ban',
    type: 'Lawsuit',
    title: 'Follow the challenge to Idaho’s bathroom ban',
    detail: 'Track the lawsuit seeking to stop H.B. 752 from criminalizing transgender people for using public restrooms consistent with their gender identity.',
    description: '## About the case\n\nLambda Legal and the ACLU filed Jackson-Edney v. Labrador on behalf of six transgender Idaho residents challenging a state law that would ban restroom access consistent with gender identity in government buildings and many private businesses.\n\nIn June 2026 a federal court issued a partial preliminary injunction pausing parts of the law while the case continues, giving transgender people in Idaho safer restroom options without criminal penalty.\n\n## What you can do\n\nFollow the case page for injunction details and next steps as plaintiffs seek broader permanent relief.',
    effort: 'Follow case',
    href: 'https://lambdalegal.org/case/jackson-edney-v-labrador/',
    sortOrder: 3,
  },
  {
    issueId: lgbtqRights.id,
    organization: org(
      'Human Rights Campaign',
      'https://www.hrc.org/',
      'The Human Rights Campaign is the nation’s largest LGBTQ+ civil rights organization, working to elect pro-equality leaders and advance inclusive policies in schools, workplaces, healthcare, and communities.',
    ),
    slug: 'organize-lgbtq-healthcare-access',
    type: 'Campaign',
    title: 'Organize for LGBTQ+ healthcare access',
    detail: 'Join trainings, lobby days, and local outreach defending Medicaid, ACA coverage, and gender-affirming care.',
    description: '## The campaign\n\nHRC’s 100 Days of Healthcare campaign connects LGBTQ+ equality to everyday access: seeing a provider, keeping coverage, and protecting gender-affirming and HIV care.\n\nSupporters can attend advocacy trainings, lobby legislators, and engage local communities as federal and state attacks threaten public programs and nondiscrimination protections.\n\n## What you can do\n\nSign up through HRC’s campaign page to join trainings and lobby activities for LGBTQ+ healthcare.',
    effort: 'Volunteer',
    href: 'https://www.hrc.org/campaigns/100-days-of-healthcare',
    sortOrder: 4,
  },
  {
    issueId: lgbtqRights.id,
    organization: org(
      'PFLAG',
      'https://pflag.org/',
      'PFLAG is creating a caring, just, and affirming world for LGBTQ+ people and those who love them through family support, education, and advocacy.',
    ),
    slug: 'organize-pflag-votes-2026',
    type: 'Campaign',
    title: 'Organize with PFLAG Votes 2026',
    detail: 'Help families and allies register, educate neighbors, and turn out to vote through Election Day on November 3, 2026.',
    description: '## Turning Pride into Power\n\nPFLAG Votes 2026 mobilizes more than 360 chapters and hundreds of thousands of advocates to protect LGBTQ+ people and families at the ballot box.\n\nThe campaign provides voter education tools, Votes Together resources, town-hall toolkits, and organizing guides so parents, families, and allies can show up together through November.\n\n## What you can do\n\nVisit PFLAG Votes for registration tools, education resources, and ways to organize friends and local chapters to vote.',
    effort: 'Organize',
    href: 'https://pflag.org/pflagvotes/',
    sortOrder: 5,
  },
  {
    issueId: housingJustice.id,
    organization: org(
      'National Low Income Housing Coalition',
      'https://nlihc.org/',
      'The National Low Income Housing Coalition educates, organizes, and advocates to ensure decent, affordable housing for everyone, especially renters with the lowest incomes.',
    ),
    slug: 'expand-family-stability-opportunity-vouchers',
    type: 'Petition',
    title: 'Tell Congress to expand rental assistance',
    detail: 'Urge lawmakers to pass the Family Stability and Opportunity Vouchers Act and bridge the gap between incomes and housing costs.',
    description: '## Why this matters\n\nThere is not a single U.S. county where a full-time minimum-wage worker can afford a two-bedroom apartment. NLIHC is pushing Congress for large-scale investments that put rental assistance within reach of the lowest-income households.\n\nOne live ask is support for the Family Stability and Opportunity Vouchers Act, which would expand the availability of rental assistance.\n\n## What you can do\n\nUse NLIHC’s Take Action tools to contact your members of Congress and demand expanded rental assistance.',
    effort: '3 min',
    href: 'https://nlihc.org/take-action',
    sortOrder: 1,
  },
  {
    issueId: housingJustice.id,
    organization: org('American Civil Liberties Union'),
    slug: 'challenge-public-housing-surveillance',
    type: 'Lawsuit',
    title: 'Follow the challenge to public-housing surveillance',
    detail: 'Track a September 2026 class action against Concord Housing for installing in-apartment devices that logged tenants’ movement and sound.',
    description: '## About the case\n\nIn LaValley v. Concord Housing and Redevelopment Authority, tenants sued after the housing authority installed Minut Monitor devices that collected hundreds of millions of data points from inside apartments—including motion, noise levels, and patterns of daily life.\n\nThe ACLU, ACLU of New Hampshire, and New Hampshire Legal Assistance argue the non-consensual surveillance violates tenants’ privacy rights under the New Hampshire Constitution and seek to stop the practice.\n\n## What you can do\n\nFollow the case for filings and rulings that could set limits on surveillance inside publicly assisted homes.',
    effort: 'Follow case',
    href: 'https://www.aclu.org/cases/lavalley-v-concord-housing-and-redevelopment-authority',
    urgent: true,
    sortOrder: 2,
  },
  {
    issueId: housingJustice.id,
    organization: org(
      'National Housing Law Project',
      'https://www.nhlp.org/',
      'The National Housing Law Project advances housing justice by strengthening tenant rights, expanding housing opportunity, and preserving safe, affordable homes for low-income communities.',
    ),
    slug: 'defend-hud-30-day-eviction-notice',
    type: 'Campaign',
    title: 'Defend the HUD 30-day eviction notice rule',
    detail: 'Follow NHLP’s work after tenants blocked HUD’s interim rollback of the 30-day notice protection and as the agency still seeks a final rule.',
    description: '## What’s at stake\n\nHUD’s 2024 rule requires many public-housing and project-based rental assistance landlords to give tenants 30 days’ notice before filing a nonpayment eviction, plus a ledger and information about rent reductions.\n\nIn March 2026, tenants represented by NHLP forced HUD to indefinitely delay an interim final rule that would have stripped that protection without full notice-and-comment. HUD is still pursuing a final rule, and advocates say they will challenge any unlawful effort to make rapid evictions easier.\n\n## What you can do\n\nRead NHLP’s updates, share the stakes with your network, and stay ready to support comments or litigation if HUD finalizes a rollback.',
    effort: 'Follow & share',
    href: 'https://www.nhlp.org/tenants-and-housing-orgs-successfully-block-huds-unlawful-attempt-to-eliminate-protection-from-rapid-and-unfair-evictions/',
    sortOrder: 3,
  },
  {
    issueId: housingJustice.id,
    organization: org(
      'National Low Income Housing Coalition',
      'https://nlihc.org/',
      'The National Low Income Housing Coalition educates, organizes, and advocates to ensure decent, affordable housing for everyone, especially renters with the lowest incomes.',
    ),
    slug: 'join-national-housed-campaign',
    type: 'Campaign',
    title: 'Join the national HoUSed campaign',
    detail: 'Endorse and organize for fairness, supports, and supply reforms that secure affordable homes for the lowest-income renters.',
    description: '## The campaign\n\nNLIHC’s HoUSed campaign advances anti-racist housing policy through three pillars: fairness and tenant protections, income and rental supports, and large-scale affordable housing supply.\n\nOrganizations and individuals can endorse the campaign, join working groups and national calls, and use toolkits to push Congress for sustained investments.\n\n## What you can do\n\nVisit the HoUSed page to endorse, join working groups, and find current advocacy opportunities.',
    effort: 'Join campaign',
    href: 'https://nlihc.org/housed',
    sortOrder: 4,
  },
  {
    issueId: housingJustice.id,
    organization: org(
      'National Low Income Housing Coalition',
      'https://nlihc.org/',
      'The National Low Income Housing Coalition educates, organizes, and advocates to ensure decent, affordable housing for everyone, especially renters with the lowest incomes.',
    ),
    slug: 'enact-national-tenants-bill-of-rights',
    type: 'Petition',
    title: 'Urge Congress to enact a National Tenants Bill of Rights',
    detail: 'Tell lawmakers to establish baseline tenant rights to fair leases, habitability, reasonable costs, eviction safeguards, and the right to organize.',
    description: '## Why this matters\n\nThe National Tenants Bill of Rights would create a federal framework for renter protections, including fair applications and leases, freedom from discrimination and harassment, habitable homes, reasonable rent and costs, eviction safeguards, and the right to organize.\n\nNLIHC is asking Congress to strengthen and enforce renter protections as housing costs and displacement pressures intensify.\n\n## What you can do\n\nUse NLIHC’s Take Action page to contact Congress and endorse the National Tenants Bill of Rights.',
    effort: '3 min',
    href: 'https://nlihc.org/take-action',
    sortOrder: 5,
  },
  {
    issueId: disabilityRights.id,
    organization: org(
      'Disability Rights Education & Defense Fund',
      'https://dredf.org/',
      'The Disability Rights Education & Defense Fund advances the civil and human rights of people with disabilities through legal advocacy, training, education, and public policy and legislative development.',
    ),
    slug: 'defend-section-504-community-integration',
    type: 'Campaign',
    title: 'Defend Section 504 and community integration',
    detail: 'Contact governors and attorneys general to protect Section 504 and the right of people with disabilities to live in the community.',
    description: '## Why this matters\n\nDisability advocates are mobilizing to protect Section 504 and community integration after Texas v. Kennedy and related federal attacks on disability rights.\n\nDREDF’s Protect 504 campaign asks supporters to press state leaders to defend disability civil rights and reject policies that push people into institutions.\n\n## What you can do\n\nUse DREDF’s Protect 504 tools to contact governors and attorneys general and support community integration.',
    effort: '5 min',
    href: 'https://dredf.org/protect-504/',
    urgent: true,
    sortOrder: 1,
  },
  {
    issueId: disabilityRights.id,
    organization: org('American Civil Liberties Union'),
    slug: 'follow-simeone-v-multnomah-county',
    type: 'Lawsuit',
    title: 'Follow Simeone v. Multnomah County',
    detail: 'Track ACLU litigation challenging inaccessible emergency systems that leave people with disabilities without equal access to 911 and emergency alerts.',
    description: '## The case\n\nIn Simeone v. Multnomah County, the ACLU challenges emergency systems that fail to provide equal access for people who are Deaf, hard of hearing, or otherwise disabled.\n\nThe lawsuit was filed in July 2026 and seeks accessible emergency communications and accommodations.\n\n## What you can do\n\nFollow the ACLU case page for updates and related advocacy opportunities.',
    effort: 'Follow case',
    href: 'https://www.aclu.org/cases/simeone-v-multnomah-county',
    sortOrder: 2,
  },
  {
    issueId: disabilityRights.id,
    organization: org('American Civil Liberties Union'),
    slug: 'follow-lakrout-v-ny-court-system',
    type: 'Lawsuit',
    title: 'Follow Lakrout v. New York State Unified Court System',
    detail: 'Track the ACLU challenge to inaccessible jury service that excludes people with disabilities from equal participation in civic life.',
    description: '## The case\n\nLakrout v. New York State Unified Court System challenges barriers that prevent people with disabilities from serving on juries on equal terms.\n\nThe case was ongoing as of August 2026 and seeks systemic accessibility reforms in the court system.\n\n## What you can do\n\nFollow the ACLU case page for rulings, filings, and ways to support disability access to jury service.',
    effort: 'Follow case',
    href: 'https://www.aclu.org/cases/lakrout-v-new-york-state-unified-court-system',
    sortOrder: 3,
  },
  {
    issueId: disabilityRights.id,
    organization: org(
      'Autistic Self Advocacy Network',
      'https://autisticadvocacy.org/',
      'The Autistic Self Advocacy Network is a nonprofit organization run by and for autistic people that advances disability rights, community living, and self-determination.',
    ),
    slug: 'protect-disability-rights-community-living',
    type: 'Petition',
    title: 'Tell state leaders to protect disability rights and community living',
    detail: 'Urge governors and attorneys general to defend disability civil rights and community-based supports.',
    description: '## Why this matters\n\nASAN is calling on supporters to press state leaders to protect disability rights and community living amid federal rollbacks.\n\nThe campaign emphasizes that people with disabilities belong in their communities with the supports they need—not in institutions.\n\n## What you can do\n\nUse ASAN’s action page to contact state leaders and demand protection for disability rights and community living.',
    effort: '3 min',
    href: 'https://autisticadvocacy.org/2026/02/take-action-to-protect-disability-rights/',
    sortOrder: 4,
  },
  {
    issueId: disabilityRights.id,
    organization: org(
      'Center for Public Representation',
      'https://www.centerforpublicrep.org/',
      'The Center for Public Representation is a national legal advocacy organization that advances the rights of people with disabilities to live, work, and thrive in their communities.',
    ),
    slug: 'defend-community-integration-after-olc',
    type: 'Campaign',
    title: 'Join the fight for community integration',
    detail: 'Support advocacy against federal attacks on the right of people with disabilities to be integrated in their communities.',
    description: '## Why this matters\n\nAfter an OLC memo and Texas v. Kennedy developments threatened community integration, disability advocates—including the Center for Public Representation and the Defend Community Integration Coalition—called for sustained public pressure.\n\nCommunity integration is a core disability civil right under Olmstead and related federal protections.\n\n## What you can do\n\nRead CPR’s statement and coalition updates, then join Protect 504 and related advocacy to defend community living.',
    effort: 'Join campaign',
    href: 'https://www.centerforpublicrep.org/news/cpr-condemns-administration-attack-on-the-rights-of-individuals-with-disabilities-to-be-integrated-in-their-communities/',
    sortOrder: 5,
  },
  {
    issueId: workersRights.id,
    organization: org(
      'AFL-CIO',
      'https://aflcio.org/',
      'The AFL-CIO is the democratic, voluntary federation of 60 national and international labor unions that represent 12.5 million working people.',
    ),
    slug: 'pass-protect-americas-workforce-act',
    type: 'Petition',
    title: 'Tell the Senate to pass the Protect America’s Workforce Act',
    detail: 'Call on senators to discharge and pass H.R. 2550, restoring collective bargaining rights stripped by executive order.',
    description: '## Why this matters\n\nThe House already passed the Protect America’s Workforce Act (H.R. 2550) to reverse an executive order that stripped collective bargaining rights from nearly a million federal workers.\n\nThe AFL-CIO is urging the Senate to sign the discharge petition and pass the bill.\n\n## What you can do\n\nUse the AFL-CIO call campaign to contact your senators and demand they pass the Protect America’s Workforce Act.',
    effort: '5 min',
    href: 'https://act.aflcio.org/call_campaigns/call-sign-the-discharge-petition-and-pass-the-protect-americas-workforce-act',
    urgent: true,
    sortOrder: 1,
  },
  {
    issueId: workersRights.id,
    organization: org(
      'AFL-CIO',
      'https://aflcio.org/',
      'The AFL-CIO is the democratic, voluntary federation of 60 national and international labor unions that represent 12.5 million working people.',
    ),
    slug: 'follow-aflcio-v-trump-bargaining-rights',
    type: 'Lawsuit',
    title: 'Follow the challenge to the federal bargaining-rights executive order',
    detail: 'Track AFL-CIO and union litigation challenging the executive order that excluded federal workers from collective bargaining.',
    description: '## The case\n\nUnions including the AFL-CIO challenged Executive Order 14251, which sought to strip collective bargaining rights from hundreds of thousands of federal workers under a purported national-security exclusion.\n\nCourts have issued favorable rulings restoring contracts while litigation continues, and the labor movement is also pressing Congress to reverse the order by statute.\n\n## What you can do\n\nFollow AFL-CIO updates on the lawsuit and related advocacy, and support the Protect America’s Workforce Act campaign.',
    effort: 'Follow case',
    href: 'https://aflcio.org/press/releases/afl-cio-one-year-trumps-union-busting-executive-order',
    sortOrder: 2,
  },
  {
    issueId: workersRights.id,
    organization: org(
      'National Domestic Workers Alliance',
      'https://www.domesticworkers.org/',
      'The National Domestic Workers Alliance works to win respect, recognition, and labor protections for the millions of nannies, house cleaners, and care workers who make all other work possible.',
    ),
    slug: 'pass-fair-wages-for-home-care-workers-act',
    type: 'Petition',
    title: 'Tell Congress to pass the Fair Wages for Home Care Workers Act',
    detail: 'Urge lawmakers to protect overtime and fair wages for home care workers.',
    description: '## Why this matters\n\nHome care workers—disproportionately women of color—are essential to aging and disability care, yet face wage theft and carve-outs from basic labor protections.\n\nNDWA is asking Congress to pass the Fair Wages for Home Care Workers Act to protect fair pay.\n\n## What you can do\n\nUse NDWA’s action form to tell Congress to protect fair wages for home care workers.',
    effort: '3 min',
    href: 'https://www.domesticworkers.org/take-action/tell-congress-now-protect-fair-wages-for-home-care-workers/',
    sortOrder: 3,
  },
  {
    issueId: workersRights.id,
    organization: org(
      'National Employment Law Project',
      'https://www.nelp.org/',
      'The National Employment Law Project is a nonprofit research and advocacy organization that fights for policies that create good jobs, expand workers’ rights, and build worker power.',
    ),
    slug: 'oppose-dol-contractor-joint-employer-rollbacks',
    type: 'Campaign',
    title: 'Oppose DOL rollbacks on contractors and joint employers',
    detail: 'Support NELP’s opposition to Department of Labor rules that reclassify employees as independent contractors and shrink joint-employer liability.',
    description: '## Why this matters\n\nThe Department of Labor has proposed rules that would make it easier for employers to misclassify workers as independent contractors and weaken joint-employer accountability.\n\nNELP warns these rollbacks would strip wage, overtime, and organizing protections from millions of workers.\n\n## What you can do\n\nRead NELP’s analyses, amplify opposition, and follow their advocacy against the independent contractor and joint-employer proposals.',
    effort: 'Join campaign',
    href: 'https://www.nelp.org/nelp-slams-trump-dols-independent-contractor-rule/',
    sortOrder: 4,
  },
  {
    issueId: workersRights.id,
    organization: org(
      'National Domestic Workers Alliance',
      'https://www.domesticworkers.org/',
      'The National Domestic Workers Alliance works to win respect, recognition, and labor protections for the millions of nannies, house cleaners, and care workers who make all other work possible.',
    ),
    slug: 'stop-dol-companionship-rule-rollback',
    type: 'Campaign',
    title: 'Stop the DOL companionship-rule rollback',
    detail: 'Oppose the Department of Labor proposal that would strip overtime protections from home care workers.',
    description: '## Why this matters\n\nA Department of Labor rollback of companionship-exemption rules would gut overtime and wage protections for home care workers who support older adults and people with disabilities.\n\nNDWA is organizing against the rollback as part of its Care Is Essential campaign.\n\n## What you can do\n\nVisit NDWA’s campaign page to learn more and take action to protect home care worker wages.',
    effort: 'Join campaign',
    href: 'https://www.domesticworkers.org/care-is-essential/protect-home-care-workers-wages-ndwa-opposes-dol-rollback/',
    sortOrder: 5,
  },
  {
    issueId: gunViolence.id,
    organization: org(
      'Everytown for Gun Safety',
      'https://www.everytown.org/',
      'Everytown for Gun Safety is a gun violence prevention organization working to end gun violence and save lives through advocacy, research, and community organizing.',
    ),
    slug: 'pledge-end-gun-violence-2026',
    type: 'Petition',
    title: 'Pledge to fight gun violence in 2026',
    detail: 'Sign Everytown’s 2026 pledge to support gun violence prevention and stay engaged in advocacy.',
    description: '## Why this matters\n\nEverytown is mobilizing supporters for 2026 advocacy with a public pledge to end gun violence through elections, legislation, and community action.\n\nSigning keeps you connected to campaigns against gun violence and industry accountability.\n\n## What you can do\n\nSign the Make the Pledge for 2026 petition and follow Everytown’s calls to action.',
    effort: '2 min',
    href: 'https://act.everytown.org/sign/end_gun_violence_petition_2026',
    urgent: true,
    sortOrder: 1,
  },
  {
    issueId: gunViolence.id,
    organization: org(
      'Everytown Law',
      'https://everytownlaw.org/',
      'Everytown Law is the litigation arm of Everytown for Gun Safety, bringing lawsuits that hold the gun industry and other actors accountable for gun violence.',
    ),
    slug: 'follow-uvalde-daniel-defense-lawsuit',
    type: 'Lawsuit',
    title: 'Follow the Uvalde families’ case against Daniel Defense',
    detail: 'Track Everytown Law litigation holding the gunmaker, dealer, and law enforcement accountable for the Robb Elementary massacre.',
    description: '## The case\n\nEverytown Law represents Uvalde families suing Daniel Defense, the gun dealer, and law enforcement over the May 2022 Robb Elementary shooting.\n\nThe cases allege illegal and irresponsible marketing and sales practices, plus law-enforcement failures that left children and teachers unprotected.\n\n## What you can do\n\nFollow Everytown Law’s case page for filings, rulings, and updates on gun-industry accountability.',
    effort: 'Follow case',
    href: 'https://everytownlaw.org/case/uvalde-victims-sue-gunmaker-gun-store-and-law-enforcement/',
    sortOrder: 2,
  },
  {
    issueId: gunViolence.id,
    organization: org(
      'Everytown Law',
      'https://everytownlaw.org/',
      'Everytown Law is the litigation arm of Everytown for Gun Safety, bringing lawsuits that hold the gun industry and other actors accountable for gun violence.',
    ),
    slug: 'follow-highland-park-smith-wesson-lawsuit',
    type: 'Lawsuit',
    title: 'Follow the Highland Park survivors’ case against Smith & Wesson',
    detail: 'Track Everytown Law litigation alleging deceptive marketing and illegal sales tied to the July 4 Highland Park shooting.',
    description: '## The case\n\nEverytown Law and co-counsel represent Highland Park survivors and families suing Smith & Wesson and gun retailers over the July 4, 2022 mass shooting.\n\nThe cases challenge deceptive “Military and Police” marketing and sales that allegedly violated local assault-weapons bans.\n\n## What you can do\n\nFollow Everytown Law’s case page for updates as interlocutory appeals and manufacturer liability issues proceed.',
    effort: 'Follow case',
    href: 'https://everytownlaw.org/case/highland-park-july-4th-shooting-survivors-sue-smith-wesson-gun-retailers-shooter-and-his-father/',
    sortOrder: 3,
  },
  {
    issueId: gunViolence.id,
    organization: org(
      'GIFFORDS',
      'https://giffords.org/',
      'GIFFORDS is a gun safety organization founded by former Congresswoman Gabby Giffords that fights gun violence through legislation, litigation, and community engagement.',
    ),
    slug: 'support-gun-industry-accountability-litigation',
    type: 'Campaign',
    title: 'Support gun-industry accountability litigation',
    detail: 'Track GIFFORDS Law Center and Everytown Law cases holding gunmakers and dealers accountable, including Glock/switch and PLCAA challenges.',
    description: '## Why this matters\n\nGIFFORDS Law Center and Everytown Law launched a gun-industry accountability litigation tracker highlighting cases that survived PLCAA defenses and challenged unsafe industry practices.\n\nSupporting this work helps expand legal pathways to reduce gun violence beyond legislation alone.\n\n## What you can do\n\nRead the litigation tracker announcement and GIFFORDS Law Center’s accountability work, then stay engaged with local and national advocacy.',
    effort: 'Join campaign',
    href: 'https://giffords.org/press-release/2026/07/giffords-law-center-and-everytown-law-unveil-gun-industry-accountability-litigation-tracker/',
    sortOrder: 4,
  },
  {
    issueId: gunViolence.id,
    organization: org(
      'Moms Demand Action',
      'https://www.momsdemandaction.org/',
      'Moms Demand Action is a grassroots movement of Americans fighting for public safety measures that protect people from gun violence.',
    ),
    slug: 'join-moms-demand-action-local-organizing',
    type: 'Campaign',
    title: 'Join Moms Demand Action local organizing',
    detail: 'Volunteer with a local Moms Demand Action chapter to support gun safety laws, elections, and community education.',
    description: '## Why this matters\n\nMoms Demand Action organizes volunteers in every state to pass gun safety laws, elect leaders who prioritize public safety, and support survivors of gun violence.\n\nLocal chapters run canvasses, phone banks, school safety work, and legislative campaigns year-round.\n\n## What you can do\n\nVisit Moms Demand Action to find your local group, sign up to volunteer, and get involved in current campaigns.',
    effort: 'Join campaign',
    href: 'https://www.momsdemandaction.org/',
    sortOrder: 5,
  },
  {
    issueId: indigenousRights.id,
    organization: org(
      'Apache Stronghold',
      'https://www.apache-stronghold.com/',
      'Apache Stronghold is a coalition of Apaches, other Native peoples, and non-Native allies fighting to protect Oak Flat, a sacred Western Apache site threatened by copper mining.',
    ),
    slug: 'protect-sacred-oak-flat',
    type: 'Petition',
    title: 'Protect sacred Oak Flat from Resolution Copper',
    detail: 'Sign petitions and contact Congress to reverse the Oak Flat land transfer and stop a mine that would destroy Apache religious practices forever.',
    description: '## Why this matters\n\nOak Flat (Chi’chil Biłdagoteel) is a sacred Western Apache site where coming-of-age ceremonies, prayer, and gathering of sacred medicines have taken place for generations.\n\nAfter Congress ordered a land transfer to Resolution Copper, the federal government moved the site toward irreversible mining destruction. Apache Stronghold continues petitions, congressional outreach, and faith-leader organizing to save it.\n\n## What you can do\n\nUse Apache Stronghold’s Take Action page to sign petitions, message Congress, and support the campaign to protect Oak Flat.',
    effort: '5 min',
    href: 'https://www.apache-stronghold.com/take-action',
    urgent: true,
    sortOrder: 1,
  },
  {
    issueId: indigenousRights.id,
    organization: org(
      'Apache Stronghold',
      'https://www.apache-stronghold.com/',
      'Apache Stronghold is a coalition of Apaches, other Native peoples, and non-Native allies fighting to protect Oak Flat, a sacred Western Apache site threatened by copper mining.',
    ),
    slug: 'follow-apache-stronghold-v-united-states',
    type: 'Lawsuit',
    title: 'Follow Apache Stronghold v. United States',
    detail: 'Track litigation seeking to unwind the Oak Flat land transfer and stop Resolution Copper from destroying the sacred site.',
    description: '## The case\n\nApache Stronghold is challenging the government’s transfer of Oak Flat to Resolution Copper, arguing the transfer violates religious freedom protections and treaty obligations.\n\nAfter Supreme Court denials of emergency relief, the coalition returned to district court in 2026 seeking to reverse the overnight land swap before mining permanently destroys the site.\n\n## What you can do\n\nFollow Becket’s case page for filings, rulings, and updates on the fight to save Oak Flat.',
    effort: 'Follow case',
    href: 'https://becketfund.org/case/apache-stronghold-v-united-states/',
    sortOrder: 2,
  },
  {
    issueId: indigenousRights.id,
    organization: org(
      'NDN Collective',
      'https://ndncollective.org/',
      'NDN Collective is an Indigenous-led organization dedicated to building Indigenous power through organizing, activism, philanthropy, and narrative change.',
    ),
    slug: 'follow-craven-canyon-uranium-lawsuit',
    type: 'Lawsuit',
    title: 'Follow the Craven Canyon uranium drilling lawsuit',
    detail: 'Track community litigation challenging uranium exploration near Craven Canyon and sacred Black Hills sites.',
    description: '## The case\n\nCommunity members and Craven Canyon intervenors sued the South Dakota Board of Minerals and Environment over due-process failures around the Chord Project uranium hearing.\n\nThe proposed drilling threatens groundwater and sacred Lakota ceremonial lands, including petroglyph sites near Craven Canyon.\n\n## What you can do\n\nFollow NDN Collective’s updates on the lawsuit and related Black Hills land-defense organizing.',
    effort: 'Follow case',
    href: 'https://ndncollective.org/craven-canyon-drilling-permit-on-pause-community-members-file-federal-lawsuit-against-sd-board-of-minerals-and-environment/',
    sortOrder: 3,
  },
  {
    issueId: indigenousRights.id,
    organization: org(
      'American Indian College Fund',
      'https://collegefund.org/',
      'The American Indian College Fund invests in Native students and tribal college education while advocating for policies that protect Native communities and voting access.',
    ),
    slug: 'oppose-save-america-act-native-voters',
    type: 'Petition',
    title: 'Tell the Senate to reject the SAVE America Act',
    detail: 'Urge senators to oppose proof-of-citizenship and in-person registration rules that would disproportionately block Native voters.',
    description: '## Why this matters\n\nThe SAVE Act and SAVE America Act would require documentary proof of citizenship and in-person steps that eliminate mail and online registration pathways Native voters rely on.\n\nNARF and the Campaign Legal Center warn Tribal IDs often lack the birthplace or expiration data these bills demand, creating barriers for eligible citizens on Tribal lands.\n\n## What you can do\n\nUse the American Indian College Fund’s call script and contacts to tell your senators to vote no on the SAVE America Act.',
    effort: '5 min',
    href: 'https://collegefund.org/blog/advocacy/get-involved/help-the-college-fund-protect-voters-and-oppose-the-save-america-act/',
    sortOrder: 4,
  },
  {
    issueId: indigenousRights.id,
    organization: org(
      'NDN Collective',
      'https://ndncollective.org/',
      'NDN Collective is an Indigenous-led organization dedicated to building Indigenous power through organizing, activism, philanthropy, and narrative change.',
    ),
    slug: 'join-landback-action-network',
    type: 'Campaign',
    title: 'Join LANDBACK organizing',
    detail: 'Connect with Indigenous organizers through the LANDBACK Action Network and landback.org calls to action.',
    description: '## Why this matters\n\nNDN Collective launched the LANDBACK Action Network to connect Indigenous organizers, Tribal Nations, and allies working on land return, food sovereignty, language restoration, and ecological defense.\n\nlandback.org shares storytelling, resources, and current calls to action across Turtle Island and beyond.\n\n## What you can do\n\nExplore the LANDBACK Action Network announcement and landback.org to find organizing opportunities and stay connected to the movement.',
    effort: 'Join campaign',
    href: 'https://ndncollective.org/ndn-collective-launches-landback-action-network/',
    sortOrder: 5,
  },
  {
    issueId: digitalRights.id,
    organization: org(
      'Fight for the Future',
      'https://www.fightforthefuture.org/',
      'Fight for the Future is a digital rights advocacy group that organizes people to defend free expression, privacy, and an open internet.',
    ),
    slug: 'stop-kosa-censorship-bill',
    type: 'Petition',
    title: 'Tell Congress to reject KOSA',
    detail: 'Urge lawmakers to oppose the Kids Online Safety Act’s duty-of-care model that would drive age verification and censorship of LGBTQ+ and reproductive-health content.',
    description: '## Why this matters\n\nThe Kids Online Safety Act would pressure platforms to filter content under a vague “duty of care,” incentivizing age verification and overbroad censorship.\n\nCivil rights and LGBTQ+ groups warn the bill would cut young people off from lifesaving information while expanding surveillance of all users. The Senate Commerce Committee advanced an amended version in August 2026.\n\n## What you can do\n\nUse Fight for the Future’s Stop KOSA action to email and call Congress and demand they reject the bill.',
    effort: '3 min',
    href: 'https://www.fightforthefuture.org/actions/stop-kosa',
    urgent: true,
    sortOrder: 1,
  },
  {
    issueId: digitalRights.id,
    organization: org(
      'Electronic Frontier Foundation',
      'https://www.eff.org/',
      'The Electronic Frontier Foundation defends civil liberties in the digital world through litigation, policy advocacy, and technology.',
    ),
    slug: 'follow-siren-v-san-jose-alpr',
    type: 'Lawsuit',
    title: 'Follow SIREN and CAIR-CA v. San Jose',
    detail: 'Track EFF and ACLU litigation challenging warrantless police searches of San Jose’s automated license-plate reader database.',
    description: '## The case\n\nEFF and the ACLU of Northern California represent SIREN and CAIR-CA in a challenge to San Jose’s practice of letting officers search a massive ALPR location database without a warrant.\n\nThe lawsuit argues warrantless queries of year-long location histories violate the California Constitution’s privacy and search protections.\n\n## What you can do\n\nFollow EFF’s case page for filings, rulings, and updates on ALPR surveillance litigation.',
    effort: 'Follow case',
    href: 'https://www.eff.org/cases/siren-v-san-jose',
    sortOrder: 2,
  },
  {
    issueId: digitalRights.id,
    organization: org(
      'Electronic Frontier Foundation',
      'https://www.eff.org/',
      'The Electronic Frontier Foundation defends civil liberties in the digital world through litigation, policy advocacy, and technology.',
    ),
    slug: 'follow-eff-v-dhs-ice-subpoenas',
    type: 'Lawsuit',
    title: 'Follow EFF v. DHS and ICE on administrative subpoenas',
    detail: 'Track EFF’s FOIA lawsuit seeking records on ICE and DHS subpoenas used to unmask online critics of immigration enforcement.',
    description: '## The case\n\nEFF sued DHS and ICE for records about administrative subpoenas demanding identifying information from platforms for accounts that criticized or monitored immigration enforcement.\n\nThe agencies have withdrawn subpoenas when challenged in court, avoiding rulings on legality while chilling online speech.\n\n## What you can do\n\nFollow EFF’s case page for FOIA developments and related advocacy pressing companies to notify users and resist unlawful demands.',
    effort: 'Follow case',
    href: 'https://www.eff.org/cases/eff-v-dhs-ice-administrative-subpoenas',
    sortOrder: 3,
  },
  {
    issueId: digitalRights.id,
    organization: org(
      'Electronic Privacy Information Center',
      'https://epic.org/',
      'The Electronic Privacy Information Center is a public-interest research center focused on privacy, open government, and civil liberties in the information age.',
    ),
    slug: 'follow-epic-v-mullin-protester-surveillance',
    type: 'Lawsuit',
    title: 'Follow EPIC v. Mullin on protester surveillance',
    detail: 'Track EPIC’s challenge to DHS’s secret policy of collecting and retaining records of First Amendment protest and legal-observation activity.',
    description: '## The case\n\nIn July 2026, EPIC and legal observers sued DHS over a Protester Surveillance Policy that allegedly records names, photos, locations, and other details of people observing or protesting immigration enforcement.\n\nThe suit argues the policy violates the Privacy Act’s ban on maintaining records describing how people exercise First Amendment rights.\n\n## What you can do\n\nFollow EPIC’s case page for filings and updates, and support broader campaigns against the surveillance state.',
    effort: 'Follow case',
    href: 'https://epic.org/documents/epic-v-mullin/',
    sortOrder: 4,
  },
  {
    issueId: digitalRights.id,
    organization: org(
      'Electronic Frontier Foundation',
      'https://www.eff.org/',
      'The Electronic Frontier Foundation defends civil liberties in the digital world through litigation, policy advocacy, and technology.',
    ),
    slug: 'support-alpr-surveillance-restrictions',
    type: 'Campaign',
    title: 'Support ALPR surveillance restrictions',
    detail: 'Back EFF’s push to eliminate automated license-plate reader dragnets and win warrant, retention, and sharing limits in cities and states.',
    description: '## Why this matters\n\nALPRs blanketing roads create year-long location histories that police can search without warrants, chilling travel to clinics, mosques, protests, and everyday destinations.\n\nEFF’s integrated advocacy combines litigation, city contract fights, and state legislation to eliminate ALPR dragnets or tightly constrain their use.\n\n## What you can do\n\nRead EFF’s ALPR policy position and follow local campaigns to reject Flock-style contracts and demand warrant requirements.',
    effort: 'Join campaign',
    href: 'https://www.eff.org/deeplinks/2026/08/effs-policy-position-alpr-surveillance-eliminate-it-and-reduce-its-harms',
    sortOrder: 5,
  },
  {
    issueId: educationEquity.id,
    organization: org(
      'National Education Association',
      'https://www.nea.org/',
      'The National Education Association is the nation’s largest labor union and professional association for educators, advocating for students and public schools.',
    ),
    slug: 'oppose-fy27-education-funding-cuts',
    type: 'Petition',
    title: 'Tell Congress to reject FY27 education funding cuts',
    detail: 'Urge lawmakers to oppose the House bill that would slash Title I by nearly $2 billion and eliminate teacher-training and community-school supports.',
    description: '## Why this matters\n\nThe House FY27 Labor-HHS-Education appropriations bill would cut education funding by about 10 percent, including nearly $2 billion from Title I.\n\nNEA warns the proposal would end teacher-training and full-service community school supports while making college less affordable for students who need aid most.\n\n## What you can do\n\nUse NEA’s action center to tell Congress to reject the cuts and invest in every student’s success.',
    effort: '3 min',
    href: 'https://www.nea.org/advocating-for-change/action-center/take-action/oppose-education-funding-cuts',
    urgent: true,
    sortOrder: 1,
  },
  {
    issueId: educationEquity.id,
    organization: org(
      'National Education Association',
      'https://www.nea.org/',
      'The National Education Association is the nation’s largest labor union and professional association for educators, advocating for students and public schools.',
    ),
    slug: 'follow-nea-ed-dismantling-lawsuit',
    type: 'Lawsuit',
    title: 'Follow the challenge to dismantling the Department of Education',
    detail: 'Track the NEA–NAACP coalition lawsuit seeking to stop executive actions that gut ED staffing, grants, and congressionally mandated programs.',
    description: '## The case\n\nNEA, the NAACP, parents, and allied unions sued to stop the administration from dismantling the Department of Education through mass layoffs, grant cancellations, and transfers of statutory programs without Congress.\n\nA Maryland federal court denied the government’s motion to dismiss on May 8, 2026, allowing the constitutional and APA claims to proceed.\n\n## What you can do\n\nFollow the case updates and support related advocacy to keep Title I, IDEA, civil-rights enforcement, and student-aid programs intact.',
    effort: 'Follow case',
    href: 'https://www.cohenmilstein.com/case-study/62911-2/',
    sortOrder: 2,
  },
  {
    issueId: educationEquity.id,
    organization: org(
      'NAACP Legal Defense Fund',
      'https://www.naacpldf.org/',
      'The NAACP Legal Defense Fund is America’s premier legal organization fighting for racial justice through litigation, advocacy, and public education.',
    ),
    slug: 'follow-ldf-ies-nces-data-lawsuit',
    type: 'Lawsuit',
    title: 'Follow the IES and NCES education-data lawsuit',
    detail: 'Track LDF litigation for education researchers challenging the Department’s dismantling of federal equity data collection and analysis.',
    description: '## The case\n\nLDF represents the National Academy of Education and the National Council on Measurement in Education in a suit challenging the Department of Education’s gutting of IES and NCES staffing, contracts, and datasets.\n\nWithout those systems, researchers cannot track outcomes for Black, Indigenous, Latino, disabled, multilingual, and low-income students as Congress required under the Education Sciences Reform Act.\n\n## What you can do\n\nFollow LDF’s case announcement and related advocacy to restore independent federal education data.',
    effort: 'Follow case',
    href: 'https://www.naacpldf.org/press-release/ldf-sues-u-s-department-of-education-on-behalf-of-education-research-organizations-over-discontinuation-of-critical-demographic-data-collection/',
    sortOrder: 3,
  },
  {
    issueId: educationEquity.id,
    organization: org(
      'National Education Association',
      'https://www.nea.org/',
      'The National Education Association is the nation’s largest labor union and professional association for educators, advocating for students and public schools.',
    ),
    slug: 'fully-fund-idea-and-title-i',
    type: 'Petition',
    title: 'Tell Congress to fully fund IDEA and Title I',
    detail: 'Ask lawmakers to cosponsor the Keep Our PACT Act and put IDEA and Title I on a mandatory path to full funding.',
    description: '## Why this matters\n\nCongress promised to cover 40 percent of special-education excess costs under IDEA but now funds less than 12 percent, shifting costs to states and districts.\n\nTitle I remains essential for high-poverty schools. The Keep Our PACT Act would create a 10-year mandatory path to fully fund both programs.\n\n## What you can do\n\nUse NEA’s action page to email Congress and urge cosponsorship of the Keep Our PACT Act.',
    effort: '3 min',
    href: 'https://www.nea.org/advocating-for-change/action-center/take-action/fully-fund-idea-title-i',
    sortOrder: 4,
  },
  {
    issueId: educationEquity.id,
    organization: org(
      'EdTrust',
      'https://edtrust.org/',
      'EdTrust advances policies and practices that dismantle racial and economic barriers in education from preschool through college.',
    ),
    slug: 'oppose-ed-program-transfer-bills',
    type: 'Campaign',
    title: 'Oppose bills that rubber-stamp transferring ED programs',
    detail: 'Support EdTrust’s FY27 appropriations fight and the 95-organization coalition opposing legislation that would cover for dismantling the Department of Education.',
    description: '## Why this matters\n\nEdTrust is urging Congress to increase Title I-A, protect Pell, and bar interagency agreements that transfer Department of Education responsibilities without statutory authority.\n\nA coalition of 95 education, civil-rights, and disability groups also opposes House bills that would rubber-stamp the administration’s dismantling of ED programs.\n\n## What you can do\n\nRead EdTrust’s FY27 priorities and coalition statement, then press Congress to invest in students instead of dissolving the agency that enforces education equity.',
    effort: 'Join campaign',
    href: 'https://edtrust.org/press-room/edtrust-national-edtrust-state-offices-and-state-coalition-partners-fy27-labor-health-and-human-services-education-and-related-agencies-appropriations-priorities/',
    sortOrder: 5,
  },
] : [];

const existingOrganizations = await db.select({ id: orgs.id, slug: orgs.slug, name: orgs.name }).from(orgs);
const organizationsByName = new Map(existingOrganizations.map((organization) => [organization.name, organization]));
const organizationsByKey = new Map(existingOrganizations.map((organization) => [organizationKey(organization.name), organization]));
const usedOrganizationSlugs = new Set(existingOrganizations.map((organization) => organization.slug));

for (const action of seedActions) {
  const organizationName = supportersName(action.organization.name);
  const organizationUpdate = {
    updatedAt: new Date(),
    ...(action.organization.website ? { website: action.organization.website } : {}),
    ...(action.organization.description ? { description: action.organization.description } : {}),
  };

  let organization = organizationsByName.get(organizationName) ?? organizationsByKey.get(organizationKey(organizationName));
  if (organization) {
    await db.update(orgs).set(organizationUpdate).where(inArray(orgs.id, [organization.id]));
  } else {
    [organization] = await db.insert(orgs).values({
      name: organizationName,
      slug: uniqueSeedOrganizationSlug(organizationName, usedOrganizationSlugs),
      ...(action.organization.website ? { website: action.organization.website } : {}),
      ...(action.organization.description ? { description: action.organization.description } : {}),
    }).returning({ id: orgs.id, slug: orgs.slug, name: orgs.name });
    organizationsByName.set(organization.name, organization);
    organizationsByKey.set(organizationKey(organization.name), organization);
  }

  const values: typeof actions.$inferInsert = {
    issueId: action.issueId,
    orgId: organization.id,
    automaticallyAdded: true,
    slug: action.slug,
    type: action.type,
    title: action.title,
    detail: action.detail,
    description: action.description,
    effort: action.effort,
    href: action.href,
    urgent: action.urgent ?? false,
    sortOrder: action.sortOrder,
    approved: true,
    published: true,
    verified: true,
    verifiedAt: new Date('2026-09-04T00:00:00Z'),
  };

  await db.insert(actions).values(values).onConflictDoUpdate({
    target: [actions.issueId, actions.slug],
    set: { ...values, updatedAt: new Date() },
  });
}

const [{ issueCount }] = await db.select({ issueCount: count() }).from(issues);
const [{ actionCount }] = await db.select({ actionCount: count() }).from(actions);
console.log(`Neon migration complete. Database contains ${issueCount} issues and ${actionCount} actions.`);
