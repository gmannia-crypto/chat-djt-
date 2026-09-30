import { useState } from "react";
import "./_group.css";
import "./ProposedSetup.css";
import { LiquidFlow } from "./LiquidFlow";

const topics = [
  ["The Epstein War on Iran", "Trump launched military strikes on Iran just as the Epstein files were set to be unsealed. Critics call it 'The Epstein War' — a war of maximum distraction."],
  ["Gaza Genocide & Zionist Lobby", "The siege of Gaza continues with hospitals bombed, refugee camps destroyed, and civilians starved. The Zionist lobby's stranglehold on American and EU foreign policy."],
  ["Trump's Trade War Fallout", "Tariffs are crushing American consumers while Trump claims the economy has never been better. Inflation rising, supply chains breaking."],
  ["Mass Deportation Campaign", "Trump's ICE raids are tearing families apart across America. Children separated from parents, communities living in fear."],
  ["DOGE Dismantles Government", "Elon Musk's DOGE has gutted veterans' services, scientific research, consumer protections, and refugee programs."],
  ["Epstein Files Cover-Up", "The Epstein client list remains partially sealed. Trump was a known associate. Every distraction is designed to keep these files buried."],
  ["January 6th Pardons & Accountability", "Trump pardoned January 6th defendants, calling them 'patriots.' Critics call it an endorsement of political violence."],
  ["AI Takeover & Big Tech Power", "AI is replacing jobs, generating deepfakes, and concentrating power. Elon's xAI, OpenAI, and Google are in an arms race with zero regulation."],
  ["Supreme Court & Judicial Power", "The conservative Supreme Court supermajority is reshaping American law on abortion, guns, voting rights, and executive power."],
  ["Healthcare System Collapse", "Americans are dying because they can't afford insulin or cancer treatment. Big Pharma profits hit record highs while rural hospitals close."],
  ["Ukraine War & NATO Alliance", "Russia's invasion of Ukraine grinds on as Trump pushes for a deal critics call surrender. NATO allies question American commitment."],
  ["US-China Cold War", "Trade war escalation, Taiwan tensions, TikTok bans. Is the US heading toward military confrontation with China?"],
  ["Climate Crisis & Fossil Fuel Profits", "Record wildfires, hurricanes, and heat waves. Oil companies post record profits. Trump pulled out of the Paris Agreement again."],
  ["Police Brutality & Criminal Justice", "Black Americans continue to die in police encounters. Reform efforts stalled. Trump champions 'law and order.'"],
  ["Election Fraud Claims & Voter Suppression", "Trump still claims 2020 was stolen despite zero evidence. Republican states pass restrictive voting laws."],
  ["Billionaire Oligarchy", "Elon, Bezos, and Zuckerberg now have direct access to the presidency. Billionaires pay lower tax rates than their employees."],
  ["Media Wars & Disinformation", "Fox News, MSNBC, X, and TikTok shape reality for millions. Deepfakes and AI-generated propaganda flood social media."],
];

const personas = [
  { id: "trump", name: "Trump", role: "Former president", img: "persona-trump.png", initials: "DT" },
  { id: "jdvance", name: "Vance", role: "Vice president", initials: "JV" },
  { id: "elon", name: "Elon", role: "Tech entrepreneur", initials: "EM" },
  { id: "biden", name: "Biden", role: "Former president", img: "persona-biden.png", initials: "JB" },
  { id: "desantis", name: "DeSantis", role: "Governor", img: "persona-desantis.jpg", initials: "RD" },
  { id: "maddow", name: "Maddow", role: "Journalist", img: "persona-maddow.png", initials: "RM" },
  { id: "bernie", name: "Bernie", role: "Senator", initials: "BS" },
  { id: "carville", name: "Carville", role: "Commentator", initials: "JC" },
  { id: "megyn", name: "Megyn", role: "Journalist", initials: "MK" },
  { id: "candace", name: "Candace", role: "Commentator", initials: "CO" },
  { id: "aoc", name: "AOC", role: "Representative", initials: "AOC" },
  { id: "tucker", name: "Tucker", role: "Commentator", initials: "TC" },
];

const groups = [
  ["PRESIDENTS", ["trump"]],
  ["POLITICIANS", ["jdvance", "biden", "desantis", "bernie", "aoc"]],
  ["JOURNALISTS", ["maddow", "megyn"]],
  ["COMMENTATORS", ["elon", "carville", "candace", "tucker"]],
];
const categories = ["Politics", "Sports", "Science", "Health", "Wealth", "Finance", "Motivation"];
const modes = [
  ["civil", "Civil", "Facts & logic"],
  ["elevated", "Elevated", "Heated debate"],
  ["savage", "Savage", "No holds barred"],
];
const formatOptions = [
  ["Open debate", "Two or more voices, with room for the whole panel"],
  ["1-on-1 interview", "A moderator takes one persona to task"],
  ["1-on-1 debate", "A focused face-off with a moderator"],
  ["Team battle", "4-vs-4 ideology group showdown"],
];

function Disclosure({ title, detail, open, onClick, right }: {
  title: string;
  detail: string;
  open: boolean;
  onClick: () => void;
  right?: string;
}) {
  return (
    <button className="ps-disclosure-trigger" aria-expanded={open} onClick={onClick}>
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span className="ps-trigger-right">{right}<i className={`ps-chevron ${open ? "open" : ""}`}>⌄</i></span>
    </button>
  );
}

export function ProposedSetup() {
  const [selected, setSelected] = useState<string[]>(["trump", "maddow"]);
  const [selectedTopic, setSelectedTopic] = useState(2);
  const [category, setCategory] = useState("Politics");
  const [mode, setMode] = useState("elevated");
  const [format, setFormat] = useState("Open debate");
  const [duration, setDuration] = useState(2);
  const [musicOn, setMusicOn] = useState(false);
  const [customTopic, setCustomTopic] = useState("");
  const [editingCustom, setEditingCustom] = useState(false);
  const [open, setOpen] = useState<string[]>([]);
  const [notice, setNotice] = useState(false);

  const toggle = (key: string) => setOpen((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const togglePersona = (id: string) => setSelected((current) => {
    if (current.includes(id)) return current.length <= 2 ? current : current.filter((item) => item !== id);
    return [...current, id];
  });
  const chosen = personas.filter((persona) => selected.includes(persona.id));
  const first = chosen[0];
  const second = chosen[1];
  const topicTitle = editingCustom && customTopic.trim() ? customTopic.trim() : topics[selectedTopic][0];
  const topicBlurb = editingCustom && customTopic.trim() ? "Your topic" : topics[selectedTopic][1];

  return (
    <main className="arena-flow-page proposed-setup">
      <div className="ps-backdrop" aria-hidden="true" />
      <LiquidFlow />
      <div className="ps-grain" aria-hidden="true" />
      <div className="ps-scroll">
        <div className="ps-shell">
          <div className="ps-topline">
            <div className="ps-brand"><span className="ps-mark">A</span> THE ARENA</div>
            <span className="ps-edition">Debate setup · 01</span>
          </div>

          <header className="ps-hero">
            <div className="ps-eyebrow">Your first debate</div>
            <h1>Pick a side.<br /><em>Hear them out.</em></h1>
            <p className="ps-subtitle">We’ve set the stage. Start with a suggested face-off, or shape the room yourself.</p>
          </header>

          <section className="ps-stage" aria-label="Suggested debate lineup">
            <div className="ps-stage-label"><strong>SUGGESTED MATCH</strong><span>{selected.length} selected</span></div>
            <div className="ps-duel">
              {first ? (
                <div className="ps-contender">
                  <span className="ps-photo">{first.img ? <img src={`/__mockup/images/${first.img}`} alt="" /> : <span className="ps-initial">{first.initials}</span>}</span>
                  <span><b className="ps-person-name">{first.name}</b><small className="ps-person-role">{first.role}</small></span>
                </div>
              ) : <div className="ps-contender"><span className="ps-person-name">Choose a voice</span></div>}
              <span className="ps-versus">VS</span>
              {second ? (
                <div className="ps-contender">
                  <span><b className="ps-person-name">{second.name}</b><small className="ps-person-role">{second.role}</small></span>
                  <span className="ps-photo">{second.img ? <img src={`/__mockup/images/${second.img}`} alt="" /> : <span className="ps-initial">{second.initials}</span>}</span>
                </div>
              ) : <div className="ps-contender" style={{ justifyContent: "flex-end" }}><span className="ps-person-role">Add another voice</span></div>}
            </div>
            <div className="ps-topic">
              <span className="ps-topic-kicker">THE QUESTION ON THE FLOOR</span>
              <strong>{topicTitle}</strong>
              <p>{topicBlurb}</p>
            </div>
            <button className="ps-inline-edit" onClick={() => toggle("voices")}><span>＋</span> Edit voices</button>
          </section>

          <button className="ps-action" onClick={() => setNotice(true)}>
            <span><b>{duration === 2 ? "Start 2-minute trial" : `Use ${duration}-minute session`}</b><small>{duration === 2 ? "No official verdict · no token charge" : `${duration} tokens · no purchase made here`}</small></span>
            <span className="ps-action-arrow">→</span>
          </button>
          <div className="ps-trial-note"><span className="ps-clock">◷</span><span><b>2 minutes, on us.</b> See how the debate unfolds before choosing a longer session.</span></div>
          {notice && <div className="ps-recap" role="status"><strong>Setup ready.</strong> This standalone preview doesn’t launch a live debate. Your choices stay selected while you explore.</div>}

          <section className="ps-disclosure">
            <Disclosure title="Choose your voices" detail="Browse featured debaters" right={`${selected.length} selected`} open={open.includes("voices")} onClick={() => toggle("voices")} />
            {open.includes("voices") && <div className="ps-disclosure-body">
              {groups.map(([group, ids]) => {
                const people = personas.filter((persona) => (ids as string[]).includes(persona.id));
                return <div key={group as string}>
                  <div className="ps-control-label">{group as string}<small>{people.filter((person) => selected.includes(person.id)).length}/{people.length}</small></div>
                  <div className="ps-persona-grid">{people.map((person) => <button key={person.id} className={`ps-persona ${selected.includes(person.id) ? "selected" : ""}`} aria-pressed={selected.includes(person.id)} onClick={() => togglePersona(person.id)}>
                    <span className="ps-avatar">{person.img ? <img src={`/__mockup/images/${person.img}`} alt="" /> : person.initials}</span>
                    <span className="ps-persona-name">{person.name}</span>
                  </button>)}</div>
                </div>;
              })}
              <div className="ps-persona-tools">
                <button className="ps-text-button" onClick={() => setSelected(personas.map((persona) => persona.id))}>Select featured</button>
                <button className="ps-text-button" onClick={() => setSelected(["trump", "maddow"])}>Reset suggested pair</button>
              </div>
              <p className="ps-foot">This preview shows featured debaters. The live app has a larger roster.</p>
            </div>}
          </section>

          <section className="ps-disclosure">
            <Disclosure title="Set the topic" detail="Headlines, or bring your own" right={editingCustom ? "Your topic" : "Suggested"} open={open.includes("topic")} onClick={() => toggle("topic")} />
            {open.includes("topic") && <div className="ps-disclosure-body">
              <div className="ps-categories">{categories.map((item) => <button key={item} className={`ps-chip ${category === item ? "active" : ""}`} onClick={() => { setCategory(item); setEditingCustom(false); }}>{item}</button>)}</div>
              <button className={`ps-chip ${editingCustom ? "active" : ""}`} style={{ marginBottom: 10 }} onClick={() => setEditingCustom(!editingCustom)}>Write a topic</button>
              {editingCustom ? <textarea className="ps-custom" maxLength={200} value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="What should they debate?" /> :
                <div className="ps-topic-list">{topics.map(([title, description], index) => <button key={title} className={`ps-topic-option ${selectedTopic === index ? "active" : ""}`} onClick={() => setSelectedTopic(index)}>
                  <strong>{title}</strong><small>{description}</small>
                </button>)}</div>}
            </div>}
          </section>

          <section className="ps-disclosure">
            <Disclosure title="Shape the debate" detail={`${format} · ${modes.find(([id]) => id === mode)?.[1]} tone`} open={open.includes("debate")} onClick={() => toggle("debate")} />
            {open.includes("debate") && <div className="ps-disclosure-body">
              <div className="ps-control-label">FORMAT</div>
              <div className="ps-mode-list">{formatOptions.map(([name, description]) => <button key={name} className={`ps-mode ${format === name ? "active" : ""}`} onClick={() => setFormat(name)}>
                <span><strong>{name}</strong><small>{description}</small></span><i className="ps-radio" />
              </button>)}</div>
              <div className="ps-control-label" style={{ marginTop: 16 }}>DEBATE MODE</div>
              <div className="ps-mode-list">{modes.map(([id, name, description]) => <button key={id} className={`ps-mode ${mode === id ? "active" : ""}`} onClick={() => setMode(id)}>
                <span><strong>{name}</strong><small>{description}</small></span><i className="ps-radio" />
              </button>)}</div>
            </div>}
          </section>

          <section className="ps-disclosure">
            <Disclosure title="Session length" detail={duration === 2 ? "2-minute trial · no verdict" : `${duration} minutes · 1 token per minute`} right={duration === 2 ? "TRIAL" : `${duration} TOKENS`} open={open.includes("time")} onClick={() => toggle("time")} />
            {open.includes("time") && <div className="ps-disclosure-body">
              <div className="ps-control-label">Choose a session</div>
              <div className="ps-duration-grid">
                {[5, 10, 15].map((minutes) => <button key={minutes} className={`ps-duration ${duration === minutes ? "active" : ""}`} onClick={() => setDuration(minutes)}><b>{minutes} min</b><small>{minutes} tokens</small></button>)}
              </div>
              <button className={`ps-duration ${duration === 2 ? "active" : ""}`} style={{ width: "100%", marginTop: 8 }} onClick={() => setDuration(2)}><b>2-minute trial</b><small>No official verdict · no token charge</small></button>
              <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 9, lineHeight: 1.5 }}>Paid sessions use 1 token per minute. Choosing a duration here does not make a purchase.</p>
            </div>}
          </section>

          <section className="ps-disclosure">
            <Disclosure title="Sound & music" detail={musicOn ? "Arena music on" : "Music is off"} open={open.includes("sound")} onClick={() => toggle("sound")} />
            {open.includes("sound") && <div className="ps-disclosure-body">
              <button className="ps-music" aria-pressed={musicOn} onClick={() => setMusicOn(!musicOn)}>
                <span><strong>Arena music</strong><small>Toggle background music for your session</small></span>
                <span className={`ps-switch ${musicOn ? "on" : ""}`}><i /></span>
              </button>
            </div>}
          </section>

          <div className="ps-foot">The Arena · Voices are AI-acted personas. Your trial has no official verdict.</div>
        </div>
      </div>
    </main>
  );
}