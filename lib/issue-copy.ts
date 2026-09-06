export type NeutralIssueCopy = {
  detail: string;
  description: string;
};

const withViewpointNotice = (scope: string) =>
  `${scope}\n\nListings may reflect different viewpoints and may support, oppose, or propose changes to related laws, policies, or practices.`;

export const neutralIssueCopyBySlug = {
  voting: {
    detail: 'Issues related to voting and elections, including registration, ballot access, eligibility, election administration, district maps, election security, and voting law.',
    description: withViewpointNotice('This issue covers voting and election topics, including voter registration, ballot access, eligibility rules, election administration and security, district maps, voting-rights law, and disputes about how elections should be conducted.'),
  },
  'criminal-justice': {
    detail: 'Issues related to policing, criminal courts, bail, sentencing, incarceration, corrections, reentry, and the use of technology in the justice system.',
    description: withViewpointNotice('This issue covers criminal justice policy and practice, including law enforcement, arrest and pretrial procedures, prosecution and defense, sentencing, incarceration, corrections, reentry, wrongful convictions, and justice-system technology.'),
  },
  'bodily-autonomy': {
    detail: 'Issues related to bodily autonomy and reproductive health, including abortion, contraception, pregnancy care, emergency care, and medical decision-making.',
    description: withViewpointNotice('This issue covers bodily autonomy and reproductive-health topics, including abortion, contraception, pregnancy care, emergency treatment, patient and provider responsibilities, access to care, and laws governing medical decisions.'),
  },
  'climate-change': {
    detail: 'Issues related to climate change, energy, emissions, environmental policy, adaptation, conservation, land use, and community impacts.',
    description: withViewpointNotice('This issue covers climate and environmental topics, including climate science, energy production and use, emissions, pollution, conservation, adaptation, land and resource management, economic impacts, and government policy.'),
  },
  immigration: {
    detail: 'Issues related to immigration, including border policy, visas, asylum, citizenship, enforcement, detention, and the effects of immigration law.',
    description: withViewpointNotice('This issue covers immigration topics, including border management, lawful entry, visas, asylum and refugee policy, citizenship, employment, enforcement, detention, removal proceedings, and the effects of immigration law on individuals and communities.'),
  },
  lgbtq: {
    detail: 'Issues related to LGBTQ+ people and policy, including healthcare, education, family law, public accommodations, civil rights, and participation in public life.',
    description: withViewpointNotice('This issue covers topics related to LGBTQ+ people, including healthcare, education, family and parental matters, employment, public accommodations, identity documents, civil rights, and participation in public life.'),
  },
  'racial-justice': {
    detail: 'Issues related to race and ethnicity, including discrimination, civil rights, equal protection, public policy, representation, and institutional practices.',
    description: withViewpointNotice('This issue covers topics related to race and ethnicity, including discrimination, civil rights, equal protection, voting, housing, policing, education, healthcare, employment, representation, and government or institutional policy.'),
  },
  'housing-justice': {
    detail: 'Issues related to housing, including affordability, development, renting, homeownership, homelessness, eviction, public housing, and housing regulation.',
    description: withViewpointNotice('This issue covers housing topics, including affordability, supply and development, zoning, renting, homeownership, homelessness, eviction, rental assistance, public housing, tenant and property-owner responsibilities, and housing regulation.'),
  },
  'disability-rights': {
    detail: 'Issues related to disability, including accessibility, accommodations, healthcare, education, employment, public services, independent living, and disability law.',
    description: withViewpointNotice('This issue covers disability-related topics, including accessibility, accommodations, healthcare, education, employment, transportation, emergency services, public participation, independent and institutional living, and disability law.'),
  },
  'workers-rights': {
    detail: 'Issues related to work and employment, including wages, hours, benefits, unions, worker classification, workplace safety, and labor law.',
    description: withViewpointNotice('This issue covers work and employment topics, including wages, hours, overtime, benefits, unions and collective bargaining, worker classification, contracting relationships, workplace safety, employer responsibilities, and labor law.'),
  },
  'gun-violence': {
    detail: 'Issues related to firearms and gun violence, including ownership, regulation, self-defense, public safety, violence prevention, and industry practices.',
    description: withViewpointNotice('This issue covers firearm-related topics, including ownership and possession, self-defense, regulation, background checks, storage, public safety, violence prevention, criminal use, civil liability, and firearm-industry practices.'),
  },
  'indigenous-rights': {
    detail: 'Issues related to Indigenous peoples and Tribal nations, including sovereignty, treaties, land, natural resources, culture, religion, voting, and government relations.',
    description: withViewpointNotice('This issue covers topics related to Indigenous peoples and Tribal nations, including sovereignty, treaties, land and natural resources, sacred and cultural sites, religion, language, voting, economic development, and relations among Tribal, federal, state, and local governments.'),
  },
  'digital-rights': {
    detail: 'Issues related to technology and civil liberties, including privacy, surveillance, data collection, free expression, online moderation, cybersecurity, and digital regulation.',
    description: withViewpointNotice('This issue covers technology and civil-liberties topics, including privacy, surveillance, identity and location data, free expression, online moderation, age verification, cybersecurity, platform responsibilities, law-enforcement access, and digital regulation.'),
  },
  education: {
    detail: 'Issues related to education, including school funding, governance, curriculum, student services, accessibility, higher education, research, and education law.',
    description: withViewpointNotice('This issue covers education topics, including school funding, governance, curriculum, teacher policy, student services, disability accommodations, civil rights, school choice, higher education, student aid, research, and education law.'),
  },
} satisfies Record<string, NeutralIssueCopy>;

export const neutralIssueSidebar = `**How to use this page**

Browse petitions, lawsuits, and campaigns related to this topic. Listings may represent different viewpoints and proposed outcomes.

Organizations working on the issue from any perspective may submit relevant actions for review. A listing indicates relevance to the issue, not endorsement by Force Against Something.`;
