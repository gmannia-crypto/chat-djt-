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
] as const;