import { useState, type ReactNode } from "react";
import "./ProposedSetupGlass.css";

const voices = [
  { id: "trump", name: "Trump", role: "Former president", initials: "DT" },
  { id: "maddow", name: "Maddow", role: "Journalist", initials: "RM" },
  { id: "vance", name: "Vance", role: "Vice president", initials: "JV" },
  { id: "bernie", name: "Bernie", role: "Senator", initials: "BS" },
  { id: "elon", name: "Elon", role: "Tech entrepreneur", initials: "EM" },
  { id: "aoc", name: "AOC", role: "Representative", initials: "AOC" },
];
const topics = [
  ["Trade war fallout", "Tariffs meet household bills. What is the real cost of economic brinkmanship?", "Politics"],
  ["AI & big tech power", "A handful of companies are shaping how we work, learn, and trust what we see.", "Science"],
  ["Healthcare, priced out", "When treatment is a financial risk, who should carry the cost?", "Health"],
  ["Billionaire influence", "Where does private wealth end and public power begin?", "Wealth"],
];
const categories = ["Politics", "Sports", "Science", "Health", "Wealth", "Finance"];
const modes = [["Civil", "Facts & logic"], ["Elevated", "Heated debate"], ["Savage", "No holds barred"]];

export function ProposedSetupGlass() {
  const [selected, setSelected] = useState(["trump", "maddow"]);
  const [selectedTopic, setSelectedTopic] = useState(0);
  const [category, setCategory] = useState("Politics");
  const [customTopic, setCustomTopic] = useState("");
  const [mode, setMode] = useState("Elevated");
  const [minutes, setMinutes] = useState(2);
  const [music, setMusic] = useState(false);
  const [open, setOpen] = useState(["voices"]);
  const [notice, setNotice] = useState(false);

  const toggleOpen = (section: string) => setOpen((current) => current.includes(section) ? current.filter((value) => value !== section) : [...current, section]);
  const toggleVoice = (id: string) => setSelected((current) => current.includes(id)
    ? current.length > 2 ? current.filter((value) => value !== id) : current
    : [...current, id]);
  const chosen = voices.filter((voice) => selected.includes(voice.id));
  const currentTopic = topics[selectedTopic] ?? topics[0];
  const title = customTopic.trim() || currentTopic[0];
  const description = customTopic.trim() ? "Your question, in your words." : currentTopic[1];
  const section = (id: string, titleText: string, detail: string, right: string, content: ReactNode) => (
    <div className="ag-disclosure" key={id}>
      <button className="ag-trigger" aria-expanded={open.includes(id)} onClick={() => toggleOpen(id)}>
        <span><strong>{titleText}</strong><small>{detail}</small></span>
        <span className="ag-trigger-right">{right}<i className={`ag-chevron ${open.includes(id) ? "is-open" : ""}`} aria-hidden="true">⌄</i></span>
      </button>
      {open.includes(id) && <div className="ag-body">{content}</div>}
    </div>
  );

  return (
    <main className="arena-glass">
      <div className="ag-atmosphere" aria-hidden="true"><i className="ag-orb ag-orb--one" /><i className="ag-orb ag-orb--two" /><i className="ag-orb ag-orb--three" /></div>
      <div className="ag-page">
        <div className="ag-topline"><div className="ag-brand"><span className="ag-mark">A</span> THE ARENA</div><span className="ag-edition">DEBATE SETUP · 01</span></div>
        <header className="ag-hero">
          <div className="ag-eyebrow">Your first debate</div>
          <h1>Pick a side.<br /><em>Hear them out.</em></h1>
          <p className="ag-subtitle">A room of competing ideas, held in a little more light. Choose a suggested face-off or shape the conversation yourself.</p>
        </header>
        <section className="ag-stage ag-panel" aria-label="Suggested debate lineup">
          <div className="ag-stage-label"><strong>Suggested match</strong><span>{selected.length} voices selected</span></div>
          <div className="ag-duel">
            {chosen[0] ? <div className="ag-contender"><span className="ag-avatar" aria-hidden="true">{chosen[0].initials}</span><span className="ag-person"><b>{chosen[0].name}</b><small>{chosen[0].role}</small></span></div> : <div className="ag-contender"><span className="ag-person">Choose a voice</span></div>}
            <span className="ag-vs">VS</span>
            {chosen[1] ? <div className="ag-contender ag-contender--right"><span className="ag-person"><b>{chosen[1].name}</b><small>{chosen[1].role}</small></span><span className="ag-avatar" aria-hidden="true">{chosen[1].initials}</span></div> : <div className="ag-contender ag-contender--right"><span className="ag-person"><small>Add another voice</small></span></div>}
          </div>
          <div className="ag-question"><span className="ag-kicker">THE QUESTION ON THE FLOOR</span><strong>{title}</strong><p>{description}</p></div>
          <button className="ag-edit" onClick={() => { setOpen((current) => current.includes("voices") ? current : [...current, "voices"]); document.getElementById("ag-voices")?.scrollIntoView({ behavior: "auto", block: "nearest" }); }}>＋ Edit voices</button>
        </section>
        <button className="ag-action" onClick={() => setNotice(true)}>
          <span><b>{minutes === 2 ? "Start 2-minute trial" : `Use ${minutes}-minute session`}</b><small>{minutes === 2 ? "No official verdict · no token charge" : `${minutes} tokens · no purchase made here`}</small></span><span className="ag-arrow" aria-hidden="true">→</span>
        </button>
        <div className="ag-note"><span className="ag-clock" aria-hidden="true">◷</span><span><b>2 minutes, on us.</b> See how it unfolds before choosing a longer session.</span></div>
        {notice && <div className="ag-status" role="status"><strong>Setup ready.</strong> This preview doesn’t launch a live debate. Your choices stay selected as you explore.</div>}
        <div className="ag-options ag-panel">
          {section("voices", "Choose your voices", "Browse featured debaters", `${selected.length} selected`, <div id="ag-voices">
            <div className="ag-label"><span>Featured voices</span><span>Choose at least two</span></div>
            <div className="ag-roster">{voices.map((voice) => <button key={voice.id} className="ag-choice" aria-pressed={selected.includes(voice.id)} disabled={selected.includes(voice.id) && selected.length <= 2} onClick={() => toggleVoice(voice.id)}>{voice.initials} · {voice.name}</button>)}</div>
            <div className="ag-roster" style={{ justifyContent: "space-between", marginTop: 9 }}><button className="ag-edit" onClick={() => setSelected(voices.map((voice) => voice.id))}>Select featured</button><button className="ag-edit" onClick={() => setSelected(["trump", "maddow"])}>Reset suggested pair</button></div>
          </div>)}
          {section("topic", "Set the topic", "Headlines, or bring your own", customTopic.trim() ? "Your topic" : "Suggested", <div>
            <div className="ag-category" aria-label="Topic category">{categories.map((value) => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>
            <div className="ag-topic-list">{topics.filter((topic) => topic[2] === category || category === "Politics").map((topic) => {
              const index = topics.indexOf(topic);
              return <button className="ag-topic" key={topic[0]} aria-pressed={selectedTopic === index && !customTopic.trim()} onClick={() => { setSelectedTopic(index); setCustomTopic(""); }}><strong>{topic[0]}</strong><small>{topic[1]}</small></button>;
            })}</div>
            <div className="ag-label" style={{ marginTop: 12 }}><span>Or start with your own question</span></div>
            <textarea className="ag-custom" value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="What should they debate?" aria-label="Your debate topic" />
          </div>)}
          {section("debate", "Shape the debate", "Open debate · Heated debate", "Open debate", <div>
            <div className="ag-label">Debate tone</div><div className="ag-mode-list">{modes.map(([name, detail]) => <button className="ag-mode" key={name} aria-pressed={mode === name} onClick={() => setMode(name)}><span><b>{name}</b><small>{detail}</small></span><i className="ag-dot" aria-hidden="true" /></button>)}</div>
          </div>)}
          {section("time", "Session length", minutes === 2 ? "2-minute trial · no verdict" : `${minutes} minutes · 1 token per minute`, minutes === 2 ? "TRIAL" : `${minutes} TOKENS`, <div>
            <div className="ag-label">Choose a session</div><div className="ag-time-grid">{[5, 10, 15].map((value) => <button className="ag-time" key={value} aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{value} min · {value}</button>)}</div>
            <button className="ag-time" style={{ width: "100%", marginTop: 7 }} aria-pressed={minutes === 2} onClick={() => setMinutes(2)}>2-minute trial · no token charge</button>
          </div>)}
          {section("sound", "Sound & music", music ? "Arena music on" : "Music is off", "", <button className="ag-switch-row" aria-pressed={music} onClick={() => setMusic(!music)}><span><b>Arena music</b><small>Background music for your session</small></span><span className={`ag-switch ${music ? "is-on" : ""}`}><i /></span></button>)}
        </div>
        <div className="ag-foot">The Arena · Voices are AI-acted personas. Your trial has no official verdict.</div>
      </div>
    </main>
  );
}