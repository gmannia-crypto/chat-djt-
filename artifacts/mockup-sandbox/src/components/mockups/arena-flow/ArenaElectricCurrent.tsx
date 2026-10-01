import { useState } from "react";
import "./ArenaElectricCurrent.css";

const matchups = [
  {
    id: "crossfire", number: "01", title: "The Crossfire", label: "TRADE / POWER",
    note: "A collision of instincts", topic: "Is America ready for a second trade war?",
    voices: [{ initials: "DT", name: "Trump", tone: "gold" }, { initials: "RM", name: "Maddow", tone: "rose" }, { initials: "JV", name: "Vance", tone: "blue" }],
  },
  {
    id: "climate", number: "02", title: "The Climate Faultline", label: "ENERGY / FUTURE",
    note: "Jobs now. Costs later.", topic: "Should the U.S. halt new fossil-fuel projects?",
    voices: [{ initials: "GG", name: "Greta", tone: "mint" }, { initials: "DW", name: "DeSantis", tone: "gold" }, { initials: "AB", name: "Booker", tone: "lilac" }],
  },
  {
    id: "borders", number: "03", title: "The Border Test", label: "IMMIGRATION / LAW",
    note: "Security against sanctuary", topic: "Can a hard border coexist with a humane system?",
    voices: [{ initials: "AS", name: "Abbott", tone: "blue" }, { initials: "AO", name: "Ocasio", tone: "coral" }, { initials: "TC", name: "Cruz", tone: "gold" }],
  },
  {
    id: "ai", number: "04", title: "The Machine Question", label: "AI / HUMANITY",
    note: "Innovation at what cost?", topic: "Should frontier AI be paused until it can be governed?",
    voices: [{ initials: "EM", name: "Musk", tone: "lilac" }, { initials: "YR", name: "Yudkowsky", tone: "rose" }, { initials: "SF", name: "Fei-Fei", tone: "mint" }],
  },
  {
    id: "press-room", number: "05", title: "The Press Room", label: "MEDIA / TRUST",
    note: "The story behind the story", topic: "Who should we trust to tell the truth?",
    voices: [{ initials: "MK", name: "Megyn", tone: "lilac" }, { initials: "TC", name: "Tucker", tone: "gold" }, { initials: "JC", name: "Carville", tone: "mint" }],
  },
  {
    id: "billionaires", number: "06", title: "Power Players", label: "WEALTH / DEMOCRACY",
    note: "Who gets to shape the future?", topic: "Should billionaires have a seat at the table?",
    voices: [{ initials: "EM", name: "Musk", tone: "lilac" }, { initials: "BS", name: "Sanders", tone: "rose" }, { initials: "AOC", name: "Ocasio", tone: "coral" }],
  },
];

const durations = [2, 5, 10, 15];

export function ArenaElectricCurrent() {
  const [activeId, setActiveId] = useState("crossfire");
  const [minutes, setMinutes] = useState(2);
  const [roomReady, setRoomReady] = useState(false);
  const active = matchups.find((item) => item.id === activeId) ?? matchups[0];

  return (
    <main className="aec-page">
      <div className="aec-atmosphere" aria-hidden="true">
        <span className="aec-liquid aec-liquid-one" />
        <span className="aec-liquid aec-liquid-two" />
        <div className="aec-watermark">
          <img src="/__mockup/images/dynamic-creations-transparent.png" alt="" />
          <svg className="aec-bolt-current" viewBox="0 0 896 896" aria-hidden="true">
            <path d="M552 282 L433 335 L469 282 L365 573" />
            <path className="aec-core" d="M552 282 L433 335 L469 282 L365 573" />
          </svg>
        </div>
      </div>
      <div className="aec-wrap">
        <header className="aec-header">
          <div className="aec-brand"><span className="aec-brand-mark">A</span><span>ARENA <i>/</i> LIVE DEBATE</span></div>
          <div className="aec-step"><b>01</b><span>BUILD YOUR ROOM</span><span className="aec-status">PREVIEW</span></div>
        </header>

        <section className="aec-hero">
          <div className="aec-hero-copy">
            <div className="aec-eyebrow">YOUR FIRST ROUND IS ON US</div>
            <h1>Pick a side.<span>Make some current.</span></h1>
            <div className="aec-hero-aside"><p>Six live-wire matchups.<br />Three voices. No softballs.</p></div>
          </div>
          <div className="aec-count"><b>06</b><span>ROOMS<br />READY</span></div>
        </section>

        <section className="aec-section-head">
          <div><span>CHOOSE YOUR MATCHUP</span><b>Who’s taking the mic?</b></div>
          <span className="aec-index">01 — 06</span>
        </section>

        <section className="aec-grid" aria-label="Choose a debate matchup">
          {matchups.map((item) => {
            const selected = item.id === activeId;
            return (
              <button
                type="button"
                key={item.id}
                className={`aec-card ${selected ? "is-selected" : ""}`}
                onClick={() => { setActiveId(item.id); setRoomReady(false); }}
                aria-pressed={selected}
                aria-label={`${item.title}. ${item.topic}${selected ? ". Selected" : ""}`}
              >
                <div className="aec-card-head">
                  <span className="aec-number">{item.number}</span>
                  <span className="aec-label">{item.label}</span>
                  <span className="aec-select" aria-hidden="true">{selected ? "✓" : "+"}</span>
                </div>
                <div className="aec-voices" aria-label={`Voices: ${item.voices.map((voice) => voice.name).join(", ")}`}>
                  {item.voices.map((voice) => <span key={voice.name} className={`aec-avatar ${voice.tone}`} title={voice.name}>{voice.initials}</span>)}
                  <span className="aec-voice-count">3 VOICES</span>
                </div>
                <h2>{item.title}</h2>
                <p className="aec-note">{item.note}</p>
                <div className="aec-topic"><span>THE QUESTION</span><b>{item.topic}</b></div>
              </button>
            );
          })}
        </section>

        <section className="aec-session" aria-labelledby="aec-session-title">
          <div className="aec-session-top">
            <div><span className="aec-eyebrow">YOUR TRIAL SESSION</span><h2 id="aec-session-title">Set your time in the arena.</h2></div>
            <div className="aec-balance"><span>TRIAL BALANCE</span><b><i aria-hidden="true">●</i> 1 free session</b></div>
          </div>
          <div className="aec-duration" role="group" aria-label="Session length">
            {durations.map((value) => (
              <button type="button" key={value} className={minutes === value ? "is-current" : ""} onClick={() => { setMinutes(value); setRoomReady(false); }} aria-pressed={minutes === value}>
                <b>{value}<small> MIN</small></b><span>{value === 2 ? "FREE TRIAL" : `${value} TOKENS`}</span>
              </button>
            ))}
          </div>
          <div className="aec-receipt">
            <span className="aec-info" aria-hidden="true">i</span>
            <div className="aec-receipt-copy"><b>Price before you press go.</b><p>The 2-minute trial costs <strong>0 tokens</strong> and includes no official verdict. After that: <strong>1 token per minute</strong> — 5 min = 5 tokens · 10 min = 10 tokens · 15 min = 15 tokens. This preview will not start a debate or charge tokens.</p></div>
            <div className="aec-total"><span>THIS SESSION</span><b>{minutes === 2 ? "FREE" : `${minutes} TOKENS`}</b></div>
          </div>
          {roomReady && <div className="aec-confirm" role="status"><span>ROOM SELECTED</span>{active.title} · {minutes === 2 ? "free 2-minute trial · no official verdict" : `${minutes} minutes · ${minutes} tokens`} · preview only, no debate or charge.</div>}
          <button type="button" className="aec-enter" onClick={() => setRoomReady(true)}><span>{roomReady ? "ROOM SELECTED" : "CONFIRM ROOM SELECTION"}</span><span aria-hidden="true">↗</span></button>
          <div className="aec-footnote"><span>NO SUBSCRIPTION</span><i /> <span>STOP WHEN YOU WANT</span><i /> <span>YOUR ROOM, YOUR RULES</span></div>
        </section>
        <footer className="aec-bottom"><span>ARENA / OPEN FLOOR</span><span>THE ARGUMENT IS THE POINT.</span></footer>
      </div>
    </main>
  );
}

export default ArenaElectricCurrent;