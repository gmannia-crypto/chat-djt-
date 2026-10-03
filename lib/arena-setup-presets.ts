// Optional ready-made rooms; the full roster remains available for custom rooms.
export const ARENA_SETUP_PRESETS = [
  {
    id: "crossfire", number: "01", title: "The Crossfire",
    label: "TRADE / POWER", note: "A collision of instincts",
    topic: "Is America ready for a second trade war?", category: "politics",
    personas: ["trump", "maddow", "jdvance", "berniesanders", "carville", "galloway"],
  },
  {
    id: "climate", number: "02", title: "The Climate Faultline",
    label: "ENERGY / FUTURE", note: "Jobs now. Costs later.",
    topic: "Should the U.S. halt new fossil-fuel projects?", category: "science",
    personas: ["neiltyson", "desantis", "berniesanders", "elon", "aoc", "candace"],
  },
  {
    id: "borders", number: "03", title: "The Border Test",
    label: "IMMIGRATION / LAW", note: "Security against sanctuary",
    topic: "Can a hard border coexist with a humane system?", category: "politics",
    personas: ["pambondi", "aoc", "timscott", "trump", "omar", "biden"],
  },
  {
    id: "ai", number: "04", title: "The Machine Question",
    label: "AI / HUMANITY", note: "Innovation at what cost?",
    topic: "Should frontier AI be paused until it can be governed?", category: "science",
    personas: ["elon", "neiltyson", "claudeanderson", "cornellwest", "candace", "maponga"],
  },
  {
    id: "press-room", number: "05", title: "The Press Room",
    label: "MEDIA / TRUST", note: "The story behind the story",
    topic: "Who should we trust to tell the truth?", category: "politics",
    personas: ["megynkelly", "tuckercarlson", "carville", "maddow", "candace", "cornellwest"],
  },
  {
    id: "power-players", number: "06", title: "Power Players",
    label: "WEALTH / DEMOCRACY", note: "Who gets to shape the future?",
    topic: "Should billionaires have a seat at the table?", category: "wealth",
    personas: ["elon", "berniesanders", "aoc", "trump", "galloway", "claudeanderson"],
  },
  {
    id: "geopolitics", number: "07", title: "The Global Order",
    label: "GEOPOLITICS / POWER", note: "Diplomacy, conflict, and competing powers",
    topic: "Can a multipolar world be more peaceful than one led by a single superpower?", category: "politics",
    personas: ["jeffreysachs", "professorjiang", "netanyahu", "galloway", "arikana", "trump"],
  },
  {
    id: "academic", number: "08", title: "The Academic Forum",
    label: "ACADEMIC / IDEAS", note: "Evidence, economics, and philosophy",
    topic: "Should universities prioritize free inquiry over preparing students for the job market?", category: "politics",
    personas: ["cornellwest", "richardwolff", "jeffreysachs", "neiltyson", "claudeanderson", "professorjiang"],
  },
  {
    id: "civil-rights", number: "09", title: "Civil Rights",
    label: "CIVIL RIGHTS / JUSTICE", note: "Equal rights, opportunity, and accountability",
    topic: "Is legal equality enough, or does civil rights progress require economic reparations?", category: "politics",
    personas: ["cornellwest", "claudeanderson", "jascrockett", "timscott", "candace", "malema"],
  },
] as const;