// DC University — curriculum content.
//
// Each course maps to an existing arena/interview persona (see
// ARENA_PERSONA_PROMPTS in server/routes.ts) so lecture generation reuses the
// same OpenAI + Fish Audio pipeline already powering Arena/Interview mode.
//
// Content policy: every "facts" bullet below must be a well-established,
// mainstream-consensus historical/scientific fact (dates, documents, events,
// publications) — never a live AI invention. Where a course covers a
// contested or specifically Afrocentric/critical thesis (e.g. Ben-Jochannan,
// Clarke), facts are framed as "X argued / cited / wrote" — verifiably true
// statements about what the scholar argued and the real sources they cited —
// rather than asserting the underlying contested claim as settled fact. The
// persona's AI voice is instructed to TEACH from these curated facts in its
// own cadence, not to invent new claims. This is how we keep lectures
// accurate without literal third-party peer review.

export interface LectureBeat {
  id: string;
  topic: string;
  facts: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export type LectureMinutes = 5 | 10 | 15;

export interface LectureLength {
  minutes: LectureMinutes;
  tokenCost: number;
  beatCount: number;
  quiz: QuizQuestion[];
}

export interface BookReference {
  title: string;
  author: string;
  note: string;
  url: string;
}

export interface DcUniversityCourse {
  id: string;
  departmentId: "history" | "economics" | "geopolitics" | "philosophy" | "science";
  departmentLabel: string;
  educatorId: string;
  educatorName: string;
  educatorTitle: string;
  courseTitle: string;
  courseDescription: string;
  beats: LectureBeat[];
  lengths: Record<LectureMinutes, LectureLength>;
  books: BookReference[];
  comingSoon?: boolean;
}

function amazonSearch(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=trumpbot-20`;
}

// ---------------------------------------------------------------------------
// Dr. Cornel West — American History & the Moral Struggle for Democracy
// ---------------------------------------------------------------------------

const WEST_BEATS: LectureBeat[] = [
  {
    id: "founding-contradiction",
    topic: "The Founding Contradiction (1776)",
    facts: [
      "The Declaration of Independence, adopted July 4, 1776, declared 'all men are created equal' while roughly one-fifth of the colonial population was enslaved.",
      "Thomas Jefferson, the Declaration's principal author, enslaved over 600 people across his lifetime at Monticello.",
      "An anti-slave-trade passage Jefferson drafted was struck from the final Declaration text by the Continental Congress.",
    ],
  },
  {
    id: "constitution-compromise",
    topic: "The Constitution's Compromises (1787-1789)",
    facts: [
      "The 1787 Constitutional Convention's Three-Fifths Compromise counted enslaved people as three-fifths of a person for congressional apportionment and taxation.",
      "The Constitution's Article I, Section 9 barred Congress from banning the international slave trade before 1808.",
      "The Fugitive Slave Clause (Article IV, Section 2) required escaped enslaved people be returned to enslavers even in free states.",
    ],
  },
  {
    id: "abolition",
    topic: "Abolition and Frederick Douglass",
    facts: [
      "Frederick Douglass escaped slavery in 1838 and became the most prominent Black abolitionist orator and writer of the 19th century.",
      "His 1852 speech 'What to the Slave Is the Fourth of July?' directly indicted the gap between American ideals and American practice.",
      "The Underground Railroad, active roughly 1810-1850, helped an estimated 100,000 enslaved people escape to free states and Canada.",
    ],
  },
  {
    id: "civil-war-emancipation",
    topic: "Civil War and Emancipation (1861-1865)",
    facts: [
      "The Emancipation Proclamation, effective January 1, 1863, declared enslaved people in Confederate-held territory free.",
      "The 13th Amendment, ratified December 6, 1865, abolished slavery nationwide except as punishment for crime.",
      "Roughly 180,000 Black soldiers served in the Union Army through the United States Colored Troops.",
    ],
  },
  {
    id: "reconstruction",
    topic: "Reconstruction and Its Betrayal (1865-1877)",
    facts: [
      "The 14th Amendment (1868) granted birthright citizenship and equal protection; the 15th Amendment (1870) barred denying the vote based on race.",
      "During Reconstruction, over 2,000 Black Americans held local, state, and federal office, including U.S. Senators Hiram Revels and Blanche Bruce.",
      "The Compromise of 1877 withdrew federal troops from the South, ending Reconstruction and enabling the rise of Jim Crow.",
    ],
  },
  {
    id: "jim-crow",
    topic: "Jim Crow and Plessy v. Ferguson",
    facts: [
      "Plessy v. Ferguson (1896) upheld 'separate but equal' racial segregation under the 14th Amendment, legalizing Jim Crow.",
      "Jim Crow laws enforced segregation in schools, transportation, and public accommodations across the South from the 1870s to the 1960s.",
      "Poll taxes, literacy tests, and grandfather clauses were used to disenfranchise Black voters despite the 15th Amendment.",
    ],
  },
  {
    id: "great-migration",
    topic: "The Great Migration (1916-1970)",
    facts: [
      "An estimated six million Black Americans moved from the rural South to Northern, Midwestern, and Western cities between 1916 and 1970.",
      "The migration reshaped American cities and fueled cultural movements including the Harlem Renaissance of the 1920s.",
      "Migrants sought industrial jobs and escape from Jim Crow violence, including lynching, which claimed thousands of lives between 1877 and 1950.",
    ],
  },
  {
    id: "civil-rights-rise",
    topic: "Brown v. Board and the Civil Rights Movement",
    facts: [
      "Brown v. Board of Education (1954) unanimously overturned Plessy, ruling segregated public schools unconstitutional.",
      "The Montgomery Bus Boycott (1955-1956), sparked by Rosa Parks's arrest, lasted 381 days and ended bus segregation in Montgomery.",
      "The 1963 March on Washington drew roughly 250,000 people and featured Martin Luther King Jr.'s 'I Have a Dream' speech.",
    ],
  },
  {
    id: "king-legislation",
    topic: "King, Nonviolence, and Landmark Legislation",
    facts: [
      "The Civil Rights Act of 1964 outlawed discrimination based on race, color, religion, sex, or national origin in public life and employment.",
      "The Voting Rights Act of 1965 banned discriminatory voting practices and enabled federal oversight of elections in covered jurisdictions.",
      "Martin Luther King Jr. was assassinated in Memphis on April 4, 1968; he was awarded the Nobel Peace Prize in 1964.",
    ],
  },
  {
    id: "malcolm-black-power",
    topic: "Malcolm X and Black Power",
    facts: [
      "Malcolm X, a minister in the Nation of Islam and later an independent Sunni Muslim leader, argued for Black self-determination and self-defense.",
      "He was assassinated in Harlem on February 21, 1965, months after leaving the Nation of Islam.",
      "The Black Power movement, associated with figures like Stokely Carmichael, emphasized racial pride, political power, and cultural identity from the mid-1960s onward.",
    ],
  },
  {
    id: "prophetic-tradition",
    topic: "The Prophetic Tradition — Religion, Jazz, and the Blues",
    facts: [
      "Cornel West's scholarship (notably 'Race Matters,' 1993) situates Black struggle within a 'prophetic' religious and moral tradition rooted in the Black church.",
      "West identifies jazz and the blues — figures like John Coltrane — as philosophical resources for confronting suffering with what he calls 'tragicomic hope.'",
      "This tradition traces from spirituals sung under slavery through the Black church's central role organizing the Civil Rights Movement.",
    ],
  },
  {
    id: "democracy-today",
    topic: "Democracy in Crisis — West's Contemporary Diagnosis",
    facts: [
      "In 'Race Matters,' West diagnoses a 'nihilistic threat' — a lived sense of hopelessness and meaninglessness — as a central danger facing Black America.",
      "West is a longtime critic of what he terms 'market fundamentalism,' arguing unchecked market values corrode democratic and moral life.",
      "West holds a Ph.D. from Princeton and has taught at Harvard, Princeton, Union Theological Seminary, and elsewhere across a decades-long academic career.",
    ],
  },
];

const WEST_QUIZ_5: QuizQuestion[] = [
  { id: "q1", question: "What did the Declaration of Independence claim while roughly one-fifth of the colonial population remained enslaved?", choices: ["That all men are created equal", "That taxation requires representation", "That slavery would end within a decade", "That states could secede freely"], correctIndex: 0, explanation: "The Declaration proclaimed 'all men are created equal' even as slavery persisted." },
  { id: "q2", question: "What did the Three-Fifths Compromise do?", choices: ["Freed enslaved people over five years", "Counted enslaved people as three-fifths of a person for apportionment", "Banned the slave trade after 1789", "Gave enslaved people the vote"], correctIndex: 1, explanation: "It was a 1787 constitutional compromise over counting enslaved people for representation and taxation." },
  { id: "q3", question: "When did the Emancipation Proclamation take effect?", choices: ["July 4, 1776", "January 1, 1863", "December 6, 1865", "1896"], correctIndex: 1, explanation: "It took effect January 1, 1863, declaring enslaved people in Confederate territory free." },
  { id: "q4", question: "What ended Reconstruction in 1877?", choices: ["The 13th Amendment", "Plessy v. Ferguson", "The Compromise of 1877, withdrawing federal troops from the South", "The Emancipation Proclamation"], correctIndex: 2, explanation: "The Compromise of 1877 withdrew federal troops, ending Reconstruction and opening the door to Jim Crow." },
];

const WEST_QUIZ_10: QuizQuestion[] = [
  ...WEST_QUIZ_5,
  { id: "q5", question: "What did Plessy v. Ferguson (1896) rule?", choices: ["Segregated schools are unconstitutional", "'Separate but equal' segregation is constitutional", "Poll taxes are illegal", "The 15th Amendment is void"], correctIndex: 1, explanation: "Plessy legalized 'separate but equal,' the legal foundation of Jim Crow, until Brown overturned it in 1954." },
  { id: "q6", question: "Roughly how many Black Americans relocated during the Great Migration (1916-1970)?", choices: ["About 50,000", "About 6 million", "About 500,000", "About 20 million"], correctIndex: 1, explanation: "An estimated six million Black Americans moved from the rural South to Northern, Midwestern, and Western cities." },
];

const WEST_QUIZ_15: QuizQuestion[] = [
  ...WEST_QUIZ_10,
  { id: "q7", question: "What did the Civil Rights Act of 1964 do?", choices: ["Ended the international slave trade", "Outlawed discrimination in public life and employment", "Created the Underground Railroad", "Established the three-fifths rule"], correctIndex: 1, explanation: "It outlawed discrimination based on race, color, religion, sex, or national origin in public life and employment." },
  { id: "q8", question: "In 'Race Matters,' what does Cornel West identify as a central danger facing Black America?", choices: ["Overpopulation", "A 'nihilistic threat' — lived hopelessness and meaninglessness", "Foreign invasion", "Excess of religious belief"], correctIndex: 1, explanation: "West's 1993 book diagnoses a 'nihilistic threat' rooted in socioeconomic despair, distinct from purely political or economic explanations." },
];

// ---------------------------------------------------------------------------
// Professor Richard Wolff — How Capitalism Actually Works
// ---------------------------------------------------------------------------

const WOLFF_BEATS: LectureBeat[] = [
  { id: "surplus-value", topic: "Marx's Core Concept: Surplus Value", facts: [
    "In 'Capital, Volume I' (1867), Karl Marx argued workers are paid a wage for their labor power but produce more value than that wage — the difference is surplus value.",
    "Wolff argues this surplus, once produced, is appropriated by the employer, not shared democratically with the workers who created it.",
  ]},
  { id: "defining-capitalism", topic: "What Actually Makes a System 'Capitalist'", facts: [
    "Wolff defines capitalism specifically by the employer-employee relationship inside the enterprise, distinct from markets or private property, which predate capitalism by millennia.",
    "Under this definition, a system can have markets and private ownership without being capitalist, if the workplace itself is organized democratically.",
  ]},
  { id: "2008-crisis", topic: "The 2008 Financial Crisis", facts: [
    "In his book and film 'Capitalism Hits the Fan' (2009), Wolff argued the 2008 crisis reflected deep structural instability, not just individual bad actors.",
    "The crisis triggered a global recession and roughly $700 billion Troubled Asset Relief Program bailout of U.S. banks in late 2008.",
  ]},
  { id: "wage-stagnation", topic: "Wage Stagnation Since the 1970s", facts: [
    "U.S. Bureau of Labor Statistics data shows real median wages grew far more slowly after the mid-1970s even as worker productivity kept climbing.",
    "Wolff cites this productivity-wage gap as a central driver of the household debt boom that preceded the 2008 crash.",
  ]},
  { id: "wsdes", topic: "The Alternative: Worker Self-Directed Enterprises", facts: [
    "In 'Democracy at Work' (2012), Wolff proposes Worker Self-Directed Enterprises (WSDEs), where the people who do the work collectively decide what to produce, how, and what to do with profits.",
    "Wolff frames this as extending democracy from the ballot box into the workplace, where most adults spend the bulk of their waking hours.",
  ]},
  { id: "mondragon", topic: "Historical Precedent: Mondragon Corporation", facts: [
    "The Mondragon Corporation, founded in the Basque region of Spain in 1956, is a federation of worker cooperatives now employing tens of thousands of worker-owners.",
    "Wolff regularly cites Mondragon as evidence that large-scale democratic workplaces can compete industrially over decades.",
  ]},
  { id: "isms-distinction", topic: "Capitalism vs. Socialism vs. Communism", facts: [
    "In 'Understanding Socialism' (2019), Wolff distinguishes who owns the means of production from how the enterprise itself is internally organized — two separate questions often conflated in popular debate.",
    "He argues 20th-century 'socialist' states like the Soviet Union nationalized ownership but largely kept top-down, non-democratic enterprise organization.",
  ]},
  { id: "business-cycles", topic: "Recurring Business Cycles", facts: [
    "Capitalist economies have experienced repeated boom-bust cycles, including the Great Depression (starting 1929), 1970s stagflation, the 2000 dot-com crash, and the 2008 financial crisis.",
    "Wolff argues these recurring crises are structural features of the system rather than isolated accidents.",
  ]},
  { id: "wolff-academic-path", topic: "Wolff's Academic Path", facts: [
    "Richard Wolff earned his Ph.D. in economics from Yale University and taught economics at the University of Massachusetts Amherst for over 30 years, now professor emeritus.",
    "He has also served as a visiting professor at the New School's Graduate Program in International Affairs in New York.",
  ]},
  { id: "economic-update", topic: "Economic Update", facts: [
    "Since 2008, Wolff has hosted 'Economic Update,' a weekly program analyzing current news through the lens of economic class, syndicated across Pacifica radio stations and online.",
    "The program was created partly in response to the 2008 crisis, which Wolff argued mainstream economic commentary failed to explain to the public.",
  ]},
  { id: "deregulation-critique", topic: "Critique of Deregulation and 'Trickle-Down'", facts: [
    "Wolff points to the deregulatory shift beginning under the Reagan administration in the 1980s as accelerating wealth concentration at the top of the income distribution.",
    "He argues the promised 'trickle-down' benefits to labor did not materialize at a scale matching the productivity gains workers generated.",
  ]},
  { id: "sickness-system", topic: "The Sickness Is the System", facts: [
    "In 'The Sickness Is the System' (2020), Wolff argued the COVID-19 pandemic exposed pre-existing fragilities in for-profit healthcare and the gig economy's lack of worker protections.",
    "The book argues pandemic-era layoffs and healthcare access gaps reflected structural choices, not just an unforeseeable emergency.",
  ]},
];

const WOLFF_QUIZ_5: QuizQuestion[] = [
  { id: "q1", question: "What is 'surplus value' in Marx's 'Capital' (1867)?", choices: ["A government tax on wages", "The extra value workers produce beyond their wage, kept by the employer", "A type of stock dividend", "A form of consumer debt"], correctIndex: 1, explanation: "Marx argued workers produce more value than they're paid, and that surplus goes to the employer." },
  { id: "q2", question: "How does Wolff specifically define 'capitalism'?", choices: ["Any system with markets", "Any system with private property", "By the employer-employee relationship inside the enterprise", "Any system with money"], correctIndex: 2, explanation: "Wolff distinguishes capitalism by who controls decisions inside the workplace, not just markets or ownership generally." },
  { id: "q3", question: "What does WSDE stand for in Wolff's proposal?", choices: ["World Systemic Debt Exchange", "Worker Self-Directed Enterprise", "Wage Sharing and Distribution Entity", "Western Socialist Development Effort"], correctIndex: 1, explanation: "WSDEs are workplaces where workers collectively make enterprise decisions, proposed in 'Democracy at Work' (2012)." },
  { id: "q4", question: "What real-world example does Wolff cite for large-scale worker cooperatives?", choices: ["Mondragon Corporation in Spain", "Standard Oil", "The East India Company", "Amazon"], correctIndex: 0, explanation: "Mondragon, founded in Spain in 1956, is a long-running federation of worker cooperatives Wolff cites as proof of concept." },
];
const WOLFF_QUIZ_10: QuizQuestion[] = [...WOLFF_QUIZ_5,
  { id: "q5", question: "What trend does Wolff cite from U.S. wage data since the mid-1970s?", choices: ["Wages grew faster than productivity", "Wages stagnated while productivity kept rising", "Wages and productivity both fell", "Wages tripled"], correctIndex: 1, explanation: "Real median wages grew much more slowly than productivity after the mid-1970s, per BLS data." },
  { id: "q6", question: "What does 'Economic Update' do?", choices: ["It's a stock trading app", "A weekly program analyzing news through an economic-class lens, hosted by Wolff since 2008", "A UN economic report", "A Federal Reserve bulletin"], correctIndex: 1, explanation: "Wolff has hosted this weekly program since 2008, syndicated on Pacifica radio stations." },
];
const WOLFF_QUIZ_15: QuizQuestion[] = [...WOLFF_QUIZ_10,
  { id: "q7", question: "According to Wolff, how does 'socialism' typically differ from what he proposes?", choices: ["Socialism has no government", "20th-century socialist states often nationalized ownership but kept top-down enterprise organization", "Socialism eliminates all markets", "There is no difference"], correctIndex: 1, explanation: "Wolff distinguishes ownership from internal enterprise democracy — many socialist states changed the former but not the latter." },
  { id: "q8", question: "What did 'The Sickness Is the System' (2020) argue?", choices: ["COVID was entirely unpredictable and had no systemic causes", "The pandemic exposed pre-existing fragilities in for-profit healthcare and the gig economy", "The stock market is always efficient", "Vaccines caused the recession"], correctIndex: 1, explanation: "Wolff's 2020 book ties pandemic-era failures to structural choices in healthcare and labor systems." },
];

// ---------------------------------------------------------------------------
// Professor Jeffrey Sachs — Global Development and the New World Order
// ---------------------------------------------------------------------------

const SACHS_BEATS: LectureBeat[] = [
  { id: "bolivia", topic: "Early Career: Bolivia's Hyperinflation (1985)", facts: [
    "In 1985, Sachs advised the Bolivian government during hyperinflation that exceeded 20,000% annually, one of the worst episodes in modern economic history.",
    "The stabilization plan he helped design brought inflation down sharply within about a year, launching his career as a global economic advisor.",
  ]},
  { id: "poland", topic: "Poland's 'Shock Therapy' (1989-1990)", facts: [
    "Sachs advised Poland's post-communist government on a rapid market liberalization program beginning in 1989, later dubbed 'shock therapy.'",
    "The program aimed to quickly convert a centrally planned economy into a market economy after decades of Soviet-aligned rule.",
  ]},
  { id: "end-of-poverty", topic: "The End of Poverty (2005)", facts: [
    "Sachs's 2005 book 'The End of Poverty' argued extreme global poverty could be eliminated through targeted development aid and investment.",
    "The book called on wealthy nations to meet the United Nations' 0.7% of gross national income foreign aid target, a benchmark first set in 1970.",
  ]},
  { id: "mdgs", topic: "The UN Millennium Development Goals (2000)", facts: [
    "Sachs was a key architect and advisor for the UN's Millennium Development Goals, eight targets on poverty, education, and health adopted by 189 countries in 2000.",
    "He directed the UN Millennium Project from 2002 to 2006, tasked with recommending strategies to achieve the goals by 2015.",
  ]},
  { id: "sdgs", topic: "The Sustainable Development Goals (2015)", facts: [
    "Sachs advised on the UN's 17 Sustainable Development Goals, adopted in 2015 as the successor framework to the Millennium Development Goals.",
    "The SDGs expanded the scope to include climate action, inequality, and sustainable economic growth targets through 2030.",
  ]},
  { id: "earth-institute", topic: "Director of Columbia's Earth Institute (2002-2016)", facts: [
    "Sachs directed Columbia University's Earth Institute from 2002 to 2016, an institute studying sustainable development, poverty, and climate.",
    "He currently directs Columbia's Center for Sustainable Development.",
  ]},
  { id: "common-wealth", topic: "Common Wealth (2008)", facts: [
    "In 'Common Wealth: Economics for a Crowded Planet' (2008), Sachs identified population growth, resource depletion, climate change, and extreme poverty as four interlocking global crises.",
    "The book argues these crises require coordinated global cooperation rather than nation-by-nation solutions.",
  ]},
  { id: "foreign-policy-critique", topic: "Critique of U.S. Foreign Policy", facts: [
    "In 'A New Foreign Policy: Beyond American Exceptionalism' (2018), Sachs argued for greater restraint and criticized post-Cold War U.S. military interventionism.",
    "He has publicly argued several U.S. interventions since the 1990s produced costs that outweighed their stated goals.",
  ]},
  { id: "ages-of-globalization", topic: "The Ages of Globalization (2020)", facts: [
    "In this 2020 book, Sachs identifies seven distinct historical waves of globalization, each driven by new technology, from the Paleolithic era to the digital age.",
    "The framework situates today's interconnected world economy as the latest stage in a pattern going back tens of thousands of years.",
  ]},
  { id: "russia-1990s", topic: "Jeffrey Sachs and Russia in the 1990s", facts: [
    "Sachs briefly advised the Russian government from 1991 to 1994 following the Soviet Union's collapse, applying rapid market-transition ideas similar to Poland's.",
    "He later became a public critic of how Russia's post-Soviet transition unfolded, pointing to the concentration of wealth among newly formed oligarchs.",
  ]},
  { id: "china-relations", topic: "The US-China Debate", facts: [
    "Sachs has argued publicly for cooperative rather than adversarial U.S.-China relations, a position that has drawn both support and criticism in U.S. policy circles.",
    "He frequently cites the scale of U.S.-China economic interdependence, with bilateral trade exceeding hundreds of billions of dollars annually, as a reason to avoid confrontation.",
  ]},
  { id: "sachs-academic-path", topic: "Sachs's Academic Background", facts: [
    "Sachs earned his Ph.D. in economics from Harvard University in 1980 and became a tenured Harvard professor at age 28, among the youngest in the university's history.",
    "He joined Columbia University's faculty in 2002, where he continues to direct sustainable development research.",
  ]},
];

const SACHS_QUIZ_5: QuizQuestion[] = [
  { id: "q1", question: "What crisis did Sachs first help address in Bolivia in 1985?", choices: ["A banking collapse", "Hyperinflation exceeding 20,000% annually", "A currency peg to gold", "A stock market crash"], correctIndex: 1, explanation: "Sachs advised Bolivia during hyperinflation exceeding 20,000% annually in 1985, launching his advisory career." },
  { id: "q2", question: "What did Sachs's 'The End of Poverty' (2005) call for?", choices: ["Ending all foreign aid", "Wealthy nations meeting the UN's 0.7% GNI aid target to eliminate extreme poverty", "Abolishing the United Nations", "Global currency unification"], correctIndex: 1, explanation: "The book argued extreme poverty is solvable if wealthy nations meet the long-standing 0.7% GNI aid benchmark." },
  { id: "q3", question: "How many UN Millennium Development Goals were adopted in 2000?", choices: ["3", "8", "17", "25"], correctIndex: 1, explanation: "The UN adopted 8 Millennium Development Goals in 2000, with Sachs as a key advisor and architect." },
  { id: "q4", question: "What institute did Sachs direct at Columbia from 2002 to 2016?", choices: ["The Earth Institute", "The World Bank", "The Federal Reserve", "The Peterson Institute"], correctIndex: 0, explanation: "Sachs directed Columbia's Earth Institute, studying sustainable development, poverty, and climate, from 2002 to 2016." },
];
const SACHS_QUIZ_10: QuizQuestion[] = [...SACHS_QUIZ_5,
  { id: "q5", question: "What program did Sachs advise Poland on beginning in 1989?", choices: ["Nationalizing all industry", "A rapid market liberalization program known as 'shock therapy'", "Rejoining the Warsaw Pact", "A return to central planning"], correctIndex: 1, explanation: "Sachs advised Poland's post-communist government on rapid market liberalization starting in 1989." },
  { id: "q6", question: "How many Sustainable Development Goals did the UN adopt in 2015?", choices: ["8", "12", "17", "30"], correctIndex: 2, explanation: "The UN adopted 17 Sustainable Development Goals in 2015 as the successor to the Millennium Development Goals." },
];
const SACHS_QUIZ_15: QuizQuestion[] = [...SACHS_QUIZ_10,
  { id: "q7", question: "What four crises does 'Common Wealth' (2008) identify?", choices: ["War, famine, plague, and drought", "Population growth, resource depletion, climate change, and extreme poverty", "Inflation, deflation, recession, and depression", "Colonialism, slavery, monarchy, and feudalism"], correctIndex: 1, explanation: "Sachs's 2008 book frames these four as interlocking global crises requiring coordinated cooperation." },
  { id: "q8", question: "At what age did Sachs become a tenured Harvard professor?", choices: ["22", "28", "45", "60"], correctIndex: 1, explanation: "Sachs became a tenured Harvard professor at 28, among the youngest in the university's history." },
];

// ---------------------------------------------------------------------------
// Dr. Claud Anderson — Black Labor, White Wealth
// ---------------------------------------------------------------------------

const ANDERSON_BEATS: LectureBeat[] = [
  { id: "powernomics-thesis", topic: "The Core Thesis of PowerNomics", facts: [
    "In 'PowerNomics: The National Plan to Empower Black America' (2001), Anderson argues economic and political power in America has historically been distributed through race-based group strategy, not individual merit alone.",
    "The book proposes a coordinated national economic plan rather than relying solely on civil rights litigation or individual advancement.",
  ]},
  { id: "black-labor-white-wealth", topic: "Black Labor, White Wealth (1994)", facts: [
    "Anderson's 1994 book traces how Black labor historically generated wealth largely retained by white ownership — from slavery, through sharecropping, into modern wage labor.",
    "The book argues each economic transition (emancipation, industrialization, urbanization) repeated this pattern of labor without proportional ownership.",
  ]},
  { id: "group-economics", topic: "The 'Group Economics' Concept", facts: [
    "Anderson advocates 'group economics': coordinated production, ownership, and circulation of dollars within the Black community before those dollars leave it.",
    "He frequently cites estimates that a dollar circulates only a matter of hours within many Black communities compared to much longer in other ethnic communities, as a call to action for internal economic coordination.",
  ]},
  { id: "civil-rights-critique", topic: "Critique of Civil Rights-Era Focus", facts: [
    "Anderson argues 1960s civil rights legislation emphasized desegregation and voting rights but did not include a parallel plan for asset and business ownership.",
    "He contrasts legal equality under the Civil Rights Act of 1964 with continuing gaps in business ownership and generational wealth.",
  ]},
  { id: "homestead-act", topic: "The Homestead Act Comparison (1862)", facts: [
    "The Homestead Act of 1862 granted roughly 160-acre land parcels to an estimated 1.6 million mostly white homesteaders over subsequent decades.",
    "Sherman's Special Field Order No. 15 (1865) had briefly set aside land for formerly enslaved families — the origin of the '40 acres' phrase — but President Andrew Johnson reversed the order later that year.",
  ]},
  { id: "black-wall-street", topic: "Historical Black Economic Centers", facts: [
    "The Greenwood District of Tulsa, Oklahoma, known as 'Black Wall Street,' was a thriving Black-owned business district destroyed in the 1921 Tulsa Race Massacre.",
    "Anderson cites Greenwood as historical evidence that concentrated Black group economics can succeed at scale, and that it was targeted for destruction.",
  ]},
  { id: "government-service", topic: "Anderson's Government Service", facts: [
    "Claud Anderson served in Georgia state government in the 1970s, including as a gubernatorial cabinet-level appointee focused on human resources and labor issues.",
    "He later founded the PowerNomics Corporation of America to advance Black-owned business development.",
  ]},
  { id: "dependency-critique", topic: "Critique of Dependency Models", facts: [
    "Anderson argues for production-based, ownership-based economics over long-term dependency on government transfer payments.",
    "He frames business ownership and asset accumulation, not just employment or benefits, as the metric that determines generational wealth transfer.",
  ]},
  { id: "education-vs-ownership", topic: "Education Alone Doesn't Close the Wealth Gap", facts: [
    "Anderson argues that educational credentials without capital and asset ownership do not close the racial wealth gap on their own.",
    "Federal Reserve survey data has repeatedly shown a persistent gap in median household wealth between Black and white American families across income and education levels.",
  ]},
  { id: "harvest-institute", topic: "Founding the Harvest Institute", facts: [
    "Anderson founded the Harvest Institute, a Washington, D.C.-based think tank researching policy for Black economic development.",
    "The institute's work fed into the policy proposals later published in 'PowerNomics' (2001).",
  ]},
  { id: "federal-contracting", topic: "Federal Contracting and Set-Asides", facts: [
    "Anderson has advocated for enforceable federal and state contracting set-asides for Black-owned businesses as a form of reparative economic policy.",
    "Federal minority business set-aside programs have existed in various forms since the Small Business Act amendments of the 1960s and 1970s, though their scope and enforcement have been repeatedly contested in courts.",
  ]},
  { id: "vertical-integration", topic: "Anderson's Vertical Integration Model", facts: [
    "Anderson proposes a vertical integration model where Black-owned banks, manufacturers, distributors, and retailers supply one another, keeping dollars circulating internally longer.",
    "He points to ethnic enclave economies in immigrant communities as existing examples of this kind of internal economic coordination.",
  ]},
];

const ANDERSON_QUIZ_5: QuizQuestion[] = [
  { id: "q1", question: "What is the central thesis of Anderson's 'PowerNomics' (2001)?", choices: ["Individual merit alone determines wealth", "Economic and political power has historically been distributed by race-based group strategy", "Government aid is sufficient for economic equality", "Education alone closes wealth gaps"], correctIndex: 1, explanation: "PowerNomics argues group-based economic strategy, not individual merit alone, has historically shaped wealth distribution." },
  { id: "q2", question: "What does Anderson mean by 'group economics'?", choices: ["A stock trading strategy", "Coordinated production, ownership, and circulation of dollars within a community", "A government welfare program", "A tax policy"], correctIndex: 1, explanation: "Group economics calls for keeping dollars circulating within the community through internal ownership and production." },
  { id: "q3", question: "What did the Homestead Act of 1862 do?", choices: ["Freed enslaved people", "Granted roughly 160-acre land parcels to about 1.6 million mostly white homesteaders", "Created the Freedmen's Bureau", "Ended sharecropping"], correctIndex: 1, explanation: "The Homestead Act distributed land broadly to white settlers, a contrast Anderson draws with the reversed 40-acres order." },
  { id: "q4", question: "What was 'Black Wall Street'?", choices: ["A Wall Street investment firm", "The Greenwood District of Tulsa, a thriving Black-owned business district destroyed in 1921", "A federal jobs program", "A civil rights organization"], correctIndex: 1, explanation: "Greenwood was a thriving Black business district in Tulsa destroyed in the 1921 Tulsa Race Massacre." },
];
const ANDERSON_QUIZ_10: QuizQuestion[] = [...ANDERSON_QUIZ_5,
  { id: "q5", question: "What was Sherman's Special Field Order No. 15 (1865)?", choices: ["A tax law", "An order briefly setting aside land for formerly enslaved families, later reversed", "A military draft order", "A treaty with Britain"], correctIndex: 1, explanation: "It briefly set aside land for freed families — the origin of '40 acres' — before being reversed by President Johnson." },
  { id: "q6", question: "What role did Anderson hold in Georgia state government?", choices: ["Governor", "A gubernatorial cabinet-level appointee on labor/human resources issues", "U.S. Senator", "Mayor of Atlanta"], correctIndex: 1, explanation: "Anderson served in a Georgia gubernatorial cabinet-level role in the 1970s before founding PowerNomics Corporation." },
];
const ANDERSON_QUIZ_15: QuizQuestion[] = [...ANDERSON_QUIZ_10,
  { id: "q7", question: "According to Anderson, what alone does not close the racial wealth gap?", choices: ["Business ownership", "Educational credentials without capital and asset ownership", "Group economics", "Federal contracting"], correctIndex: 1, explanation: "Anderson argues credentials without ownership and capital don't close the wealth gap, citing persistent Federal Reserve wealth-gap data." },
  { id: "q8", question: "What is Anderson's 'vertical integration' model?", choices: ["Merging with white-owned corporations", "Black-owned banks, manufacturers, distributors, and retailers supplying one another", "Investing only in real estate", "A federal jobs guarantee"], correctIndex: 1, explanation: "The model proposes Black-owned businesses across the supply chain support each other, keeping dollars circulating longer." },
];

// ---------------------------------------------------------------------------
// Dr. Yosef Ben-Jochannan — Africa: The Cradle of Civilization
// ---------------------------------------------------------------------------

const BENJ_BEATS: LectureBeat[] = [
  { id: "background", topic: "Ben-Jochannan's Background", facts: [
    "By his own account, Yosef Ben-Jochannan was born in Ethiopia in 1918 and trained in Egyptology and law, though details of his early biography have been debated by biographers.",
    "He described himself as an independent scholar working outside formal Western academic gatekeeping, publishing over two dozen books across a decades-long career.",
  ]},
  { id: "mother-of-civilization", topic: "Africa: Mother of Western Civilization (1971)", facts: [
    "In this 1971 book, Ben-Jochannan argued that Kemet (ancient Egypt) was a Black African civilization whose religion, philosophy, and science predated and influenced Greek thought.",
    "The book became a foundational text in the Afrocentric scholarship movement of the 1970s.",
  ]},
  { id: "cornell-africana", topic: "The Cornell Africana Studies Connection", facts: [
    "In the early 1970s, Ben-Jochannan taught in and helped shape Cornell University's Africana Studies and Research Center.",
    "Cornell's center was founded in 1969 after student activism, among the first formal Africana Studies programs at a major U.S. university.",
  ]},
  { id: "herodotus", topic: "Herodotus on Ancient Egypt", facts: [
    "Ben-Jochannan frequently cited the Greek historian Herodotus (5th century BCE), who in 'The Histories' described the Egyptians as having dark skin and wooly hair.",
    "He used this and similar ancient testimony as historical evidence for arguing Kemet's African identity.",
  ]},
  { id: "diop-parallel", topic: "Cheikh Anta Diop's Parallel Scholarship", facts: [
    "Ben-Jochannan's arguments ran parallel to Senegalese scholar Cheikh Anta Diop, whose 1974 book 'The African Origin of Civilization: Myth or Reality?' used melanin-dosage testing on Egyptian mummies to argue for their African identity.",
    "Diop and Ben-Jochannan are frequently cited together as founding figures of 20th-century Afrocentric historiography.",
  ]},
  { id: "black-man-nile", topic: "Black Man of the Nile and His Family (1972)", facts: [
    "Ben-Jochannan's 1972 book compiled primary-source and archaeological arguments for African origins of Nile Valley civilization.",
    "The book drew on artifacts, inscriptions, and classical-era accounts he argued mainstream Egyptology had downplayed.",
  ]},
  { id: "religious-influence", topic: "Kemet's Religious Influence", facts: [
    "In 'African Origins of the Major Western Religions' (1970), Ben-Jochannan argued Kemetic religious concepts — including judgment of the soul and the weighing of the heart against the principle of Ma'at — predate and influenced later religious and philosophical traditions.",
    "He argued these Nile Valley religious frameworks are far older than commonly taught in Western religious education.",
  ]},
  { id: "greek-philosophers", topic: "Greek Philosophers Who Studied in Kemet", facts: [
    "Ben-Jochannan pointed to ancient accounts, including from Greek writers themselves, that figures such as Pythagoras and Solon traveled to and studied in Egypt.",
    "He used these accounts to argue that Greek philosophy has African intellectual roots often omitted from standard philosophy curricula.",
  ]},
  { id: "unesco-symposium", topic: "The 1974 UNESCO Cairo Symposium", facts: [
    "In 1974, UNESCO convened a symposium in Cairo on the peopling of ancient Egypt, where Diop and scholars aligned with Ben-Jochannan's thesis presented the case for Kemet's Black African identity to international Egyptologists.",
    "The symposium's published proceedings recorded significant disagreement between the Afrocentric scholars and mainstream Egyptologists present, a debate that continues in academic circles today.",
  ]},
  { id: "nubia-kush", topic: "Nile Valley Civilizations Beyond Egypt", facts: [
    "Ben-Jochannan emphasized Nubia and the Kingdom of Kush, located in present-day Sudan, as major Nile Valley civilizations often excluded from world history curricula.",
    "The Kingdom of Kush conquered and ruled Egypt as its 25th Dynasty, from roughly 744 to 656 BCE — a fact confirmed in mainstream Egyptology.",
  ]},
  { id: "historiography-critique", topic: "Critique of Western Historiography", facts: [
    "Across decades of public lectures and university debates, Ben-Jochannan argued mainstream Western textbooks and Egyptology minimized or erased African contributions to world civilization.",
    "He framed correcting this record as central to Black students' access to an accurate account of their own history.",
  ]},
  { id: "legacy", topic: "Ben-Jochannan's Legacy", facts: [
    "Ben-Jochannan lectured for over 50 years at universities and community institutions across the United States until his death in 2015.",
    "He remains a foundational figure in Afrocentric scholarship, even as several of his specific claims continue to be debated by mainstream Egyptologists.",
  ]},
];

const BENJ_QUIZ_5: QuizQuestion[] = [
  { id: "q1", question: "What did Ben-Jochannan argue in 'Africa: Mother of Western Civilization' (1971)?", choices: ["Greek civilization had no African influence", "Kemet (ancient Egypt) was a Black African civilization that predated and influenced Greek thought", "Rome founded Egyptian civilization", "Egypt was populated only after 1000 CE"], correctIndex: 1, explanation: "His 1971 book argued Kemet's African identity and its influence on Greek philosophy and religion." },
  { id: "q2", question: "Which ancient Greek historian did Ben-Jochannan cite describing Egyptians as dark-skinned?", choices: ["Herodotus", "Plato", "Aristotle", "Homer"], correctIndex: 0, explanation: "Herodotus, in 'The Histories' (5th century BCE), described Egyptians as having dark skin and wooly hair." },
  { id: "q3", question: "Which university did Ben-Jochannan teach at in the early 1970s?", choices: ["Cornell University", "Harvard University", "Yale University", "Stanford University"], correctIndex: 0, explanation: "He taught in and helped shape Cornell's Africana Studies and Research Center, founded in 1969." },
  { id: "q4", question: "Which Senegalese scholar's work paralleled Ben-Jochannan's arguments?", choices: ["Cheikh Anta Diop", "Kwame Nkrumah", "Leopold Senghor", "Frantz Fanon"], correctIndex: 0, explanation: "Cheikh Anta Diop's 1974 book made a parallel case for ancient Egypt's African identity using melanin-dosage testing." },
];
const BENJ_QUIZ_10: QuizQuestion[] = [...BENJ_QUIZ_5,
  { id: "q5", question: "What historical event did the Kingdom of Kush achieve, confirmed by mainstream Egyptology?", choices: ["It was destroyed by Rome in year 1", "It conquered and ruled Egypt as its 25th Dynasty (c. 744-656 BCE)", "It never had contact with Egypt", "It was founded in 1900 CE"], correctIndex: 1, explanation: "Kush's rule over Egypt as the 25th Dynasty is a mainstream-confirmed historical fact Ben-Jochannan highlighted." },
  { id: "q6", question: "What was the 1974 UNESCO Cairo Symposium about?", choices: ["Modern Egyptian trade policy", "The peopling of ancient Egypt, where Afrocentric scholars presented their thesis to Egyptologists", "The Suez Canal", "Egyptian tourism"], correctIndex: 1, explanation: "The symposium debated ancient Egypt's population origins, with recorded disagreement between the two camps." },
];
const BENJ_QUIZ_15: QuizQuestion[] = [...BENJ_QUIZ_10,
  { id: "q7", question: "Which Greek philosophers did Ben-Jochannan argue studied in Egypt?", choices: ["Pythagoras and Solon", "Socrates and Descartes", "Confucius and Laozi", "Augustine and Aquinas"], correctIndex: 0, explanation: "Ancient accounts describe Pythagoras and Solon traveling to and studying in Egypt, which Ben-Jochannan cited as evidence of Greek philosophy's African roots." },
  { id: "q8", question: "What concept from Kemetic religion did Ben-Jochannan argue predates later traditions?", choices: ["The weighing of the heart against Ma'at in judgment of the soul", "The concept of a stock market", "Parliamentary democracy", "The Gregorian calendar"], correctIndex: 0, explanation: "He argued this Kemetic religious concept predates and influenced later Abrahamic and Greek religious ideas." },
];

// ---------------------------------------------------------------------------
// Dr. John Henrik Clarke — African People in World History
// ---------------------------------------------------------------------------

const CLARKE_BEATS: LectureBeat[] = [
  { id: "self-education", topic: "Self-Education and Rise", facts: [
    "John Henrik Clarke was born in 1915 in Union Springs, Alabama, and moved to Harlem in 1933, where he became largely self-educated at the Schomburg Center for Research in Black Culture.",
    "He was mentored there by bibliophile and historian Arturo Schomburg, whose personal collection formed the basis of the Schomburg Center.",
  ]},
  { id: "hunter-college", topic: "Founding Hunter College's Africana Program", facts: [
    "In 1969, Clarke helped found and chaired Hunter College's Department of Black and Puerto Rican Studies, now its Africana Studies department.",
    "He taught at Hunter College until 1988, training generations of students in African and African-American history.",
  ]},
  { id: "history-clock", topic: "'History Is a Clock'", facts: [
    "Clarke's signature teaching metaphor holds that history functions as a clock a people use to tell their political and cultural time of day.",
    "He argued a people without accurate knowledge of their own history cannot correctly orient their present political choices.",
  ]},
  { id: "garvey-legacy", topic: "Editing Marcus Garvey's Legacy", facts: [
    "Clarke edited 'Marcus Garvey and the Vision of Africa' (1974), documenting the Jamaican-born Pan-Africanist leader.",
    "Garvey founded the Universal Negro Improvement Association (UNIA) in 1914, which grew into one of the largest Black organizations in history by the early 1920s.",
  ]},
  { id: "nile-valley", topic: "Nile Valley and Kemet Scholarship", facts: [
    "Like contemporaries Cheikh Anta Diop and Yosef Ben-Jochannan, Clarke argued for the African identity of ancient Egyptian (Kemetic) civilization and its centrality to world history.",
    "Clarke helped organize academic conferences in the 1970s and 1980s bringing this Nile Valley scholarship into direct dialogue with mainstream Egyptology.",
  ]},
  { id: "songhai", topic: "The Songhai Empire and Timbuktu", facts: [
    "Clarke highlighted West African empires often excluded from world history curricula, including the Songhai Empire (circa 1464-1591).",
    "Timbuktu, a center of Songhai's Islamic scholarship, housed major manuscript libraries and a university tradition at Sankore Mosque.",
  ]},
  { id: "columbus-holocaust", topic: "Christopher Columbus and the African Holocaust (1992)", facts: [
    "In this 1992 book, Clarke reframed the transatlantic slave trade and European colonization as a demographic and cultural catastrophe for Africa and its diaspora.",
    "The book was published around the 500th anniversary of Columbus's 1492 voyage, deliberately challenging celebratory framing of that anniversary.",
  ]},
  { id: "nkrumah-panafricanism", topic: "Pan-Africanism and Kwame Nkrumah", facts: [
    "Clarke was closely associated with Kwame Nkrumah, the leader of Ghana's independence movement, spending time in Ghana in the early 1960s.",
    "Ghana became the first sub-Saharan African colony to gain independence from European colonial rule, in 1957, with Nkrumah as its first prime minister and later president.",
  ]},
  { id: "woodson-tradition", topic: "The Carter G. Woodson Tradition", facts: [
    "Clarke worked within the institutional tradition established by historian Carter G. Woodson, who founded Black History Week in 1926.",
    "Black History Week was later expanded into Black History Month, officially recognized by the U.S. federal government in 1976.",
  ]},
  { id: "eurocentric-critique", topic: "Critique of Eurocentric Historiography", facts: [
    "Clarke argued mainstream world history curricula systematically minimized African civilizations' contributions to writing, mathematics, architecture, and governance.",
    "He advocated including African civilizations alongside Greek, Roman, and Chinese civilizations in standard world history instruction.",
  ]},
  { id: "moorish-spain", topic: "Moorish Spain", facts: [
    "Clarke taught on the Moorish (North African Muslim) conquest and rule of the Iberian Peninsula, lasting from 711 CE until the fall of Granada in 1492.",
    "He emphasized Moorish Spain's role in preserving and transmitting classical Greek and Roman texts to medieval Europe via translation centers such as Toledo.",
  ]},
  { id: "clarke-legacy", topic: "Legacy and Honors", facts: [
    "Clarke received honorary doctorates and lectured internationally until his death in 1998.",
    "He is remembered as one of the foundational figures of the Black studies academic movement that expanded across U.S. universities in the late 20th century.",
  ]},
];

const CLARKE_QUIZ_5: QuizQuestion[] = [
  { id: "q1", question: "What is Clarke's signature metaphor for history?", choices: ["History is a mirror", "History is a clock a people use to tell their political and cultural time of day", "History is a weapon", "History is a puzzle"], correctIndex: 1, explanation: "Clarke's central teaching metaphor frames history as a clock orienting a people's present political identity." },
  { id: "q2", question: "What did Clarke help found at Hunter College in 1969?", choices: ["The Africana Studies department", "A law school", "A medical school", "A business school"], correctIndex: 0, explanation: "Clarke chaired Hunter College's Department of Black and Puerto Rican Studies, now Africana Studies, founded in 1969." },
  { id: "q3", question: "Whose legacy did Clarke document by editing a 1974 book?", choices: ["Marcus Garvey", "Booker T. Washington", "W.E.B. Du Bois", "Frederick Douglass"], correctIndex: 0, explanation: "Clarke edited 'Marcus Garvey and the Vision of Africa' (1974), documenting the Pan-Africanist UNIA founder." },
  { id: "q4", question: "What was the Songhai Empire?", choices: ["A Roman province", "A West African empire (c. 1464-1591) centered partly on Timbuktu's scholarship", "A Chinese dynasty", "A Caribbean colony"], correctIndex: 1, explanation: "The Songhai Empire was a major West African empire that Clarke argued belongs in standard world history curricula." },
];
const CLARKE_QUIZ_10: QuizQuestion[] = [...CLARKE_QUIZ_5,
  { id: "q5", question: "What did 'Christopher Columbus and the African Holocaust' (1992) reframe?", choices: ["The transatlantic slave trade and colonization as a catastrophe for Africa", "The 1929 stock market crash", "World War II", "The Industrial Revolution"], correctIndex: 0, explanation: "Clarke's 1992 book reframed the slave trade and colonization's devastating impact on Africa and its diaspora." },
  { id: "q6", question: "Which African independence leader was Clarke closely associated with?", choices: ["Kwame Nkrumah of Ghana", "Nelson Mandela of South Africa", "Julius Nyerere of Tanzania", "Jomo Kenyatta of Kenya"], correctIndex: 0, explanation: "Clarke spent time in Ghana in the early 1960s working alongside Kwame Nkrumah, Ghana's first president." },
];
const CLARKE_QUIZ_15: QuizQuestion[] = [...CLARKE_QUIZ_10,
  { id: "q7", question: "Whose tradition of Black History observance did Clarke work within?", choices: ["Carter G. Woodson, who founded Black History Week in 1926", "Booker T. Washington's Tuskegee model", "The Harlem Renaissance writers", "The Niagara Movement"], correctIndex: 0, explanation: "Woodson founded Black History Week in 1926, later expanded to Black History Month in 1976 — a tradition Clarke worked within." },
  { id: "q8", question: "How long did Moorish rule of the Iberian Peninsula last?", choices: ["711 CE to 1492 CE", "1000 CE to 1200 CE", "1492 CE to 1800 CE", "300 CE to 500 CE"], correctIndex: 0, explanation: "Moorish rule of Iberia lasted from 711 CE until the fall of Granada in 1492, a period Clarke taught extensively." },
];

// ---------------------------------------------------------------------------
// Neil deGrasse Tyson — The Universe, From the Big Bang to Us
// ---------------------------------------------------------------------------

const TYSON_BEATS: LectureBeat[] = [
  { id: "big-bang-age", topic: "The Big Bang and Cosmic Age", facts: [
    "The universe is approximately 13.8 billion years old, a figure derived from precision measurements of the cosmic microwave background by missions like WMAP and Planck.",
    "This age estimate is consistent across multiple independent methods, including the ages of the oldest known stars.",
  ]},
  { id: "cmb-discovery", topic: "Discovery of the Cosmic Microwave Background (1965)", facts: [
    "Arno Penzias and Robert Wilson accidentally detected the cosmic microwave background — residual heat from the Big Bang — in 1965 using a radio antenna in New Jersey.",
    "The discovery earned them the 1978 Nobel Prize in Physics and provided strong observational evidence for the Big Bang theory.",
  ]},
  { id: "hubbles-law", topic: "Hubble's Law (1929)", facts: [
    "In 1929, Edwin Hubble observed that galaxies are receding from us at speeds proportional to their distance, evidence for an expanding universe.",
    "This relationship, now called Hubble's Law, remains a cornerstone of modern cosmology.",
  ]},
  { id: "star-stuff", topic: "Stellar Nucleosynthesis: 'We Are Star Stuff'", facts: [
    "Elements heavier than hydrogen and helium — carbon, oxygen, iron — are forged inside stellar cores and in supernova explosions.",
    "These elements are recycled into new stars, planets, and living organisms, the basis for Tyson's frequent line that humans are made of 'star stuff.'",
  ]},
  { id: "hayden-planetarium", topic: "Tyson's Role at the Hayden Planetarium", facts: [
    "Tyson has served as director of the Hayden Planetarium at the American Museum of Natural History in New York since 1996.",
    "Under his direction, the planetarium was rebuilt as part of the Rose Center for Earth and Space, which opened in 2000.",
  ]},
  { id: "pluto", topic: "Pluto's Reclassification (2006)", facts: [
    "Tyson was a prominent, sometimes controversial, voice around the International Astronomical Union's 2006 decision to reclassify Pluto as a 'dwarf planet.'",
    "The reclassification followed the discovery of similarly sized Kuiper Belt objects, which raised the question of what should count as a full planet.",
  ]},
  { id: "cosmos-2014", topic: "Cosmos: A Spacetime Odyssey (2014)", facts: [
    "Tyson hosted this 13-episode series, a successor to Carl Sagan's 1980 'Cosmos: A Personal Voyage.'",
    "The series aired in over 180 countries and is estimated to have reached hundreds of millions of viewers worldwide.",
  ]},
  { id: "astrophysics-hurry", topic: "Astrophysics for People in a Hurry (2017)", facts: [
    "Tyson's best-selling 2017 book condenses cosmology, particle physics, and the scale of the universe into brief, accessible chapters.",
    "It topped best-seller lists and became one of the most widely read popular science books of its decade.",
  ]},
  { id: "dark-matter-energy", topic: "Dark Matter and Dark Energy", facts: [
    "Measurements from the Planck satellite indicate roughly 27% of the universe's mass-energy is dark matter and about 68% is dark energy.",
    "Ordinary visible matter — everything we can directly observe — makes up less than 5% of the universe's total mass-energy content.",
  ]},
  { id: "tyson-academic-path", topic: "Tyson's Academic Path", facts: [
    "Tyson earned his Ph.D. in astrophysics from Columbia University in 1991, after undergraduate study at Harvard and a master's degree from the University of Texas at Austin.",
    "His doctoral research focused on stellar formation and the structure of the Milky Way's galactic bulge.",
  ]},
  { id: "redshift", topic: "The Doppler Shift and Redshift", facts: [
    "Astronomers determine a galaxy's motion and distance using redshift — the stretching of light wavelengths as an object moves away from an observer.",
    "Redshift measurements were central to Hubble's 1929 discovery of the universe's expansion.",
  ]},
  { id: "science-literacy", topic: "Science Communication and Public Trust", facts: [
    "Tyson frequently argues scientific literacy is a civic necessity, emphasizing that valid scientific claims must be falsifiable and testable.",
    "He has testified before the U.S. Congress on the importance of federal investment in space science and STEM education funding.",
  ]},
];

const TYSON_QUIZ_5: QuizQuestion[] = [
  { id: "q1", question: "Approximately how old is the universe according to modern cosmology?", choices: ["4.5 billion years", "13.8 billion years", "1 million years", "100 billion years"], correctIndex: 1, explanation: "The universe's age, roughly 13.8 billion years, comes from CMB measurements by missions like WMAP and Planck." },
  { id: "q2", question: "Who discovered the cosmic microwave background in 1965?", choices: ["Edwin Hubble", "Arno Penzias and Robert Wilson", "Albert Einstein", "Carl Sagan"], correctIndex: 1, explanation: "Penzias and Wilson accidentally detected the CMB in 1965, earning the 1978 Nobel Prize in Physics." },
  { id: "q3", question: "What did Edwin Hubble observe in 1929?", choices: ["Black holes", "Galaxies receding at speeds proportional to their distance", "The Big Bang directly", "Dark matter"], correctIndex: 1, explanation: "Hubble's 1929 observation of galactic recession became the foundational evidence for an expanding universe." },
  { id: "q4", question: "What does Tyson mean by 'we are star stuff'?", choices: ["Humans came from another planet", "Elements in our bodies were forged in stellar cores and supernovae", "Humans can survive in space", "Stars are made of human cells"], correctIndex: 1, explanation: "Heavier elements like carbon and oxygen are forged in stars and supernovae, later becoming part of planets and living things." },
];
const TYSON_QUIZ_10: QuizQuestion[] = [...TYSON_QUIZ_5,
  { id: "q5", question: "What happened to Pluto in 2006?", choices: ["It was destroyed", "It was reclassified as a 'dwarf planet' by the IAU", "It was renamed", "It merged with Neptune"], correctIndex: 1, explanation: "The International Astronomical Union reclassified Pluto as a dwarf planet in 2006, a decision Tyson was prominently involved in." },
  { id: "q6", question: "Where has Tyson served as director since 1996?", choices: ["NASA", "The Hayden Planetarium", "MIT", "The Smithsonian"], correctIndex: 1, explanation: "Tyson has directed the Hayden Planetarium at the American Museum of Natural History since 1996." },
];
const TYSON_QUIZ_15: QuizQuestion[] = [...TYSON_QUIZ_10,
  { id: "q7", question: "Roughly what percentage of the universe's mass-energy is dark energy, per Planck satellite data?", choices: ["About 5%", "About 27%", "About 68%", "About 99%"], correctIndex: 2, explanation: "Planck satellite data estimates dark energy makes up roughly 68% of the universe's mass-energy." },
  { id: "q8", question: "What measurement was central to Hubble's 1929 discovery of cosmic expansion?", choices: ["Redshift of light from galaxies", "Radio wave frequency", "Gravitational lensing", "Neutrino counts"], correctIndex: 0, explanation: "Redshift — the stretching of light wavelengths from receding galaxies — was central to detecting cosmic expansion." },
];

// ---------------------------------------------------------------------------
// Professor Jiang Wei — Power, Philosophy, and the Shape of Nations
// ---------------------------------------------------------------------------

const JIANG_BEATS: LectureBeat[] = [
  { id: "thucydides-trap", topic: "Thucydides and the Origins of Great-Power Fear", facts: [
    "Thucydides's 'History of the Peloponnesian War' (circa 400 BCE) describes Sparta's fear of a rising Athens as the war's underlying cause.",
    "This dynamic gave rise to the modern term 'Thucydides Trap,' describing structural tension between a rising power and an established one.",
  ]},
  { id: "westphalia", topic: "The Peace of Westphalia (1648)", facts: [
    "The Peace of Westphalia in 1648 ended the Thirty Years' War and established the modern principle of state sovereignty.",
    "This settlement is widely credited as the foundation of the modern international system of nation-states still used today.",
  ]},
  { id: "congress-of-vienna", topic: "The Congress of Vienna (1814-1815)", facts: [
    "The Congress of Vienna reorganized Europe's borders and power balance after the Napoleonic Wars.",
    "The resulting balance-of-power system helped prevent another major continental war in Europe for roughly a century, until World War I in 1914.",
  ]},
  { id: "art-of-war", topic: "Sun Tzu's The Art of War", facts: [
    "'The Art of War,' attributed to Sun Tzu and dated to roughly the 5th century BCE, emphasizes deception, terrain, and winning conflicts without direct battle.",
    "The text remains widely studied today in military academies and business strategy programs worldwide.",
  ]},
  { id: "bretton-woods", topic: "The Bretton Woods Conference (1944)", facts: [
    "The 1944 Bretton Woods Conference established the post-World War II international monetary system, including the IMF and World Bank.",
    "It anchored the U.S. dollar, initially convertible to gold, as the global reserve currency — a system that lasted until 1971.",
  ]},
  { id: "cold-war-order", topic: "The Cold War's Bipolar Order (1947-1991)", facts: [
    "The U.S.-Soviet rivalry structured global alliances, including NATO (founded 1949) and the Warsaw Pact (founded 1955).",
    "This bipolar order ended with the Soviet Union's dissolution in 1991.",
  ]},
  { id: "kissinger-realpolitik", topic: "Kissinger's Realpolitik", facts: [
    "Henry Kissinger's diplomacy, including the 1972 opening to China during the Nixon administration, exemplified realist balance-of-power strategy prioritizing state interest.",
    "Kissinger was awarded the Nobel Peace Prize in 1973 for negotiating a ceasefire in the Vietnam War, a decision that remains historically contested.",
  ]},
  { id: "china-reform", topic: "China's Reform and Opening (1978)", facts: [
    "Deng Xiaoping's economic reforms, beginning in 1978, shifted China toward market mechanisms after decades of central planning.",
    "The reforms preceded China's rise to become the world's second-largest economy by nominal GDP.",
  ]},
  { id: "belt-and-road", topic: "The Belt and Road Initiative (2013)", facts: [
    "China launched the Belt and Road Initiative in 2013, a global infrastructure investment program spanning over 140 countries by the early 2020s.",
    "Analysts widely study the initiative as both a development program and an instrument of geopolitical and economic influence.",
  ]},
  { id: "offensive-realism", topic: "Mearsheimer's Offensive Realism", facts: [
    "Political scientist John Mearsheimer's theory of offensive realism argues great powers inherently seek regional hegemony due to the anarchic structure of the international system.",
    "The theory remains a major framework taught in international relations programs for analyzing great-power competition.",
  ]},
  { id: "un-security-council", topic: "The UN Security Council's Permanent Five", facts: [
    "Founded in 1945, the UN Security Council gives veto power to five permanent members: the United States, United Kingdom, France, Russia (as the Soviet Union's successor), and China.",
    "This structure reflects the post-World War II power distribution and still governs key decisions in international law today.",
  ]},
  { id: "globalization-discontents", topic: "Globalization and Its Discontents", facts: [
    "Economist Joseph Stiglitz's 2002 book 'Globalization and Its Discontents' argued global economic institutions like the IMF often prioritized creditor interests over developing-nation stability.",
    "The book, written after Stiglitz's tenure as World Bank chief economist, fueled ongoing debate over the fairness of the current international economic order.",
  ]},
];

const JIANG_QUIZ_5: QuizQuestion[] = [
  { id: "q1", question: "What does the 'Thucydides Trap' describe?", choices: ["A naval battle tactic", "Structural tension between a rising power and an established one, from Thucydides's account of Sparta and Athens", "A trade agreement", "A UN voting rule"], correctIndex: 1, explanation: "Thucydides described Sparta's fear of rising Athens as the Peloponnesian War's underlying cause, giving rise to this modern term." },
  { id: "q2", question: "What did the Peace of Westphalia (1648) establish?", choices: ["The United Nations", "The modern principle of state sovereignty", "The gold standard", "The European Union"], correctIndex: 1, explanation: "Westphalia ended the Thirty Years' War and founded the modern nation-state system based on sovereignty." },
  { id: "q3", question: "What did the 1944 Bretton Woods Conference establish?", choices: ["NATO", "The IMF, World Bank, and a US-dollar-anchored monetary system", "The European Union", "The League of Nations"], correctIndex: 1, explanation: "Bretton Woods created the IMF and World Bank and anchored the dollar as the global reserve currency." },
  { id: "q4", question: "Who wrote 'The Art of War'?", choices: ["Confucius", "Sun Tzu", "Machiavelli", "Herodotus"], correctIndex: 1, explanation: "Sun Tzu's 'The Art of War,' dated to roughly the 5th century BCE, remains studied in military and business strategy today." },
];
const JIANG_QUIZ_10: QuizQuestion[] = [...JIANG_QUIZ_5,
  { id: "q5", question: "What ended the Cold War's bipolar order?", choices: ["The fall of the Berlin Wall alone", "The Soviet Union's dissolution in 1991", "World War II", "The Korean War"], correctIndex: 1, explanation: "The Cold War's bipolar U.S.-Soviet order ended with the Soviet Union's dissolution in 1991." },
  { id: "q6", question: "What economic shift began in China in 1978?", choices: ["Full nationalization of industry", "Deng Xiaoping's reform and opening toward market mechanisms", "Joining NATO", "Adopting the gold standard"], correctIndex: 1, explanation: "Deng Xiaoping's 1978 reforms shifted China toward market mechanisms, preceding its rise as the world's second-largest economy." },
];
const JIANG_QUIZ_15: QuizQuestion[] = [...JIANG_QUIZ_10,
  { id: "q7", question: "What does Mearsheimer's 'offensive realism' argue?", choices: ["Great powers always cooperate", "Great powers inherently seek regional hegemony due to international anarchy", "War is always avoidable through trade", "Small states control global outcomes"], correctIndex: 1, explanation: "Mearsheimer's theory argues the anarchic structure of the international system drives great powers to seek regional hegemony." },
  { id: "q8", question: "Which five countries hold veto power on the UN Security Council?", choices: ["Germany, Japan, Italy, Brazil, India", "US, UK, France, Russia, China", "US, Canada, Mexico, Brazil, Argentina", "China, India, Russia, Japan, Australia"], correctIndex: 1, explanation: "The UN Security Council's five permanent veto-holding members, set in 1945, are the US, UK, France, Russia, and China." },
];

// ---------------------------------------------------------------------------
// Dr. Carl Sagan — The Scientific Method and the Modern World
// ---------------------------------------------------------------------------

const SAGAN_BEATS: LectureBeat[] = [
  { id: "cosmos-1980", topic: "Cosmos: A Personal Voyage (1980)", facts: [
    "Sagan's 13-part PBS series 'Cosmos: A Personal Voyage' (1980) became, at the time, the most widely watched series in American public television history.",
    "It was seen by an estimated 500 million people across 60 countries.",
  ]},
  { id: "baloney-detection", topic: "The Baloney Detection Kit", facts: [
    "In 'The Demon-Haunted World: Science as a Candle in the Dark' (1995), Sagan outlined tools for skeptical thinking, including independent confirmation of facts and encouraging genuine debate.",
    "The kit also warned against arguments from authority and emphasized testing hypotheses rigorously before accepting them.",
  ]},
  { id: "pale-blue-dot", topic: "The Pale Blue Dot Photograph (1990)", facts: [
    "At Sagan's request, Voyager 1 turned its camera back toward Earth from about 3.7 billion miles away in 1990, capturing Earth as a single pixel of light.",
    "The photograph inspired Sagan's 1994 book 'Pale Blue Dot: A Vision of the Human Future in Space.'",
  ]},
  { id: "golden-record", topic: "The Voyager Golden Record (1977)", facts: [
    "Sagan led the committee that created the Voyager Golden Record, containing sounds, images, and music representing Earth.",
    "The records were attached to the Voyager 1 and Voyager 2 spacecraft, both launched in 1977 and now traveling beyond our solar system.",
  ]},
  { id: "viking-missions", topic: "Sagan's Role in the Viking Mars Missions (1976)", facts: [
    "Sagan helped design life-detection experiments for NASA's Viking 1 and Viking 2 landers, which touched down on Mars in 1976.",
    "The missions searched for signs of microbial life in Martian soil, producing ambiguous but historically significant results.",
  ]},
  { id: "planetary-society", topic: "Founding The Planetary Society (1980)", facts: [
    "In 1980, Sagan co-founded The Planetary Society with Bruce Murray and Louis Friedman to advocate for space exploration and the search for extraterrestrial life.",
    "It remains the largest nonprofit space-interest organization in the world.",
  ]},
  { id: "scientific-method", topic: "The Scientific Method Defined", facts: [
    "Sagan repeatedly emphasized that a claim only counts as scientific if it is falsifiable — capable, in principle, of being proven wrong by evidence.",
    "He argued reproducibility of results across independent researchers is essential to distinguishing science from pseudoscience.",
  ]},
  { id: "extraordinary-claims", topic: "'Extraordinary Claims Require Extraordinary Evidence'", facts: [
    "This principle, one of Sagan's most quoted lines, appears throughout 'The Demon-Haunted World' applied to UFO claims and pseudoscience.",
    "It holds that the more a claim contradicts established, well-tested knowledge, the stronger the evidence required to accept it.",
  ]},
  { id: "nuclear-winter", topic: "Nuclear Winter Research (1983)", facts: [
    "Sagan co-authored the 1983 'TTAPS' study, warning that large-scale nuclear war could trigger catastrophic global cooling from atmospheric soot and smoke.",
    "The research influenced Cold War-era disarmament debate and public understanding of nuclear war's climatic consequences.",
  ]},
  { id: "contact-novel", topic: "Contact (1985 novel, 1997 film)", facts: [
    "Sagan's 1985 novel 'Contact' dramatized first contact with extraterrestrial intelligence, grounded in real SETI (Search for Extraterrestrial Intelligence) science.",
    "It was adapted into a 1997 film starring Jodie Foster, released after Sagan's death in 1996.",
  ]},
  { id: "sagan-academic-path", topic: "Sagan's Academic Career", facts: [
    "Sagan earned his Ph.D. in astronomy and astrophysics from the University of Chicago in 1960.",
    "He became a professor at Cornell University, where he directed the Laboratory for Planetary Studies for decades.",
  ]},
  { id: "sagan-legacy", topic: "Legacy After Death (1996)", facts: [
    "Sagan died in 1996 from pneumonia following a long battle with myelodysplasia.",
    "In 2014, Neil deGrasse Tyson continued Sagan's legacy by hosting 'Cosmos: A Spacetime Odyssey,' explicitly framed as a successor to Sagan's original series.",
  ]},
];

const SAGAN_QUIZ_5: QuizQuestion[] = [
  { id: "q1", question: "How many people is Sagan's 1980 'Cosmos' series estimated to have reached?", choices: ["About 1 million", "About 500 million across 60 countries", "About 10,000", "About 2 billion"], correctIndex: 1, explanation: "'Cosmos: A Personal Voyage' (1980) reached an estimated 500 million viewers across 60 countries." },
  { id: "q2", question: "What is the 'Pale Blue Dot' photograph?", choices: ["A picture of Mars", "An image of Earth as a single pixel, taken by Voyager 1 from 3.7 billion miles away", "A photo of Jupiter's moons", "A picture of the Sun"], correctIndex: 1, explanation: "Sagan requested Voyager 1 photograph Earth from deep space in 1990, inspiring his 1994 book of the same theme." },
  { id: "q3", question: "What was the Voyager Golden Record?", choices: ["A vinyl record sold in stores", "A recording of Earth's sounds, images, and music attached to the Voyager spacecraft", "A NASA budget document", "A star map"], correctIndex: 1, explanation: "Sagan led the committee creating this record, attached to both Voyager spacecraft launched in 1977." },
  { id: "q4", question: "What defines a claim as 'scientific,' per Sagan?", choices: ["It must be popular", "It must be falsifiable — able in principle to be proven wrong by evidence", "It must come from a professor", "It must be unchallengeable"], correctIndex: 1, explanation: "Sagan repeatedly emphasized falsifiability as the core requirement for a scientific claim." },
];
const SAGAN_QUIZ_10: QuizQuestion[] = [...SAGAN_QUIZ_5,
  { id: "q5", question: "What organization did Sagan co-found in 1980?", choices: ["NASA", "The Planetary Society", "SETI Institute", "The National Science Foundation"], correctIndex: 1, explanation: "Sagan co-founded The Planetary Society in 1980 with Bruce Murray and Louis Friedman." },
  { id: "q6", question: "What did the 1983 'TTAPS' study warn about?", choices: ["Ozone depletion", "Catastrophic global cooling ('nuclear winter') from a large-scale nuclear war", "Overfishing", "Solar flares"], correctIndex: 1, explanation: "Sagan co-authored this study warning of nuclear winter, influencing Cold War disarmament debate." },
];
const SAGAN_QUIZ_15: QuizQuestion[] = [...SAGAN_QUIZ_10,
  { id: "q7", question: "What phrase is Sagan famous for regarding unusual claims?", choices: ["'Seeing is believing'", "'Extraordinary claims require extraordinary evidence'", "'Ignorance is bliss'", "'The customer is always right'"], correctIndex: 1, explanation: "This principle from 'The Demon-Haunted World' requires stronger evidence for claims that contradict established knowledge." },
  { id: "q8", question: "Who continued Sagan's 'Cosmos' legacy in 2014?", choices: ["Neil deGrasse Tyson", "Stephen Hawking", "Bill Nye", "Brian Cox"], correctIndex: 0, explanation: "Tyson hosted 'Cosmos: A Spacetime Odyssey' (2014) as an explicit successor to Sagan's 1980 series." },
];

export const DC_UNIVERSITY_COURSES: DcUniversityCourse[] = [
  {
    id: "history-west",
    departmentId: "history",
    departmentLabel: "History",
    educatorId: "cornellwest",
    educatorName: "Dr. Cornel West",
    educatorTitle: "Philosopher & Historian of the American Moral Struggle",
    courseTitle: "The Moral Struggle for American Democracy",
    courseDescription: "From the Founding's contradictions through Reconstruction, Jim Crow, the Civil Rights Movement, and today — taught as a living moral and philosophical struggle, not just a timeline.",
    beats: WEST_BEATS,
    lengths: {
      5: { minutes: 5, tokenCost: 5, beatCount: 4, quiz: WEST_QUIZ_5 },
      10: { minutes: 10, tokenCost: 10, beatCount: 8, quiz: WEST_QUIZ_10 },
      15: { minutes: 15, tokenCost: 15, beatCount: 12, quiz: WEST_QUIZ_15 },
    },
    books: [
      { title: "Race Matters", author: "Cornel West", note: "West's landmark diagnosis of race, nihilism, and democracy in America.", url: amazonSearch("Race Matters Cornel West book") },
      { title: "Democracy Matters", author: "Cornel West", note: "West's follow-up on democracy, empire, and the prophetic tradition.", url: amazonSearch("Democracy Matters Cornel West book") },
      { title: "The Autobiography of Malcolm X", author: "Malcolm X & Alex Haley", note: "Essential primary-source reading on Black Power and self-determination.", url: amazonSearch("Autobiography of Malcolm X book") },
    ],
  },
  {
    id: "economics-wolff",
    departmentId: "economics",
    departmentLabel: "Economics",
    educatorId: "richardwolff",
    educatorName: "Professor Richard Wolff",
    educatorTitle: "Marxian Economist, UMass Amherst",
    courseTitle: "How Capitalism Actually Works",
    courseDescription: "A structural look at markets, labor, and class from a leading Marxian economist.",
    beats: WOLFF_BEATS,
    lengths: {
      5: { minutes: 5, tokenCost: 5, beatCount: 4, quiz: WOLFF_QUIZ_5 },
      10: { minutes: 10, tokenCost: 10, beatCount: 8, quiz: WOLFF_QUIZ_10 },
      15: { minutes: 15, tokenCost: 15, beatCount: 12, quiz: WOLFF_QUIZ_15 },
    },
    books: [
      { title: "Understanding Marxism", author: "Richard Wolff", note: "Wolff's accessible primer on Marxist economic theory.", url: amazonSearch("Understanding Marxism Richard Wolff book") },
      { title: "Democracy at Work", author: "Richard Wolff", note: "Wolff's case for Worker Self-Directed Enterprises.", url: amazonSearch("Democracy at Work Richard Wolff book") },
      { title: "Capital, Volume I", author: "Karl Marx", note: "The foundational text on surplus value Wolff teaches from.", url: amazonSearch("Capital Volume 1 Karl Marx book") },
    ],
  },
  {
    id: "geopolitics-sachs",
    departmentId: "geopolitics",
    departmentLabel: "Geopolitics",
    educatorId: "jeffreysachs",
    educatorName: "Professor Jeffrey Sachs",
    educatorTitle: "Development Economist, Columbia University",
    courseTitle: "Global Development and the New World Order",
    courseDescription: "Four decades of advising governments and the UN, distilled into the forces shaping global power and poverty.",
    beats: SACHS_BEATS,
    lengths: {
      5: { minutes: 5, tokenCost: 5, beatCount: 4, quiz: SACHS_QUIZ_5 },
      10: { minutes: 10, tokenCost: 10, beatCount: 8, quiz: SACHS_QUIZ_10 },
      15: { minutes: 15, tokenCost: 15, beatCount: 12, quiz: SACHS_QUIZ_15 },
    },
    books: [
      { title: "The End of Poverty", author: "Jeffrey Sachs", note: "Sachs's roadmap for eliminating extreme global poverty.", url: amazonSearch("The End of Poverty Jeffrey Sachs book") },
      { title: "The Ages of Globalization", author: "Jeffrey Sachs", note: "Seven historical waves of globalization, from prehistory to today.", url: amazonSearch("The Ages of Globalization Jeffrey Sachs book") },
      { title: "Common Wealth", author: "Jeffrey Sachs", note: "Economics for a crowded, resource-constrained planet.", url: amazonSearch("Common Wealth Jeffrey Sachs book") },
    ],
  },
  {
    id: "econhistory-anderson",
    departmentId: "economics",
    departmentLabel: "Black History & Economics",
    educatorId: "claudeanderson",
    educatorName: "Dr. Claud Anderson",
    educatorTitle: "Economist & Author of 'Powernomics'",
    courseTitle: "Black Labor, White Wealth",
    courseDescription: "The economic history of Black America — group economics, wealth extraction, and the path to economic power.",
    beats: ANDERSON_BEATS,
    lengths: {
      5: { minutes: 5, tokenCost: 5, beatCount: 4, quiz: ANDERSON_QUIZ_5 },
      10: { minutes: 10, tokenCost: 10, beatCount: 8, quiz: ANDERSON_QUIZ_10 },
      15: { minutes: 15, tokenCost: 15, beatCount: 12, quiz: ANDERSON_QUIZ_15 },
    },
    books: [
      { title: "PowerNomics", author: "Dr. Claud Anderson", note: "Anderson's national plan to empower Black America economically.", url: amazonSearch("PowerNomics Claud Anderson book") },
      { title: "Black Labor, White Wealth", author: "Dr. Claud Anderson", note: "Anderson's history of Black labor and white wealth accumulation.", url: amazonSearch("Black Labor White Wealth Claud Anderson book") },
    ],
  },
  {
    id: "philosophy-benjochannan",
    departmentId: "philosophy",
    departmentLabel: "Ancient African History & Philosophy",
    educatorId: "drbenj",
    educatorName: "Dr. Yosef Ben-Jochannan",
    educatorTitle: "Afrocentric Historian & Scholar",
    courseTitle: "Africa: The Cradle of Civilization",
    courseDescription: "Ancient Kemet, Nubia, and the African origins of world civilization, taught by a lifelong scholar of primary sources.",
    beats: BENJ_BEATS,
    lengths: {
      5: { minutes: 5, tokenCost: 5, beatCount: 4, quiz: BENJ_QUIZ_5 },
      10: { minutes: 10, tokenCost: 10, beatCount: 8, quiz: BENJ_QUIZ_10 },
      15: { minutes: 15, tokenCost: 15, beatCount: 12, quiz: BENJ_QUIZ_15 },
    },
    books: [
      { title: "Africa: Mother of Western Civilization", author: "Dr. Yosef Ben-Jochannan", note: "Ben-Jochannan's foundational Afrocentric text.", url: amazonSearch("Africa Mother of Western Civilization Ben-Jochannan book") },
      { title: "Black Man of the Nile and His Family", author: "Dr. Yosef Ben-Jochannan", note: "Primary-source arguments for African origins of Nile Valley civilization.", url: amazonSearch("Black Man of the Nile Ben-Jochannan book") },
      { title: "The African Origin of Civilization", author: "Cheikh Anta Diop", note: "Diop's parallel scholarship on ancient Egypt's African identity.", url: amazonSearch("African Origin of Civilization Cheikh Anta Diop book") },
    ],
  },
  {
    id: "history-clarke",
    departmentId: "history",
    departmentLabel: "African & American History",
    educatorId: "clarke",
    educatorName: "Dr. John Henrik Clarke",
    educatorTitle: "Pan-Africanist Historian, Hunter College",
    courseTitle: "African People in World History",
    courseDescription: "Reclaiming the record — African civilizations, the diaspora, and their role across world history.",
    beats: CLARKE_BEATS,
    lengths: {
      5: { minutes: 5, tokenCost: 5, beatCount: 4, quiz: CLARKE_QUIZ_5 },
      10: { minutes: 10, tokenCost: 10, beatCount: 8, quiz: CLARKE_QUIZ_10 },
      15: { minutes: 15, tokenCost: 15, beatCount: 12, quiz: CLARKE_QUIZ_15 },
    },
    books: [
      { title: "African People in World History", author: "Dr. John Henrik Clarke", note: "Clarke's survey reclaiming Africa's place in the world historical record.", url: amazonSearch("African People in World History John Henrik Clarke book") },
      { title: "Marcus Garvey and the Vision of Africa", author: "ed. John Henrik Clarke", note: "Clarke's edited documentary history of the Pan-Africanist leader.", url: amazonSearch("Marcus Garvey and the Vision of Africa John Henrik Clarke book") },
    ],
  },
  {
    id: "science-tyson",
    departmentId: "science",
    departmentLabel: "Astrophysics & the Cosmos",
    educatorId: "neiltyson",
    educatorName: "Neil deGrasse Tyson",
    educatorTitle: "Astrophysicist, Hayden Planetarium",
    courseTitle: "The Universe, From the Big Bang to Us",
    courseDescription: "Cosmology and astrophysics made vivid and personal, from a lifelong science communicator.",
    beats: TYSON_BEATS,
    lengths: {
      5: { minutes: 5, tokenCost: 5, beatCount: 4, quiz: TYSON_QUIZ_5 },
      10: { minutes: 10, tokenCost: 10, beatCount: 8, quiz: TYSON_QUIZ_10 },
      15: { minutes: 15, tokenCost: 15, beatCount: 12, quiz: TYSON_QUIZ_15 },
    },
    books: [
      { title: "Astrophysics for People in a Hurry", author: "Neil deGrasse Tyson", note: "Tyson's best-selling crash course in cosmology.", url: amazonSearch("Astrophysics for People in a Hurry Neil deGrasse Tyson book") },
      { title: "Cosmos: Possible Worlds", author: "Neil deGrasse Tyson", note: "Companion book to Tyson's Cosmos television series.", url: amazonSearch("Cosmos Possible Worlds Neil deGrasse Tyson book") },
      { title: "Death by Black Hole", author: "Neil deGrasse Tyson", note: "Tyson's essay collection on cosmic mysteries.", url: amazonSearch("Death by Black Hole Neil deGrasse Tyson book") },
    ],
  },
  {
    id: "geopolitics-jiang",
    departmentId: "geopolitics",
    departmentLabel: "World History, Philosophy & Geopolitics",
    educatorId: "professorjiang",
    educatorName: "Professor Jiang Wei",
    educatorTitle: "Political Economist, Harvard PhD",
    courseTitle: "Power, Philosophy, and the Shape of Nations",
    courseDescription: "World history and philosophy through the lens of great-power competition and geopolitical strategy.",
    beats: JIANG_BEATS,
    lengths: {
      5: { minutes: 5, tokenCost: 5, beatCount: 4, quiz: JIANG_QUIZ_5 },
      10: { minutes: 10, tokenCost: 10, beatCount: 8, quiz: JIANG_QUIZ_10 },
      15: { minutes: 15, tokenCost: 15, beatCount: 12, quiz: JIANG_QUIZ_15 },
    },
    books: [
      { title: "The Art of War", author: "Sun Tzu", note: "The classical strategy text referenced throughout the course.", url: amazonSearch("The Art of War Sun Tzu book") },
      { title: "The Tragedy of Great Power Politics", author: "John Mearsheimer", note: "The offensive realism framework covered in the geopolitics unit.", url: amazonSearch("Tragedy of Great Power Politics Mearsheimer book") },
      { title: "Globalization and Its Discontents", author: "Joseph Stiglitz", note: "Stiglitz's critique of global economic institutions.", url: amazonSearch("Globalization and Its Discontents Stiglitz book") },
    ],
  },
  {
    id: "science-sagan",
    departmentId: "science",
    departmentLabel: "Science & Cutting-Edge Technology",
    educatorId: "carlsagan",
    educatorName: "Dr. Carl Sagan",
    educatorTitle: "Astronomer & Author of 'Cosmos'",
    courseTitle: "The Scientific Method and the Modern World",
    courseDescription: "How science actually works, and why skepticism paired with wonder is humanity's best tool.",
    beats: SAGAN_BEATS,
    lengths: {
      5: { minutes: 5, tokenCost: 5, beatCount: 4, quiz: SAGAN_QUIZ_5 },
      10: { minutes: 10, tokenCost: 10, beatCount: 8, quiz: SAGAN_QUIZ_10 },
      15: { minutes: 15, tokenCost: 15, beatCount: 12, quiz: SAGAN_QUIZ_15 },
    },
    books: [
      { title: "Cosmos", author: "Carl Sagan", note: "Sagan's landmark book companion to the original TV series.", url: amazonSearch("Cosmos Carl Sagan book") },
      { title: "The Demon-Haunted World", author: "Carl Sagan", note: "Sagan's guide to skepticism and the scientific method.", url: amazonSearch("The Demon-Haunted World Carl Sagan book") },
      { title: "Pale Blue Dot", author: "Carl Sagan", note: "Sagan's reflection on humanity's place in the cosmos.", url: amazonSearch("Pale Blue Dot Carl Sagan book") },
    ],
  },
];

export function getDcCourse(courseId: string): DcUniversityCourse | undefined {
  return DC_UNIVERSITY_COURSES.find((c) => c.id === courseId);
}

export function getDcBeatsForLength(course: DcUniversityCourse, minutes: LectureMinutes): LectureBeat[] {
  const count = course.lengths[minutes]?.beatCount || 0;
  return course.beats.slice(0, count);
}

export interface DcFactOfDay {
  courseId: string;
  educatorId: string;
  educatorName: string;
  courseTitle: string;
  fact: string;
}

// Deterministic "fact of the day" — same seed (e.g. day-of-year) always picks
// the same course/beat/fact so every user sees the same fact until it rolls
// over, without needing to persist anything server-side.
export function getDcFactOfDay(seed: number): DcFactOfDay {
  const courses = DC_UNIVERSITY_COURSES;
  const course = courses[seed % courses.length];
  const beat = course.beats[Math.floor(seed / courses.length) % course.beats.length];
  const fact = beat.facts[seed % beat.facts.length];
  return {
    courseId: course.id,
    educatorId: course.educatorId,
    educatorName: course.educatorName,
    courseTitle: course.courseTitle,
    fact,
  };
}

// Weekly engagement schedule — bonus DC Points for attending class on themed
// days. Day index matches JS Date.getDay() (0 = Sunday).
export const DC_WEEKLY_SCHEDULE: { day: number; label: string; bonusPoints: number; blurb: string }[] = [
  { day: 1, label: "Motivation Monday", bonusPoints: 3, blurb: "Kick off the week with a lecture — earn bonus DC Points." },
  { day: 2, label: "Truth Tuesday", bonusPoints: 2, blurb: "Double down on the facts." },
  { day: 3, label: "Wisdom Wednesday", bonusPoints: 3, blurb: "Midweek wisdom bonus." },
  { day: 4, label: "Think-Deep Thursday", bonusPoints: 2, blurb: "Go a level deeper." },
  { day: 5, label: "Finals Friday", bonusPoints: 5, blurb: "Biggest bonus of the week — finish strong." },
  { day: 6, label: "Scholar Saturday", bonusPoints: 2, blurb: "Weekend scholars earn extra." },
  { day: 0, label: "Study Sunday", bonusPoints: 2, blurb: "Prep for the week ahead." },
];

export const DC_LEVELS: { name: string; minPoints: number; reward: string }[] = [
  { name: "Freshman", minPoints: 0, reward: "" },
  { name: "Sophomore", minPoints: 25, reward: "1 bonus DC Token" },
  { name: "Junior", minPoints: 60, reward: "3 bonus DC Tokens" },
  { name: "Senior", minPoints: 120, reward: "5 bonus DC Tokens + exclusive certificate border" },
  { name: "Dean's List", minPoints: 220, reward: "10 bonus DC Tokens + Dean's List badge" },
  { name: "DC Laureate", minPoints: 400, reward: "20 bonus DC Tokens + DC Laureate badge + featured on leaderboard" },
];

export function computeLevel(points: number): { name: string; next?: { name: string; pointsToGo: number } } {
  let current = DC_LEVELS[0];
  for (const lvl of DC_LEVELS) {
    if (points >= lvl.minPoints) current = lvl;
  }
  const idx = DC_LEVELS.indexOf(current);
  const next = DC_LEVELS[idx + 1];
  return { name: current.name, next: next ? { name: next.name, pointsToGo: next.minPoints - points } : undefined };
}
