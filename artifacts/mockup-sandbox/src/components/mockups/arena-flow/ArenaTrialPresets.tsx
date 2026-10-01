import { useState } from "react";
import "./ArenaTrialPresets.css";

const presets = [
  {
    id: "crossfire",
    number: "01",
    title: "The Crossfire",
    note: "A collision of instincts",
    topic: "Is America ready for a second trade war?",
    voices: [
      { name: "Trump", initials: "DT", tone: "gold" },
      { name: "Maddow", initials: "RM", tone: "rose" },
      { name: "Vance", initials: "JV", tone: "blue" },
    ],
    tag: "MOST VOLATILE",
  },
  {
    id: "billionaires",
    number: "02",
    title: "Power Players",
    note: "Who gets to shape the future?",
    topic: "Should billionaires have a seat at the table?",
    voices: [
      { name: "Elon", initials: "EM", tone: "lilac" },
      { name: "Bernie", initials: "BS", tone: "rose" },
      { name: "AOC", initials: "AOC", tone: "coral" },
    ],
    tag: "3 DEBATERS",
  },
  {
    id: "press-room",
    number: "03",
    title: "The Press Room",
    note: "The story behind the story",
    topic: "Who should we trust to tell the truth?",
    voices: [
      { name: "Megyn", initials: "MK", tone: "lilac" },
      { name: "Tucker", initials: "TC", tone: "gold" },
      { name: "Carville", initials: "JC", tone: "mint" },
    ],
    tag: "3 DEBATERS",
  },
];

export function ArenaTrialPresets() {
  const [activePreset, setActivePreset] = useState("crossfire");
  const [minutes, setMinutes] = useState(2);
  const [started, setStarted] = useState(false);
  const preset = presets.find((item) => item.id === activePreset) ?? presets[0];

  return (
    <main className="atp-shell">
      <div className="atp-grain" aria-hidden="true" />
      <div className="atp-layout">
        <header className="atp-header">
          <div className="atp-brand">
            <span className="atp-mark">A</span>
            <span>ARENA <i>/</i> LIVE DEBATE</span>
          </div>
          <span className="atp-step"><b>01</b> — SET YOUR ROOM</span>
        </header>

        <section className="atp-intro">
          <div className="atp-eyebrow"><span /> YOUR FIRST ROUND IS ON US</div>
          <h1>Pick a matchup.<br /><em>Let it get real.</em></h1>
          <p>Three voices. One live topic. Choose a room and see where the argument goes.</p>
        </section>

        <section className="atp-matchups" aria-label="Choose a debate matchup">
          {presets.map((item) => {
            const isActive = item.id === activePreset;
            return (
              <button
                key={item.id}
                className={`atp-preset ${isActive ? "is-active" : ""}`}
                onClick={() => { setActivePreset(item.id); setStarted(false); }}
                aria-pressed={isActive}
              >
                <div className="atp-preset-top">
                  <span className="atp-index">{item.number}</span>
                  <span className="atp-tag">{item.tag}</span>
                  <span className="atp-check" aria-hidden="true">{isActive ? "✓" : "+"}</span>
                </div>
                <div className="atp-voices">
                  {item.voices.map((voice) => (
                    <span className={`atp-avatar ${voice.tone}`} key={voice.name}>{voice.initials}</span>
                  ))}
                </div>
                <h2>{item.title}</h2>
                <p className="atp-note">{item.note}</p>
                <div className="atp-topic"><span>ON THE TABLE</span><b>{item.topic}</b></div>
              </button>
            );
          })}
        </section>

        <section className="atp-session">
          <div className="atp-session-heading">
            <div><span className="atp-eyebrow">YOUR TRIAL SESSION</span><h2>How long do you want to stay?</h2></div>
            <span className="atp-clock" aria-hidden="true">◷</span>
          </div>
          <div className="atp-duration" role="group" aria-label="Session length">
            {[2, 5, 10, 15].map((value) => (
              <button
                key={value}
                className={minutes === value ? "selected" : ""}
                onClick={() => { setMinutes(value); setStarted(false); }}
                aria-pressed={minutes === value}
              >
                <b>{value}<small> MIN</small></b>
                <span>{value === 2 ? "FREE TRIAL" : `${value} TOKENS`}</span>
              </button>
            ))}
          </div>
          <div className="atp-terms">
            <span className="atp-terms-icon">i</span>
            <p><b>Clear terms, no surprises.</b> The free trial lasts <b>2 minutes and awards no official verdict</b>. Paid sessions use <b>1 token per minute</b> (5 min = 5 tokens; 10 min = 10 tokens; 15 min = 15 tokens). This preview does not start a live debate or charge tokens.</p>
          </div>
          {started && <div className="atp-confirmation" role="status">Room ready: {preset.title} · {minutes === 2 ? "free 2-minute trial · no official verdict" : `${minutes} minutes · ${minutes} tokens`} · Preview only; no live debate or charge.</div>}
          <button className="atp-start" onClick={() => setStarted(true)}>
            <span>{started ? "ROOM SELECTED" : "ENTER THE ARENA"}</span>
            <span className="atp-start-arrow">↗</span>
          </button>
          <div className="atp-bottom-note"><span>NO SUBSCRIPTION</span><i /> STOP WHEN YOU WANT <i /> YOUR ROOM, YOUR RULES</div>
        </section>
      </div>
    </main>
  );
}

export default ArenaTrialPresets;