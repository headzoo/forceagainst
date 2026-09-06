import { neon } from '@neondatabase/serverless';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { issues } from '../db/schema';

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

const contactCongress = `- Call the U.S. Capitol Switchboard at **202-224-3121** and ask for your representative or senators.
- Write to **The Honorable [Name], U.S. House of Representatives, Washington, DC 20515**, or **The Honorable [Name], United States Senate, Washington, DC 20510**. Include your return address and a specific request.`;

const sidebarBySlug: Record<string, string> = {
  voting: `**What you can do**

- Check your registration, learn the rules in your state, and help friends make a voting plan.
- Volunteer as a poll worker or with a nonpartisan voter-protection team.
- Ask lawmakers to protect ballot access, fair maps, accessible polling places, and trustworthy election administration.

**Who to contact**

${contactCongress}
- Report possible federal voting-rights violations to the **U.S. Department of Justice Voting Section** at **800-253-3931** or write to **Voting Section, Civil Rights Division, U.S. Department of Justice, 950 Pennsylvania Avenue NW, Washington, DC 20530**.

**More places to start**

- [Vote.gov](https://vote.gov/)
- [Election Protection](https://866ourvote.org/)
- [League of Women Voters](https://www.lwv.org/)`,

  'criminal-justice': `**What you can do**

- Support local bail funds, public defenders, reentry programs, and groups led by formerly incarcerated people.
- Attend city or county meetings where jail contracts, police budgets, and oversight policies are decided.
- Ask lawmakers to end wealth-based detention, protect due process, review extreme sentences, and fund conviction-integrity work.

**Who to contact**

${contactCongress}
- Report possible civil-rights violations involving law enforcement or incarceration to the **U.S. Department of Justice Civil Rights Division** at **855-856-1247** or write to **950 Pennsylvania Avenue NW, Washington, DC 20530-0001**.

**More places to start**

- [ACLU Criminal Law Reform](https://www.aclu.org/issues/criminal-law-reform)
- [Innocence Project](https://innocenceproject.org/)
- [The Bail Project](https://bailproject.org/)`,

  'bodily-autonomy': `**What you can do**

- Donate to or volunteer with an abortion fund that serves your region.
- Share verified clinic and legal information instead of unconfirmed social-media posts.
- Ask state and federal lawmakers to protect abortion, contraception, emergency care, patient privacy, and the people who provide care.

**Who to contact**

${contactCongress}
- For confidential questions about U.S. abortion, pregnancy-loss, or birth law, call the **Repro Legal Helpline** at **844-868-2812**. This is legal information, not medical advice.

**More places to start**

- [AbortionFinder](https://www.abortionfinder.org/)
- [National Network of Abortion Funds](https://abortionfunds.org/find-a-fund/)
- [Repro Legal Helpline](https://reprolegalhelpline.org/)`,

  'climate-change': `**What you can do**

- Join a local campaign focused on clean air, water, transit, housing, energy, or resilience.
- Comment on permits and public rules that affect pollution in your community.
- Support frontline and Indigenous-led groups, reduce household emissions where practical, and press institutions to make larger changes.

**Who to contact**

${contactCongress}
- Contact the **U.S. Environmental Protection Agency** at **202-564-4700** or write to **Environmental Protection Agency, 1200 Pennsylvania Avenue NW, Washington, DC 20460**. EPA also lists regional offices for local concerns.

**More places to start**

- [EPA Environmental Justice](https://www.epa.gov/environmentaljustice)
- [Earthjustice](https://earthjustice.org/)
- [Center for Biological Diversity](https://www.biologicaldiversity.org/)`,

  immigration: `**What you can do**

- Volunteer with a reputable legal-services, language-access, mutual-aid, or accompaniment program.
- Learn and share know-your-rights materials from established legal organizations.
- Ask lawmakers to protect due process, humane conditions, family unity, legal representation, and a workable path to citizenship.

**Who to contact**

${contactCongress}
- For an existing USCIS matter, call the **USCIS Contact Center** at **800-375-5283**. For immigration-court help, use the Justice Department’s location-based list of pro bono providers rather than relying on a notario or unverified adviser.

**More places to start**

- [EOIR list of pro bono legal-service providers](https://www.justice.gov/eoir/list-pro-bono-legal-service-providers)
- [National Immigration Law Center](https://www.nilc.org/)
- [USCIS Contact Center](https://www.uscis.gov/contactcenter)`,

  lgbtq: `**What you can do**

- Support local LGBTQ+ centers, affirming healthcare providers, youth programs, and legal-aid organizations.
- Show up at school-board, city-council, and state-legislative meetings where access and nondiscrimination rules are decided.
- Ask lawmakers to protect equal treatment, appropriate healthcare, safe schools, identity documents, and public accommodations.

**Who to contact**

${contactCongress}
- Report possible federal discrimination to the **U.S. Department of Justice Civil Rights Division** at **855-856-1247** or write to **950 Pennsylvania Avenue NW, Washington, DC 20530-0001**.

**More places to start**

- [Human Rights Campaign](https://www.hrc.org/)
- [PFLAG](https://pflag.org/)
- [Lambda Legal](https://lambdalegal.org/)`,

  'racial-justice': `**What you can do**

- Follow the priorities of organizations led by communities experiencing discrimination.
- Document and report discrimination, support civil-rights litigation, and attend local meetings on schools, policing, housing, health, and language access.
- Ask public officials for measurable enforcement, transparent data, and remedies shaped by affected communities.

**Who to contact**

${contactCongress}
- Report possible federal civil-rights violations to the **U.S. Department of Justice Civil Rights Division** at **855-856-1247** or write to **950 Pennsylvania Avenue NW, Washington, DC 20530-0001**.

**More places to start**

- [NAACP Legal Defense Fund](https://www.naacpldf.org/)
- [ACLU Racial Justice Program](https://www.aclu.org/issues/racial-justice)
- [DOJ Civil Rights reporting portal](https://civilrights.justice.gov/)`,

  'housing-justice': `**What you can do**

- Connect with a local tenant union, legal-aid office, fair-housing group, or homelessness-prevention program before a crisis escalates.
- Attend local hearings on zoning, public housing, rental assistance, eviction rules, and tenant protections.
- Ask lawmakers to expand deeply affordable housing and rental aid while protecting tenants from discrimination, retaliation, and invasive surveillance.

**Who to contact**

${contactCongress}
- Report housing discrimination to **HUD’s Office of Fair Housing and Equal Opportunity** at **800-669-9777** or write to **U.S. Department of Housing and Urban Development, 451 7th Street SW, Washington, DC 20410**.

**More places to start**

- [HUD housing-discrimination help](https://www.hud.gov/contactus/file-complaint)
- [National Low Income Housing Coalition](https://nlihc.org/)
- [National Housing Law Project](https://www.nhlp.org/)`,

  'disability-rights': `**What you can do**

- Follow disability-led organizations and include disabled people in decisions from the beginning, not after plans are finished.
- Ask local agencies, schools, healthcare systems, and businesses to fix specific access barriers.
- Support home- and community-based services, accessible communications, voting access, and strong enforcement of disability-rights laws.

**Who to contact**

${contactCongress}
- Ask an ADA specialist about rights or complaints through the **DOJ ADA Information Line** at **800-514-0301** or **833-610-1264 (TTY)**. Write to **Disability Rights Section, Civil Rights Division, U.S. Department of Justice, 950 Pennsylvania Avenue NW, Washington, DC 20530-0001**.

**More places to start**

- [ADA.gov](https://www.ada.gov/)
- [Disability Rights Education & Defense Fund](https://dredf.org/)
- [Autistic Self Advocacy Network](https://autisticadvocacy.org/)`,

  'workers-rights': `**What you can do**

- Keep records of hours, pay, schedules, workplace messages, and unsafe conditions.
- Talk with trusted coworkers and contact a worker center, union, or employment-law clinic before acting alone.
- Ask lawmakers and agencies to defend organizing, fair classification, overtime, safe workplaces, and accountability across contracting chains.

**Who to contact**

${contactCongress}
- For wage-and-hour questions or a confidential complaint, call the **U.S. Department of Labor Wage and Hour Division** at **866-487-9243** or write to **Wage and Hour Division, U.S. Department of Labor, 200 Constitution Avenue NW, Washington, DC 20210**.

**More places to start**

- [Department of Labor Wage and Hour Division](https://www.dol.gov/agencies/whd)
- [National Employment Law Project](https://www.nelp.org/)
- [AFL-CIO](https://aflcio.org/)`,

  'gun-violence': `**What you can do**

- Join a local violence-intervention, safe-storage, survivor-support, or gun-safety advocacy effort.
- Attend state and local hearings, where many firearm rules and prevention budgets are decided.
- Ask lawmakers to fund community-based prevention, strengthen background-check and safe-storage policies, and support survivors.

**Who to contact**

${contactCongress}
- Use [USAGov’s directory](https://www.usa.gov/elected-officials) to find your governor, state legislators, mayor, and county officials; their offices can address state firearm laws and local prevention funding.

**More places to start**

- [Everytown for Gun Safety](https://www.everytown.org/)
- [GIFFORDS](https://giffords.org/)
- [Moms Demand Action](https://www.momsdemandaction.org/)`,

  'indigenous-rights': `**What you can do**

- Follow the stated priorities of the Tribal nations and Indigenous organizers closest to an issue.
- Support Native-led legal, cultural, language, land-defense, and mutual-aid work.
- Ask agencies and lawmakers to honor treaties, protect sacred places, consult Tribal governments, and respect free, prior, and informed consent.

**Who to contact**

${contactCongress}
- Contact the **Bureau of Indian Affairs** at **202-208-5116** or write to **Bureau of Indian Affairs, Department of the Interior, 1849 C Street NW, Washington, DC 20240**. Use its Tribal Leaders Directory to contact the appropriate Tribal government directly.

**More places to start**

- [BIA Tribal Leaders Directory](https://www.bia.gov/service/tribal-leaders-directory)
- [Native American Rights Fund](https://www.narf.org/)
- [NDN Collective](https://ndncollective.org/)`,

  'digital-rights': `**What you can do**

- Use strong unique passwords, multifactor authentication, encrypted messaging when appropriate, and privacy settings that limit unnecessary collection.
- Ask schools, cities, employers, and police departments what surveillance tools they buy and what retention and sharing rules apply.
- Press lawmakers for warrants, data minimization, transparency, due process, and meaningful limits on location and identity tracking.

**Who to contact**

${contactCongress}
- Report fraud, identity theft, or harmful business practices to the **Federal Trade Commission** at **877-382-4357**. Write to **Federal Trade Commission, 600 Pennsylvania Avenue NW, Washington, DC 20580**.

**More places to start**

- [Electronic Frontier Foundation](https://www.eff.org/)
- [Electronic Privacy Information Center](https://epic.org/)
- [Fight for the Future](https://www.fightforthefuture.org/)`,

  education: `**What you can do**

- Attend school-board and state-education meetings, and ask how budgets affect high-need schools, disabled students, multilingual learners, and student aid.
- Volunteer with a public school or community education group while following educator, student, and family leadership.
- Ask lawmakers to fund Title I, IDEA, civil-rights enforcement, trustworthy research, educator preparation, and affordable higher education.

**Who to contact**

${contactCongress}
- Report education discrimination to the **U.S. Department of Education Office for Civil Rights** at **800-421-3481** or write to **U.S. Department of Education, 400 Maryland Avenue SW, Washington, DC 20202**.

**More places to start**

- [U.S. Department of Education](https://www.ed.gov/)
- [National Education Association](https://www.nea.org/)
- [EdTrust](https://edtrust.org/)`,
};

for (const [slug, sidebar] of Object.entries(sidebarBySlug)) {
  if (/^#{1,6}\s/m.test(sidebar)) {
    throw new Error(`Markdown headers are not allowed in the sidebar for ${slug}.`);
  }
}

const db = drizzle(neon(connectionString));
const issueRows = await db
  .select({ id: issues.id, slug: issues.slug })
  .from(issues)
  .orderBy(asc(issues.sortOrder), asc(issues.name));

const databaseSlugs = new Set(issueRows.map((issue) => issue.slug));
const missingContent = issueRows.filter((issue) => !sidebarBySlug[issue.slug]).map((issue) => issue.slug);
const missingIssues = Object.keys(sidebarBySlug).filter((slug) => !databaseSlugs.has(slug));

if (missingContent.length || missingIssues.length) {
  throw new Error([
    missingContent.length ? `No sidebar content for: ${missingContent.join(', ')}` : '',
    missingIssues.length ? `No matching database issue for: ${missingIssues.join(', ')}` : '',
  ].filter(Boolean).join('\n'));
}

const now = new Date();
for (const issue of issueRows) {
  await db
    .update(issues)
    .set({ sidebar: sidebarBySlug[issue.slug], updatedAt: now })
    .where(eq(issues.id, issue.id));
}

console.log(`Backfilled sidebar Markdown for ${issueRows.length} issues.`);
