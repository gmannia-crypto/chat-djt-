import { useState } from "react";
import "./ArenaTrialShowdown.css";

const matchups = [
  {
    id: "crossfire",
    number: "01",
    title: "The Crossfire",
    label: "TRADE / POWER",
    note: "A collision of instincts",
    topic: "Is America ready for a second trade war?",
    voices: [{ initials: "DT", name: "Trump", tone: "gold" }, { initials: "RM", name: "Maddow", tone: "rose" }, { initials: "JV", name: "Vance", tone: "blue" }],
  },
  {
    id: "climate",
    number: "02",
    title: "The Climate Faultline",
    label: "ENERGY / FUTURE",
    note: "Jobs now. Costs later.",
    topic: "Should the U.S. halt new fossil-fuel projects?",
    voices: [{ initials: "GG", name: "Greta", tone: "mint" }, { initials: "DW", name: "DeSantis", tone: "gold" }, { initials: "AB", name: "Booker", tone: "lilac" }],
  },
  {
    id: "borders",
    number: "03",
    title: "The Border Test",
    label: "IMMIGRATION / LAW",
    note: "Security against sanctuary",
    topic: "Can a hard border coexist with a humane system?",
    voices: [{ initials: "AS", name: "Abbott", tone: "blue" }, { initials: "AO", name: "Ocasio", tone: "coral" }, { initials: "TC", name: "Cruz", tone: "gold" }],
  },
  {
    id: "ai",
    number: "04",
    title: "The Machine Question",
    label: "AI / HUMANITY",
    note: "Innovation at what cost?",
    topic: "Should frontier AI be paused until it can be governed?",
    voices: [{ initials: "EM", name: "Musk", tone: "lilac" }, { initials: "YR", name: "Yudkowsky", tone: "rose" }, { initials: "SF", name: "Fei-Fei", tone: "mint" }],
  },
  {
    id: "press-room",
    number: "05",
    title: "The Press Room",
    label: "MEDIA / TRUST",
    note: "The story behind the story",
    topic: "Who should we trust to tell the truth?",
    voices: [{ initials: "MK", name: "Megyn", tone: "lilac" }, { initials: "TC", name: "Tucker", tone: "gold" }, { initials: "JC", name: "Carville", tone: "mint" }],
  },
  {
    id: "billionaires",
    number: "06",
    title: "Power Players",
    label: "WEALTH / DEMOCRACY",
    note: "Who gets to shape the future?",
    topic: "Should billionaires have a seat at the table?",
    voices: [{ initials: "EM", name: "Musk", tone: "lilac" }, { initials: "BS", name: "Sanders", tone: "rose" }, { initials: "AOC", name: "Ocasio", tone: "coral" }],
  },
];

const durations = [2, 5, 10, 15];

export function ArenaTrialShowdown() {
  const [activeId, setActiveId] = useState("crossfire");
  const [minutes, setMinutes] = useState(2);
  const [roomReady, setRoomReady] = useState(false);
  const active = matchups.find((item) => item.id === activeId) ?? matchups[0];

  return (
    <main className="ats-shell">
      <div className="ats-grain" aria-hidden="true" />
      <div className="ats-wrap">
        <header className="ats-header">
          <div className="ats-brand"><span className="ats-mark">A</span><span>ARENA <i>/</i> LIVE DEBATE</span></div>
          <div className="ats-step"><b>01</b><span>BUILD YOUR ROOM</span><span className="ats-live-dot" /> PREVIEW</div>
        </header>

        <section className="ats-intro">
          <div className="ats-kicker"><span /> YOUR FIRST ROUND IS ON US</div>
          <h1>Pick a side.<br /><em>Pick a fight.</em></h1>
          <div className="ats-intro-aside">
            <span className="ats-intro-rule" />
            <p>Six live-wire matchups.<br />Three voices. No softballs.</p>
          </div>
          <div className="ats-counter"><b>06</b><span>ROOMS<br />READY</span></div>
        </section>

        <section className="ats-section-head">
          <div><span>CHOOSE YOUR MATCHUP</span><b>Who’s taking the mic?</b></div>
          <span className="ats-count">01 — 06</span>
        </section>

        <section className="ats-grid" aria-label="Choose a debate matchup">
          {matchups.map((item) => {
            const selected = item.id === activeId;
            return (
              <button
                type="button"
                key={item.id}
                className={`ats-card ${selected ? "is-selected" : ""}`}
                onClick={() => { setActiveId(item.id); setRoomReady(false); }}
                aria-pressed={selected}
              >
                <div className="ats-card-head">
                  <span className="ats-number">{item.number}</span>
                  <span className="ats-label">{item.label}</span>
                  <span className="ats-select" aria-hidden="true">{selected ? "✓" : "+"}</span>
                </div>
                <div className="ats-voices" aria-label={item.voices.map((voice) => voice.name).join(", ")}>
                  {item.voices.map((voice) => <span key={voice.name} className={`ats-avatar ${voice.tone}`} title={voice.name}>{voice.initials}</span>)}
                  <span className="ats-voice-count">3 VOICES</span>
                </div>
                <h2>{item.title}</h2>
                <p className="ats-note">{item.note}</p>
                <div className="ats-topic"><span>THE QUESTION</span><b>{item.topic}</b></div>
              </button>
            );
          })}
        </section>

        <section className="ats-session">
          <div className="ats-session-top">
            <div><span className="ats-kicker">YOUR TRIAL SESSION</span><h2>Set your time in the arena.</h2></div>
            <div className="ats-balance"><span>TRIAL BALANCE</span><b><i>●</i> 1 free session</b></div>
          </div>
          <div className="ats-duration" role="group" aria-label="Session length">
            {durations.map((value) => (
              <button type="button" key={value} className={minutes === value ? "is-current" : ""} onClick={() => { setMinutes(value); setRoomReady(false); }} aria-pressed={minutes === value}>
                <b>{value}<small> MIN</small></b><span>{value === 2 ? "FREE TRIAL" : `${value} TOKENS`}</span>
              </button>
            ))}
          </div>
          <div className="ats-receipt">
            <span className="ats-receipt-mark">i</span>
            <div><b>Price before you press go.</b><p>The 2-minute trial costs <strong>0 tokens</strong> and includes no official verdict. After that: <strong>1 token per minute</strong> — 5 min = 5 tokens · 10 min = 10 tokens · 15 min = 15 tokens. This preview will not start a debate or charge tokens.</p></div>
            <div className="ats-total"><span>THIS SESSION</span><b>{minutes === 2 ? "FREE" : `${minutes} TOKENS`}</b></div>
          </div>
          {roomReady && <div className="ats-confirm" role="status"><span>ROOM READY</span>{active.title} · {minutes === 2 ? "free 2-minute trial · no official verdict" : `${minutes} minutes · ${minutes} tokens`} · preview only, no charge.</div>}
          <button type="button" className="ats-enter" onClick={() => setRoomReady(true)}><span>{roomReady ? "ROOM SELECTED" : "ENTER THE ARENA"}</span><span aria-hidden="true">↗</span></button>
          <div className="ats-footer"><span>NO SUBSCRIPTION</span><i /> STOP WHEN YOU WANT <i /> YOUR ROOM, YOUR RULES</div>
        </section>
        <footer className="ats-bottom"><span>ARENA / OPEN FLOOR</span><span>THE ARGUMENT IS THE POINT.</span></footer>
      </div>
    </main>
  );
}

export default ArenaTrialShowdown;