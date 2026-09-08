// DC University — curriculum content.
//
// Each course maps to an existing arena/interview persona (see
// ARENA_PERSONA_PROMPTS in server/routes.ts) so lecture generation reuses the
// same OpenAI + Fish Audio pipeline already powering Arena/Interview mode.
//
// Content policy: every "facts" bullet below must be a well-established,
// mainstream-consensus historical/scientific fact (dates, documents, events,
// publications) — never a live AI invention. The persona's AI voice is
// instructed to TEACH from these curated facts in its own cadence, not to
// invent new claims. This is how we keep lectures accurate without literal
// third-party peer review.

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
  comingSoon?: boolean;
}

// ---------------------------------------------------------------------------
// LIVE COURSE — Dr. Cornel West — American History & the Moral Struggle for
// Democracy (vertical-slice course; fully built end-to-end)
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
    beats: [],
    lengths: { 5: { minutes: 5, tokenCost: 5, beatCount: 0, quiz: [] }, 10: { minutes: 10, tokenCost: 10, beatCount: 0, quiz: [] }, 15: { minutes: 15, tokenCost: 15, beatCount: 0, quiz: [] } },
    comingSoon: true,
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
    beats: [],
    lengths: { 5: { minutes: 5, tokenCost: 5, beatCount: 0, quiz: [] }, 10: { minutes: 10, tokenCost: 10, beatCount: 0, quiz: [] }, 15: { minutes: 15, tokenCost: 15, beatCount: 0, quiz: [] } },
    comingSoon: true,
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
    beats: [],
    lengths: { 5: { minutes: 5, tokenCost: 5, beatCount: 0, quiz: [] }, 10: { minutes: 10, tokenCost: 10, beatCount: 0, quiz: [] }, 15: { minutes: 15, tokenCost: 15, beatCount: 0, quiz: [] } },
    comingSoon: true,
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
    beats: [],
    lengths: { 5: { minutes: 5, tokenCost: 5, beatCount: 0, quiz: [] }, 10: { minutes: 10, tokenCost: 10, beatCount: 0, quiz: [] }, 15: { minutes: 15, tokenCost: 15, beatCount: 0, quiz: [] } },
    comingSoon: true,
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
    beats: [],
    lengths: { 5: { minutes: 5, tokenCost: 5, beatCount: 0, quiz: [] }, 10: { minutes: 10, tokenCost: 10, beatCount: 0, quiz: [] }, 15: { minutes: 15, tokenCost: 15, beatCount: 0, quiz: [] } },
    comingSoon: true,
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
    beats: [],
    lengths: { 5: { minutes: 5, tokenCost: 5, beatCount: 0, quiz: [] }, 10: { minutes: 10, tokenCost: 10, beatCount: 0, quiz: [] }, 15: { minutes: 15, tokenCost: 15, beatCount: 0, quiz: [] } },
    comingSoon: true,
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
    beats: [],
    lengths: { 5: { minutes: 5, tokenCost: 5, beatCount: 0, quiz: [] }, 10: { minutes: 10, tokenCost: 10, beatCount: 0, quiz: [] }, 15: { minutes: 15, tokenCost: 15, beatCount: 0, quiz: [] } },
    comingSoon: true,
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
    beats: [],
    lengths: { 5: { minutes: 5, tokenCost: 5, beatCount: 0, quiz: [] }, 10: { minutes: 10, tokenCost: 10, beatCount: 0, quiz: [] }, 15: { minutes: 15, tokenCost: 15, beatCount: 0, quiz: [] } },
    comingSoon: true,
  },
];

export function getDcCourse(courseId: string): DcUniversityCourse | undefined {
  return DC_UNIVERSITY_COURSES.find((c) => c.id === courseId);
}

export function getDcBeatsForLength(course: DcUniversityCourse, minutes: LectureMinutes): LectureBeat[] {
  const count = course.lengths[minutes]?.beatCount || 0;
  return course.beats.slice(0, count);
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
