import { useState } from "react";
import "./_group.css";
import "./ProposedPaywall.css";

const durations = [5, 10, 15] as const;
const tokenPacks = [
  { tokens: 15, price: "$2.99", note: "Covers a 15-minute session" },
  { tokens: 35, price: "$4.99", note: "One-time token pack" },
  { tokens: 80, price: "$9.99", note: "One-time token pack" },
] as const;

export function ProposedPaywall() {
  const [duration, setDuration] = useState<(typeof durations)[number]>(5);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"Standard" | "VIP" | null>(null);

  const revealPacks = () => {
    document.getElementById("arena-token-packs")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="arena-flow-page proposed-paywall">
      <div className="pp-atmosphere" aria-hidden="true" />
      <div className="pp-shell">
        <header className="pp-header">
          <div className="pp-brand">
            <span className="pp-mark" aria-hidden="true"><i /></span>
            <span>THE <b>ARENA</b></span>
          </div>
          <span className="pp-live-label"><i /> SESSION GATE</span>
        </header>

        <section className="pp-intro" aria-labelledby="pp-title">
          <div className="pp-kicker"><span>01</span><span className="pp-kicker-line" /> TRIAL COMPLETE</div>
          <h1 id="pp-title">Ready for the<br /><em>real verdict?</em></h1>
          <p className="pp-lede">Your free two-minute preview is over. Choose a ranked session to keep the debate going.</p>
        </section>

        <section className="pp-trial-note" aria-label="What your trial included">
          <div className="pp-trial-symbol" aria-hidden="true">02</div>
          <div>
            <div className="pp-eyebrow">YOUR FREE PREVIEW</div>
            <p>Two minutes of debate <span>·</span> no official verdict</p>
          </div>
          <div className="pp-preview-tag">PREVIEW</div>
        </section>

        <section className="pp-session" aria-labelledby="pp-session-title">
          <div className="pp-section-heading">
            <div>
              <div className="pp-eyebrow">NEXT ROUND</div>
              <h2 id="pp-session-title">Ranked session</h2>
            </div>
            <span className="pp-verdict-stamp">OFFICIAL<br />VERDICT</span>
          </div>
          <p className="pp-session-copy">A full session is ranked. Your trial was not.</p>

          <div className="pp-duration-label">
            <span>Choose your time</span>
            <span className="pp-rate">1 token / minute</span>
          </div>
          <div className="pp-duration-options" role="group" aria-label="Session duration">
            {durations.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={`pp-duration ${duration === minutes ? "is-selected" : ""}`}
                aria-pressed={duration === minutes}
                onClick={() => {
                  setDuration(minutes);
                  setSelectedPack(null);
                }}
              >
                <span className="pp-duration-number">{minutes}</span>
                <span className="pp-duration-unit">MIN</span>
                <span className="pp-duration-cost">{minutes} tokens</span>
              </button>
            ))}
          </div>

          <div className="pp-balance">
            <span className="pp-token-glyph" aria-hidden="true">◆</span>
            <span>Available balance</span>
            <strong>0 <small>tokens</small></strong>
          </div>
          <button className="pp-primary" type="button" onClick={revealPacks}>
            Find a pack for {duration} minutes <span aria-hidden="true">↓</span>
          </button>
          <p className="pp-clarity">You’ll need at least {duration} tokens. No payment is made here.</p>
        </section>

        <section className="pp-packs" id="arena-token-packs" aria-labelledby="pp-packs-title">
          <div className="pp-packs-heading">
            <div>
              <div className="pp-eyebrow">ONE-TIME TOKENS</div>
              <h2 id="pp-packs-title">Choose a pack</h2>
            </div>
            <span className="pp-one-time">NO SUBSCRIPTION</span>
          </div>
          <p className="pp-packs-copy">Every pack covers this session. Pick the amount that suits you.</p>
          <div className="pp-pack-list">
            {tokenPacks.map((pack) => (
              <button
                className={`pp-pack ${selectedPack === pack.tokens ? "is-selected" : ""}`}
                key={pack.tokens}
                type="button"
                aria-pressed={selectedPack === pack.tokens}
                onClick={() => setSelectedPack(pack.tokens)}
              >
                <span className="pp-pack-radio" aria-hidden="true">{selectedPack === pack.tokens ? "✓" : ""}</span>
                <span className="pp-pack-main">
                  <strong>{pack.tokens} <small>tokens</small></strong>
                  <span>{pack.note}</span>
                </span>
                <span className="pp-pack-price">{pack.price}</span>
              </button>
            ))}
          </div>
          {selectedPack !== null && (
            <div className="pp-selection-note" role="status">
              <span className="pp-selection-check" aria-hidden="true">✓</span>
              <span><b>{selectedPack} tokens selected.</b> This prototype stops before checkout.</span>
            </div>
          )}
        </section>

        <section className={`pp-membership ${plansOpen ? "is-open" : ""}`}>
          <button
            className="pp-membership-toggle"
            type="button"
            aria-expanded={plansOpen}
            onClick={() => setPlansOpen((open) => !open)}
          >
            <span className="pp-membership-icon" aria-hidden="true">＋</span>
            <span className="pp-membership-label">
              <b>Prefer a monthly plan?</b>
              <small>Explore Standard and VIP</small>
            </span>
            <span className="pp-membership-arrow" aria-hidden="true">{plansOpen ? "−" : "+"}</span>
          </button>
          {plansOpen && (
            <div className="pp-plan-options">
              {(["Standard", "VIP"] as const).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  className={`pp-plan-option ${selectedPlan === plan ? "is-selected" : ""}`}
                  aria-pressed={selectedPlan === plan}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <span>{plan}</span><span>{selectedPlan === plan ? "Selected" : "Monthly"}</span>
                </button>
              ))}
              {selectedPlan && (
                <p className="pp-plan-note" role="status">
                  {selectedPlan} selected to explore. No plan purchase is made here.
                </p>
              )}
            </div>
          )}
        </section>

        <footer className="pp-footer">
          <span>THE ARENA</span>
          <span>Choose your time. Then take the floor.</span>
        </footer>
      </div>
    </main>
  );
}