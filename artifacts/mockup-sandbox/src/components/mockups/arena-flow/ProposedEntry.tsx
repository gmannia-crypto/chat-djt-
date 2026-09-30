import { useState, type CSSProperties } from "react";
import {
  Archive, ArrowRight, Brain, Check, ChevronDown, ChevronRight, CircleHelp,
  Headphones, MessageCircle, Mic, Pause, Play, Settings, Share2, Volume2, X,
} from "lucide-react";
import "./_group.css";
import "./ProposedEntry.css";
import { LiquidFlow } from "./LiquidFlow";

const demoLines = [
  { name: "Donald Trump", side: "left", image: "/__mockup/images/persona-trump.png", text: "The question is simple: who does this actually help?" },
  { name: "Joe Biden", side: "right", image: "/__mockup/images/persona-biden.png", text: "Start with the people doing the work. That's where the answer is." },
  { name: "Donald Trump", side: "left", image: "/__mockup/images/persona-trump.png", text: "Then let's hear the case—and let everyone decide." },
];

export function ProposedEntry() {
  const [line, setLine] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [topic, setTopic] = useState("The cost of everyday life");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("");
  const current = demoLines[line];

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  return (
    <main className="arena-flow-page arena-proposed">
      <LiquidFlow />
      <div className="pe-shell">
        <header className="pe-header">
          <button className="pe-archive" type="button" onClick={() => announce("Your saved debates will appear here.")}>
            <span className="pe-archive-mark"><Archive size={16} /></span>
            <span>ARCHIVE</span>
          </button>
          <button type="button" className="pe-brand" aria-label="Dynamic Creations home" onClick={() => announce("You're at the Arena entrance.")}>
            <span>by</span><img src="/__mockup/images/dynamic-creations.jpg" alt="Dynamic Creations" />
          </button>
          <div className="pe-header-actions">
            <button type="button" className="pe-icon-button" aria-label={playing ? "Pause sample" : "Audio options"} onClick={() => setPlaying(!playing)}><Volume2 size={16} /></button>
            <button type="button" className="pe-token" onClick={() => announce("Tokens are part of the Arena experience.")}>
              <img src="/__mockup/images/dc-lightning-token.jpeg" alt="" /><span>12</span>
            </button>
            <button type="button" className="pe-icon-button" aria-label="Share" onClick={() => announce("Share preview is not connected yet.")}><Share2 size={16} /></button>
            <button type="button" className="pe-icon-button" aria-label="Settings" onClick={() => announce("Settings preview is not connected yet.")}><Settings size={16} /></button>
          </div>
        </header>

        <div className="pe-content">
          <section className="pe-intro">
            <div className="pe-kicker"><span className="pe-live-dot" /> THE ARENA <span className="pe-kicker-rule" /> YOUR FIRST DEBATE STARTS HERE</div>
            <h1>Hear the clash.<br /><em>Take the mic.</em></h1>
            <p>AI voices take opposite sides on the news. Listen in, jump into the room, and make your case.</p>
          </section>

          <section className="pe-demo" aria-label="Interactive debate sample">
            <div className="pe-demo-top">
              <div><span className="pe-overline">A QUICK PREVIEW</span><h2>Two voices. One question.</h2></div>
              <span className="pe-demo-time"><Headphones size={14} /> TEXT DEMO</span>
            </div>
            <div className="pe-stage">
              <div className="pe-stage-wash" />
              <div className="pe-stage-label"><span>THE QUESTION</span><strong>Who gets heard when prices rise?</strong></div>
              <div className={`pe-speaker pe-speaker-left ${current.side === "left" && playing ? "is-speaking" : ""}`}>
                <div className="pe-portrait"><img src="/__mockup/images/persona-trump.png" alt="Donald Trump AI persona" /></div>
                <span>DONALD TRUMP</span>
              </div>
              <div className="pe-versus">VS</div>
              <div className={`pe-speaker pe-speaker-right ${current.side === "right" && playing ? "is-speaking" : ""}`}>
                <div className="pe-portrait"><img src="/__mockup/images/persona-biden.png" alt="Joe Biden AI persona" /></div>
                <span>JOE BIDEN</span>
              </div>
              <div className="pe-wave" aria-hidden="true">{Array.from({ length: 39 }, (_, index) => <i key={index} style={{ "--bar": `${10 + ((index * 17 + 11) % 26)}px` } as CSSProperties} />)}</div>
              <div className="pe-transcript" aria-live="polite">
                <span className={`pe-turn-dot ${current.side}`} />
                <p><strong>{current.name}</strong>{current.text}</p>
              </div>
            </div>
            <div className="pe-player">
              <button className="pe-play" type="button" aria-label={playing ? "Pause text preview" : "Start text preview"} onClick={() => setPlaying(!playing)}>
                {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
              <div className="pe-progress-wrap">
                <div className="pe-progress-label"><span>{playing ? "READING THE EXCHANGE" : "TAP TO READ THE EXCHANGE"}</span><span>{line + 1} / {demoLines.length}</span></div>
                <div className="pe-progress"><i style={{ width: `${22 + line * 25}%` }} /></div>
              </div>
              <button className="pe-next-line" type="button" onClick={() => { setLine((line + 1) % demoLines.length); setPlaying(true); }}>
                NEXT LINE <ChevronRight size={14} />
              </button>
            </div>
            <p className="pe-sample-note">Text-only concept preview; no audio plays here. The free trial is 2 minutes and does not award an official verdict.</p>
          </section>

          <section className="pe-next">
            <div className="pe-next-copy">
              <span className="pe-overline">YOUR TURN, WHEN YOU'RE READY</span>
              <h2>Pick a topic.<br /><span>We'll get the room ready.</span></h2>
            </div>
            <button type="button" className="pe-setup-cta" onClick={() => setSetupOpen(true)}>
              <span>SET UP MY FIRST DEBATE</span><ArrowRight size={17} />
            </button>
            <div className="pe-steps"><span><i>01</i> Choose a question</span><b /> <span><i>02</i> Pick your side</span><b /> <span><i>03</i> Speak by mic</span></div>
          </section>

          <section className="pe-other-modes">
            <div className="pe-mode-heading"><span>MORE WAYS IN</span><span>Explore the Arena <ChevronDown size={13} /></span></div>
            <div className="pe-mode-row">
              <button type="button" className={`pe-mode-card ${mode === "interviews" ? "selected" : ""}`} onClick={() => { setMode("interviews"); announce("One-on-one interviews selected."); }}>
                <span className="pe-mode-icon"><Mic size={18} /></span><span><strong>1-on-1 Interviews</strong><small>Go deeper with a persona</small></span><ChevronRight size={16} />
              </button>
              <button type="button" className={`pe-mode-card ${mode === "therapy" ? "selected" : ""}`} onClick={() => { setMode("therapy"); announce("Trump Therapy selected."); }}>
                <span className="pe-mode-icon"><Brain size={18} /></span><span><strong>Trump Therapy</strong><small>A different kind of session</small></span><ChevronRight size={16} />
              </button>
              <button type="button" className={`pe-mode-card ${mode === "fortune" ? "selected" : ""}`} onClick={() => { setMode("fortune"); announce("Fortune Parlor selected."); }}>
                <span className="pe-mode-icon"><CircleHelp size={18} /></span><span><strong>Fortune Parlor</strong><small>Step into the unknown</small></span><ChevronRight size={16} />
              </button>
            </div>
            <button type="button" className="pe-sports" onClick={() => { setMode("sports"); announce("Sports Book selected."); }}>
              <span className="pe-sports-symbol">S</span><span><strong>SPORTS BOOK</strong><small>Another room, another conversation</small></span><ChevronRight size={17} />
            </button>
          </section>
          <footer className="pe-footer"><span>THE ARENA</span><span>AI personas. Real conversations.</span></footer>
        </div>
      </div>

      {notice && <div className="pe-toast" role="status">{notice}</div>}
      {setupOpen && <div className="pe-modal-backdrop" onClick={() => setSetupOpen(false)}>
        <section className="pe-setup-modal" role="dialog" aria-modal="true" aria-labelledby="pe-setup-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="pe-modal-close" aria-label="Close setup" onClick={() => setSetupOpen(false)}><X size={18} /></button>
          <span className="pe-overline">FIRST-DEBATE SETUP · PREVIEW</span>
          <h2 id="pe-setup-title">What should the room debate?</h2>
          <p>Choose a starting question. You can change it before you enter.</p>
          <label className="pe-topic-label" htmlFor="pe-topic">STARTING QUESTION</label>
          <button type="button" className="pe-topic-select" onClick={() => setTopic(topic === "The cost of everyday life" ? "How should the country power its future?" : "The cost of everyday life")}>
            <MessageCircle size={17} /><span>{topic}</span><ChevronDown size={16} />
          </button>
          <div className="pe-setup-voices">
            <span>VOICES IN THE SAMPLE</span>
            <div><span><img src="/__mockup/images/persona-trump.png" alt="" /> Donald Trump</span><span><img src="/__mockup/images/persona-biden.png" alt="" /> Joe Biden</span></div>
          </div>
          <div className="pe-trial-note"><Check size={15} /><span><strong>2-minute free trial</strong><br />No official verdict is awarded in the trial.</span></div>
          <button type="button" className="pe-enter-preview" onClick={() => { setSetupOpen(false); announce("Setup preview saved locally. No debate has started."); }}>
            CONTINUE TO SETUP PREVIEW <ArrowRight size={16} />
          </button>
          <small className="pe-prototype-note">Prototype only — this won't start a debate or use your microphone.</small>
        </section>
      </div>}
    </main>
  );
}