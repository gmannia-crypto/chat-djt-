import { Archive, Brain, ChevronRight, Megaphone, Mic, Settings, Share2, Volume2 } from "lucide-react";
import "./_group.css";

export function CurrentEntry() {
  return (
    <main className="arena-flow-page arena-entry">
      <div className="entry-safe-area">
        <header className="entry-header">
          <button type="button" className="archive-button" aria-label="Archive">
            <span className="archive-icon"><Archive size={18} strokeWidth={2.2} /></span>
            <span>ARCHIVE</span>
          </button>
          <div className="header-actions">
            <button type="button" className="header-icon sound-button" aria-label="Play welcome audio">
              <Volume2 size={16} />
            </button>
            <button type="button" className="token-button" aria-label="12 tokens">
              <img src="/__mockup/images/dc-lightning-token.jpeg" alt="" />
              <span>12</span>
            </button>
            <button type="button" className="header-icon" aria-label="Share">
              <Share2 size={16} />
            </button>
            <button type="button" className="header-icon" aria-label="Settings">
              <Settings size={16} />
            </button>
          </div>
        </header>

        <button type="button" className="entry-brand" aria-label="Dynamic Creations">
          <span>by</span>
          <img src="/__mockup/images/dynamic-creations.jpg" alt="Dynamic Creations" />
        </button>

        <div className="entry-scroll">
          <div className="entry-content">
            <section className="featured-arena" aria-label="The Arena">
              <div className="arena-card">
                <div className="arena-card-border" />
                <div className="arena-heading">
                  <span className="live-pill"><i />LIVE</span>
                  <h1>THE ARENA</h1>
                  <p>28 AI Personas. Real News. Live Debate.</p>
                </div>
                <div className="persona-names">Trump&nbsp;&nbsp; Biden&nbsp;&nbsp; Maddow&nbsp;&nbsp; Ruckus&nbsp;&nbsp; Omar&nbsp;&nbsp; Galloway</div>
                <div className="arena-main-cta">
                  <button type="button">
                    <Megaphone size={14} fill="currentColor" />
                    <span>TRY IT NOW FOR FREE</span>
                  </button>
                </div>
                <button type="button" className="interview-link">
                  <Mic size={14} />
                  <span>NEW · 1-ON-1 INTERVIEWS</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </section>

            <div className="secondary-modes" aria-label="More ways to explore">
              <button type="button" className="mode-tile therapy-tile">
                <Brain size={22} />
                <span>TRUMP THERAPY</span>
                <small>FREE</small>
              </button>
              <button type="button" className="mode-tile fortune-tile">
                <span className="fortune-icon">✦</span>
                <span>FORTUNE PARLOR</span>
                <small>TRY</small>
              </button>
            </div>

            <div className="sports-mode">
              <span className="sports-icon">♜</span>
              <strong>SPORTS BOOK</strong>
              <span className="sports-live"><i />LIVE</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .arena-entry{height:100vh;min-height:680px;overflow:hidden;background:#0a0a0a}
        .entry-safe-area{height:100%;display:flex;flex-direction:column;padding-top:40px;background:linear-gradient(180deg,rgba(10,10,10,.15),rgba(10,10,10,0),rgba(10,10,10,.25))}
        .entry-header{height:68px;flex:0 0 68px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:relative;z-index:3}
        .entry-header button,.entry-brand,.arena-entry button{font-family:inherit;cursor:pointer}
        .archive-button{width:56px;border:0;background:none;display:flex;flex-direction:column;align-items:center;gap:3px;padding:0;color:rgba(255,255,255,.65)}
        .archive-icon{width:38px;height:38px;border-radius:19px;background:#D4A420;border:1.5px solid #E8C84A;color:#1A1000;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(212,164,32,.4),inset 0 1px 2px rgba(255,255,255,.3)}
        .archive-button>span:last-child{font-size:11px;font-weight:600;letter-spacing:.3px}
        .header-actions{display:flex;align-items:center;gap:8px}
        .header-icon{width:32px;height:32px;border-radius:50%;border:1px solid rgba(212,164,32,.3);background:rgba(212,164,32,.15);color:#D4A420;display:flex;align-items:center;justify-content:center;padding:0}
        .token-button{height:28px;display:flex;align-items:center;gap:3px;padding:4px 8px;border:1px solid rgba(212,164,32,.3);border-radius:12px;background:rgba(212,164,32,.15);color:#D4A420;font-size:11px;font-weight:800}
        .token-button img{width:14px;height:14px;border-radius:50%;object-fit:cover}
        .entry-brand{align-self:center;display:flex;align-items:center;justify-content:center;gap:8px;margin:4px 0 6px;padding:10px 18px;border-radius:999px;border:1px solid rgba(255,215,0,.25);background:rgba(255,255,255,.04);color:rgba(255,215,0,.85);font-size:14px;font-style:italic;font-weight:600}
        .entry-brand img{width:150px;height:36px;object-fit:contain}
        .entry-scroll{z-index:1;flex:1;min-height:0;overflow:auto}
        .entry-content{display:flex;flex-direction:column;align-items:center;padding:10px 2px 24px}
        .featured-arena{width:calc(100% - 28px);max-width:348px;animation:arena-pulse 1.6s ease-in-out infinite}
        .arena-card{position:relative;overflow:hidden;border:2px solid rgba(255,77,77,.5);border-radius:16px;padding:20px;background:linear-gradient(135deg,#2a0a0a,#1a0505,#2a0a0a);box-shadow:0 0 20px rgba(255,77,77,.32);text-align:center}
        .arena-card-border{position:absolute;inset:-2px;border:2px solid rgba(255,77,77,.3);border-radius:18px;pointer-events:none}
        .arena-heading{position:relative;display:flex;align-items:center;flex-direction:column;gap:6px}
        .live-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:12px;border:1px solid rgba(255,77,77,.4);background:rgba(255,77,77,.2);color:#ff4d4d;font-size:10px;font-weight:900;letter-spacing:1.5px}
        .live-pill i,.sports-live i{width:6px;height:6px;border-radius:50%;background:#ff4d4d}
        .arena-heading h1{margin:0;color:#fff;font-size:22px;font-weight:900;letter-spacing:3px}
        .arena-heading p{margin:0;color:rgba(255,255,255,.6);font-size:12px;font-weight:500;letter-spacing:.5px}
        .persona-names{margin-top:10px;color:rgba(255,255,255,.45);font-size:10px;font-weight:600;letter-spacing:1px}
        .arena-main-cta{display:flex;justify-content:center;margin-top:14px}
        .arena-main-cta button{display:flex;align-items:center;gap:8px;padding:10px 24px;border:0;border-radius:25px;background:linear-gradient(90deg,#ff4d4d,#cc0000);color:#fff;font-size:13px;font-weight:900;letter-spacing:1.5px;white-space:nowrap}
        .interview-link{width:100%;margin-top:10px;padding:10px 14px;border:1px solid #FFD700;border-radius:12px;background:rgba(255,215,0,.12);display:flex;align-items:center;justify-content:center;gap:6px;color:#FFD700;font-size:12px;font-weight:900;letter-spacing:1px;white-space:nowrap}
        .secondary-modes{width:100%;max-width:342px;display:flex;gap:10px;margin-top:14px;margin-bottom:6px;padding:0 4px}
        .mode-tile{flex:1;min-width:0;min-height:52px;padding:14px 9px;border:0;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:7px;color:#fff;font-size:11px;font-weight:900;letter-spacing:.6px;white-space:nowrap}
        .therapy-tile{background:linear-gradient(135deg,#00C853,#00E676,#69F0AE);box-shadow:0 0 20px rgba(0,200,83,.3)}
        .fortune-tile{background:linear-gradient(135deg,#7C4DFF,#B388FF,#E040FB);box-shadow:0 0 20px rgba(124,77,255,.3)}
        .mode-tile small{padding:2px 6px;border-radius:8px;background:rgba(255,255,255,.25);font-size:9px;letter-spacing:.5px}
        .fortune-icon{font-size:21px;line-height:18px}
        .sports-mode{width:calc(100% - 48px);min-height:64px;margin-top:10px;padding:16px 12px;border:2px solid rgba(76,175,80,.6);border-radius:16px;display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#1a3a1a,#0d1f0d,#1a2a0f);color:#4CAF50}
        .sports-mode strong{font-size:15px;letter-spacing:2px}
        .sports-icon{font-size:20px}
        .sports-live{display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:8px;background:rgba(76,175,80,.14);font-size:9px;font-weight:900;letter-spacing:1px}
        .sports-live i{background:#4CAF50;width:5px;height:5px}
        @keyframes arena-pulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 12px rgba(255,77,77,.23))}50%{transform:scale(1.012);filter:drop-shadow(0 0 20px rgba(255,77,77,.42))}}
        @media(max-width:360px){.entry-header{padding:0 12px}.header-actions{gap:5px}.featured-arena{width:calc(100% - 20px)}.arena-card{padding:16px 12px}.interview-link{font-size:10px}.mode-tile{gap:4px;font-size:9px;padding-inline:5px}}
      `}</style>
    </main>
  );
}