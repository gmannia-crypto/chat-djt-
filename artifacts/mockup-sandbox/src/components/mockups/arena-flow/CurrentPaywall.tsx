import { useState } from "react";
import "./_group.css";

export function CurrentPaywall() {
  const [duration, setDuration] = useState(5);

  return (
    <main className="arena-flow-page paywall-page">
      <div className="paywall-backdrop" aria-hidden="true">
        <div className="ghost-title">CHOOSE YOUR DEBATERS</div>
        <div className="ghost-team"><b>TEAM BATTLE MODE</b><span>4-vs-4 ideology group showdown</span></div>
        <div className="ghost-duration"><b>SESSION LENGTH</b><span>Choose 5, 10, or 15 minutes · 1 token per minute</span></div>
      </div>
      <div className="paywall-overlay">
        <section className="paywall-card" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
          <div className="lock-icon">▣</div>
          <h1 id="paywall-title">Arena Access Required</h1>
          <p className="paywall-subtitle">Choose your debate duration. 1 token per minute.</p>
          <div className="paywall-duration-row">
            {[5, 10, 15].map((minutes) => <button className={duration === minutes ? "paywall-duration-active" : ""} key={minutes} onClick={() => setDuration(minutes)}><span>{minutes} min</span><small>{minutes} tokens</small></button>)}
          </div>
          <div className="paywall-balance"><span>◆</span> 0 tokens available</div>
          <button className="paywall-primary">Unlock {duration} Min for {duration} Tokens</button>
          <button className="paywall-secondary">Get More Tokens</button>
          <button className="paywall-close">Close</button>
        </section>
      </div>
      <style>{`
        .paywall-page{position:relative;min-height:100vh;overflow:hidden}
        .paywall-backdrop{position:absolute;inset:0;padding:24px 20px;background-image:linear-gradient(180deg,rgba(0,0,0,.72),rgba(0,0,0,.55),rgba(0,0,0,.78)),url('/__mockup/images/dynamic-creations-arena-bg.jpg');background-size:cover;background-position:center;opacity:.48}
        .ghost-title{margin:12px 0 28px;text-align:center;color:rgba(255,215,0,.38);font-size:24px;font-weight:900;letter-spacing:2px}
        .ghost-team,.ghost-duration{margin-bottom:14px;padding:14px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.3)}
        .ghost-team b,.ghost-duration b{display:block;font-size:13px;font-weight:900;letter-spacing:1px}.ghost-team span,.ghost-duration span{display:block;margin-top:3px;font-size:10px}
        .paywall-overlay{position:relative;z-index:1;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.8)}
        .paywall-card{width:100%;max-width:340px;display:flex;flex-direction:column;align-items:center;padding:28px;border:1px solid rgba(255,215,0,.2);border-radius:20px;background:#1a1a1a;text-align:center}
        .lock-icon{height:36px;color:#FFD700;font-size:34px;line-height:36px}
        .paywall-card h1{margin:12px 0 0;color:#fff;font-size:20px;font-weight:900}
        .paywall-subtitle{margin:8px 0 0;color:rgba(255,255,255,.6);font-size:13px;line-height:18px}
        .paywall-duration-row{width:100%;display:flex;gap:10px;margin-top:14px;margin-bottom:4px}
        .paywall-duration-row button{flex:1;display:flex;flex-direction:column;align-items:center;padding:12px 3px;border:2px solid transparent;border-radius:12px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.6)}
        .paywall-duration-row .paywall-duration-active{border-color:#FFD700;background:rgba(255,215,0,.12);color:#FFD700}
        .paywall-duration-row button span{font-size:15px;font-weight:700}.paywall-duration-row button small{margin-top:2px;color:rgba(255,255,255,.35);font-size:11px}.paywall-duration-row .paywall-duration-active small{color:rgba(255,215,0,.7)}
        .paywall-balance{display:flex;align-items:center;gap:6px;margin-top:16px;padding:6px 12px;border-radius:12px;background:rgba(255,215,0,.1);color:#FFD700;font-size:13px;font-weight:700}
        .paywall-primary{width:100%;margin-top:16px;padding:14px 8px;border:0;border-radius:14px;background:#FFD700;color:#000;font-size:15px;font-weight:900}
        .paywall-secondary{margin-top:10px;padding:10px;border:0;background:transparent;color:rgba(255,255,255,.5);font-size:13px;font-weight:600}
        .paywall-close{margin-top:4px;padding:8px;border:0;background:transparent;color:rgba(255,255,255,.3);font-size:12px}
      `}</style>
    </main>
  );
}