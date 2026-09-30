import { useState } from "react";
import "./_group.css";

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
  { name: "Trump", img: "persona-trump.png", color: "#FFD700" },
  { name: "Vance", initials: "JV", color: "#60A5FA" },
  { name: "Elon", initials: "EM", color: "#C084FC" },
  { name: "Biden", img: "persona-biden.png", color: "#60A5FA" },
  { name: "DeSantis", img: "persona-desantis.jpg", color: "#3B82F6" },
  { name: "Maddow", initials: "RM", color: "#F87171" },
  { name: "Bernie", initials: "BS", color: "#F87171" },
  { name: "Carville", initials: "JC", color: "#34D399" },
  { name: "Megyn", initials: "MK", color: "#A78BFA" },
  { name: "Candace", initials: "CO", color: "#FB923C" },
  { name: "AOC", initials: "AOC", color: "#F472B6" },
  { name: "Tucker", initials: "TC", color: "#FBBF24" },
];

const rules = [
  ["♙", "Pick 2-17 AI personas to debate. Each has a unique political voice & personality."],
  ["▤", "Choose a hot topic from today's headlines or create your own. The AI debaters will argue about it in real time."],
  ["◷", "Debates are timed (5/10/15 min). Each minute costs 1 token. When time runs out, the bell rings."],
  ["♬", "Use the MIC button to jump in and challenge the debaters. They'll respond to you directly."],
  ["☆", "Award POINTS to personas you think are winning. At the end, the winner gets roasted and fires back."],
  ["♜", "Vote for your favorite persona — votes count on the GLOBAL leaderboard. Earn reward tokens by spending time in the Arena."],
  ["▣", "BREAKING NEWS can interrupt mid-debate — all personas react in character when it hits."],
];

export function CurrentSetup() {
  const [musicOn, setMusicOn] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [teamBattleOpen, setTeamBattleOpen] = useState(false);
  const [duration, setDuration] = useState(5);
  const [selected, setSelected] = useState(["trump", "jdvance", "elon", "biden", "desantis"]);
  const [mode, setMode] = useState("elevated");
  const [category, setCategory] = useState("politics");
  const [customTopic, setCustomTopic] = useState(false);
  const [topic, setTopic] = useState<number | null>(null);

  return (
    <main className="arena-flow-page setup-screen">
      <div className="setup-backdrop" aria-hidden="true" />
      <div className="setup-shade" aria-hidden="true" />
      <div className="setup-scroll">
        <div className="setup-content">
          <header className="setup-title">
            <h1>CHOOSE YOUR DEBATERS</h1>
            <div className="arena-kicker"><span>♨</span> THE ARENA <span>♨</span></div>
            <button className={`music-chip ${musicOn ? "music-active" : ""}`} onClick={() => setMusicOn(!musicOn)}>
              <span>{musicOn ? "♫" : "♬"}</span> MUSIC {musicOn ? "ON" : "OFF"}
            </button>
          </header>

          <button className={`rules-toggle ${showRules ? "rules-open" : ""}`} onClick={() => setShowRules(!showRules)}>
            <span className="info-icon">ⓘ</span>
            <span>TAP HERE FOR RULES &amp; HOW TO PLAY</span>
            <span className="rules-chevron">{showRules ? "⌃" : "⌄"}</span>
          </button>
          {showRules && (
            <div className="rules-panel">
              {rules.map(([icon, text]) => <div className="rule-row" key={text}><span>{icon}</span><p>{text}</p></div>)}
            </div>
          )}

          <section className="team-card">
            <button className="team-heading" onClick={() => setTeamBattleOpen(!teamBattleOpen)}>
              <span><b>TEAM BATTLE MODE</b><small>4-vs-4 ideology group showdown</small></span>
              <span>{teamBattleOpen ? "⌃" : "⌄"}</span>
            </button>
            {teamBattleOpen && <div className="team-details"><small>Team A</small><p>Conservative　Progressive　Libertarian　Centrist</p><small>Team B</small><p>Draft two ideology groups for the matchup</p><button>DRAFT ROSTERS</button></div>}
          </section>

          <section className="duration-card">
            <div className="card-heading">
              <span><b>SESSION LENGTH</b><small>Choose 5, 10, or 15 minutes · 1 token per minute</small></span>
              <span className="timer-icon">◷</span>
            </div>
            <div className="duration-options">
              {[5, 10, 15].map((minutes) => <button className={duration === minutes ? "duration-active" : ""} key={minutes} onClick={() => setDuration(minutes)}><b>{minutes} MIN</b><small>{minutes} TOKENS</small></button>)}
            </div>
            <button className="unlock-inline">UNLOCK {duration} MIN · {duration} TOKENS</button>
          </section>

          <div className="mode-link interview-link"><span className="mode-icon">♩</span><span><b>1-ON-1 INTERVIEWS</b><small>Maddow grills Trump · Megyn vs Bernie · 5/10/15 min</small></span><span>›</span></div>
          <div className="mode-link stage-link"><span className="mode-icon">◉</span><span><b>1-ON-1 DEBATE</b><small>Pick a moderator · cut mics · timed rounds</small></span><span>›</span></div>
          <div className="mode-link fame-link"><span className="mode-icon">♛</span><span><b>HALL OF FAME</b><small>All-time debate rankings · updated in real time</small></span><span>›</span></div>

          <div className="selection-heading">
            <b>{selected.length} DEBATERS SELECTED</b>
            <div><button onClick={() => setSelected(personas.map((p) => p.name.toLowerCase()))}>All</button><button onClick={() => setSelected(["trump"])}>Trump Only</button></div>
          </div>
          {["PRESIDENTS", "POLITICIANS", "JOURNALISTS", "COMMENTATORS"].map((group, groupIndex) => {
            const groupPeople = groupIndex === 0 ? personas.slice(0, 1) : groupIndex === 1 ? personas.slice(1, 5) : groupIndex === 2 ? personas.slice(5, 7).concat(personas.slice(8, 9)) : personas.slice(7, 8).concat(personas.slice(9));
            return <section className="persona-group" key={group}>
              <div className="persona-group-heading"><i />{group}<span />{groupPeople.filter((p) => selected.includes(p.name.toLowerCase())).length}/{groupPeople.length}</div>
              <div className="persona-grid">{groupPeople.map((p) => {
                const id = p.name.toLowerCase();
                const selectedIndex = selected.indexOf(id);
                return <button className="persona-item" key={p.name} onClick={() => setSelected(selectedIndex >= 0 ? selected.filter((entry) => entry !== id) : [...selected, id])}>
                  <span className={`persona-avatar ${selectedIndex >= 0 ? "persona-selected" : ""}`} style={{ borderColor: selectedIndex >= 0 ? p.color : "rgba(255,255,255,0.13)", color: p.color }}>
                    {p.img ? <img src={`/__mockup/images/${p.img}`} alt="" /> : p.initials}
                    {selectedIndex >= 0 && <i>{selectedIndex + 1}</i>}
                  </span>
                  <span className="persona-name" style={{ color: selectedIndex >= 0 ? p.color : "rgba(255,255,255,.72)" }}>{p.name}</span>
                </button>;
              })}</div>
            </section>;
          })}

          <section className="bet-card"><b>🎰 IQ RACE BET</b><p>Pick who ends with the LOWEST IQ — win 2.5× your bet</p><div className="risk-row"><span>Risk:</span><button>🟢 LOW</button><button>🟡 MED</button><button>🔴 HIGH</button></div><div className="wager-row"><span>Wager:</span>{[1, 2, 3, 5, 10].map((v) => <button key={v}>{v}</button>)}</div></section>

          <div className="section-label">DEBATE MODE</div>
          <div className="mode-options">{[["civil", "🕊 Civil", "Facts & logic", "#60A5FA"], ["elevated", "🔥 Elevated", "Heated debate", "#FFD700"], ["savage", "💀 Savage", "No holds barred", "#FF4D4D"]].map(([id, name, sub, color]) => <button className={mode === id ? "mode-active" : ""} key={id} style={{ "--mode-color": color } as React.CSSProperties} onClick={() => setMode(id)}><b>{name}</b><small>{sub}</small></button>)}</div>

          <div className="topic-heading"><b>CHOOSE TOPIC</b><button>⟳　REFRESH</button></div>
          <div className="topic-categories">{[["politics", "🏛 Politics", "#FF4D4D"], ["sports", "🏆 Sports", "#F59E0B"], ["science", "🔭 Science", "#60A5FA"], ["health", "💊 Health", "#4ADE80"], ["wealth", "💰 Wealth", "#FFD700"], ["finance", "📈 Finance", "#A78BFA"], ["motivation", "🚀 Motivation", "#FB923C"]].map(([id, label, color]) => <button className={category === id ? "category-active" : ""} key={id} style={{ "--category-color": color } as React.CSSProperties} onClick={() => setCategory(id)}>{label}</button>)}</div>
          <button className={`custom-topic-toggle ${customTopic ? "custom-topic-active" : ""}`} onClick={() => { setCustomTopic(!customTopic); setTopic(null); }}>✎　CREATE YOUR OWN TOPIC</button>
          {customTopic && <textarea placeholder="Type your debate topic..." maxLength={200} />}
          {!customTopic && topics.map(([title, description], i) => <button className={`topic-card ${topic === i ? "topic-selected" : ""}`} key={title} onClick={() => setTopic(topic === i ? null : i)}><b>{title}</b><small>{description}</small></button>)}

          <button className="start-debate">
            <b>START DEBATE</b>
            <small>{selected.length} debaters　•　{topic !== null ? "Topic selected" : customTopic ? "Custom topic" : "Random topic"}</small>
          </button>
          <div className="donate-note">Support independent debate entertainment</div>
        </div>
      </div>
      <style>{`
        .setup-screen{position:relative;overflow:hidden}
        .setup-backdrop{position:absolute;inset:0;background-image:url('/__mockup/images/dynamic-creations-arena-bg.jpg');background-size:cover;background-position:center;opacity:.28}
        .setup-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.72),rgba(0,0,0,.55),rgba(0,0,0,.78));pointer-events:none}
        .setup-scroll{position:relative;z-index:1;height:100vh;overflow-y:auto;overscroll-behavior:contain}
        .setup-content{padding:20px;padding-bottom:40px}
        .setup-title{display:flex;flex-direction:column;align-items:center;margin:0 0 16px}
        .setup-title h1{margin:0;text-align:center;color:#FFD700;font-size:28px;font-weight:900;letter-spacing:2px;text-shadow:0 0 20px rgba(255,215,0,.6)}
        .arena-kicker{display:flex;align-items:center;margin-top:6px;color:rgba(255,255,255,.5);font-size:13px;gap:8px}
        .arena-kicker span{color:#FF4D4D;font-size:20px}
        .music-chip{display:flex;align-items:center;gap:6px;margin-top:10px;padding:6px 12px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);font-size:11px;font-weight:700}
        .music-active{border-color:rgba(255,215,0,.4);color:#FFD700}
        .rules-toggle{width:100%;display:flex;align-items:center;text-align:left;gap:8px;padding:12px;margin-bottom:14px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.05);color:#aaa;font-size:13px;font-weight:800}
        .info-icon,.rules-chevron{color:#888;font-size:18px}.rules-toggle span:nth-child(2){flex:1}
        .rules-open{border-color:rgba(255,77,77,.4);background:rgba(255,77,77,.15);color:#FF4D4D}
        .rules-open .info-icon,.rules-open .rules-chevron{color:#FF4D4D}
        .rules-panel{margin:-2px 0 14px;padding:14px;border:1px solid rgba(255,77,77,.2);border-radius:12px;background:rgba(255,77,77,.08)}
        .rule-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:10px}.rule-row:last-child{margin-bottom:0}.rule-row>span{color:#FF6B6B;font-size:15px}.rule-row p{margin:0;color:rgba(255,255,255,.7);font-size:12px;line-height:17px}
        .team-card,.duration-card{margin-bottom:14px;padding:14px;border-radius:14px}
        .team-card{border:1.5px solid #00C896;background:rgba(0,200,150,.08)}
        .team-heading{width:100%;display:flex;align-items:center;justify-content:space-between;padding:0;border:0;background:transparent;text-align:left;color:#00C896}
        .team-heading span:first-child,.card-heading span:first-child{display:flex;flex-direction:column}
        .team-heading b,.card-heading b{font-size:13px;font-weight:900;letter-spacing:1px}
        .team-heading small,.card-heading small{margin-top:3px;color:rgba(255,255,255,.55);font-size:10px}
        .team-details{margin-top:12px;color:rgba(255,255,255,.65);font-size:11px}.team-details p{margin:6px 0 10px}.team-details button{padding:8px 14px;border:0;border-radius:10px;background:#00C896;color:#001a14;font-size:12px;font-weight:800}
        .duration-card{border:1.5px solid #FFD700;background:rgba(255,215,0,.08)}
        .card-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        .card-heading b{color:#FFD700}.timer-icon{color:#FFD700;font-size:22px}
        .duration-options{display:flex;gap:10px;margin-top:14px;margin-bottom:4px}
        .duration-options button{flex:1;display:flex;flex-direction:column;align-items:center;padding:12px 4px;border:2px solid transparent;border-radius:12px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.6)}
        .duration-options .duration-active{border-color:#FFD700;background:rgba(255,215,0,.12);color:#FFD700}
        .duration-options b{font-size:15px}.duration-options small{margin-top:2px;color:rgba(255,255,255,.35);font-size:11px}.duration-options .duration-active small{color:rgba(255,215,0,.7)}
        .unlock-inline{width:100%;margin-top:12px;padding:14px 8px;border:0;border-radius:14px;background:#FFD700;color:#000;font-size:15px;font-weight:900}
        .mode-link{display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:14px;border-radius:14px}
        .mode-link>span:nth-child(2){flex:1;display:flex;flex-direction:column}.mode-link b{font-size:14px;font-weight:900;letter-spacing:1px}.mode-link small{margin-top:2px;color:rgba(255,255,255,.6);font-size:11px}.mode-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:20px;font-size:20px}
        .interview-link,.fame-link{border:1px solid #FFD700;background:rgba(255,215,0,.12);color:#FFD700}.interview-link .mode-icon,.fame-link .mode-icon{background:rgba(255,215,0,.25)}
        .stage-link{border:1px solid #f43f5e;background:rgba(244,63,94,.12);color:#f43f5e}.stage-link .mode-icon{background:rgba(244,63,94,.25)}
        .selection-heading{display:flex;justify-content:space-between;align-items:center;margin:4px 0 10px;color:#FFD700;font-size:14px;font-weight:800}
        .selection-heading div{display:flex;gap:12px}.selection-heading button{border:0;background:none;color:rgba(255,255,255,.5);font-size:12px;font-weight:600;padding:0}
        .persona-group{margin-bottom:18px}.persona-group-heading{display:flex;align-items:center;gap:8px;margin-bottom:10px;color:#60A5FA;font-size:11px;font-weight:800;letter-spacing:1.5px}
        .persona-group-heading i{width:3px;height:14px;border-radius:2px;background:#60A5FA}.persona-group-heading span{height:1px;flex:1;background:rgba(96,165,250,.16)}
        .persona-grid{display:flex;flex-wrap:wrap;gap:10px}.persona-item{width:68px;display:flex;flex-direction:column;align-items:center;padding:0;border:0;background:transparent}
        .persona-avatar{position:relative;width:60px;height:60px;display:grid;place-items:center;overflow:hidden;border:1.5px solid rgba(255,255,255,.13);border-radius:50%;background:rgba(255,255,255,.05);font-size:15px;font-weight:800}
        .persona-avatar img{width:100%;height:100%;object-fit:cover}.persona-avatar.persona-selected{border-width:2.5px;box-shadow:0 0 14px rgba(255,215,0,.25)}
        .persona-avatar i{position:absolute;right:1px;bottom:1px;width:18px;height:18px;display:grid;place-items:center;border:1.5px solid #0a0a0a;border-radius:50%;background:#FFD700;color:#000;font-size:10px;font-style:normal;font-weight:900}
        .persona-name{max-width:66px;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:600;text-align:center}
        .bet-card{margin:0 0 16px;padding:14px;border:1.5px solid rgba(251,191,36,.35);border-radius:14px;background:rgba(251,191,36,.06)}
        .bet-card>b{color:#FBBF24;font-size:13px;font-weight:900}.bet-card p{margin:5px 0 10px;color:rgba(255,255,255,.5);font-size:10px}
        .risk-row,.wager-row{display:flex;align-items:center;gap:6px;margin-bottom:10px}.risk-row>span,.wager-row>span{color:rgba(255,255,255,.4);font-size:10px}
        .risk-row button,.wager-row button{flex:1;padding:5px 2px;border:1px solid rgba(255,255,255,.15);border-radius:8px;background:transparent;color:#888;font-size:10px;font-weight:800}
        .wager-row button{flex:0 0 auto;padding:5px 10px;border-radius:16px}
        .section-label,.topic-heading>b{margin:4px 0 8px;color:#FFD700;font-size:14px;font-weight:800}
        .mode-options{display:flex;gap:8px;margin-bottom:14px}
        .mode-options button{flex:1;display:flex;flex-direction:column;align-items:center;padding:10px 3px;border:1.5px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);color:#888}
        .mode-options .mode-active{border-color:var(--mode-color);background:color-mix(in srgb,var(--mode-color) 9%,transparent);color:var(--mode-color)}
        .mode-options b{font-size:12px;font-weight:800}.mode-options small{margin-top:2px;color:rgba(255,255,255,.5);font-size:10px}
        .topic-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.topic-heading button{padding:4px 10px;border:1px solid rgba(255,215,0,.25);border-radius:12px;background:rgba(255,215,0,.08);color:#FFD700;font-size:10px;font-weight:800}
        .topic-categories{display:flex;gap:6px;margin:0 -20px 10px;padding:2px 20px 8px;overflow-x:auto;scrollbar-width:none}
        .topic-categories button{flex:none;padding:7px 14px;border:1.5px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(255,255,255,.04);color:#888;font-size:12px;font-weight:700}
        .topic-categories .category-active{border-color:var(--category-color);background:color-mix(in srgb,var(--category-color) 12%,transparent);color:var(--category-color)}
        .custom-topic-toggle{width:100%;display:flex;align-items:center;padding:12px;margin-bottom:10px;border:1.5px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);color:#ccc;font-size:14px;font-weight:800}
        .custom-topic-active{border-color:#FFD700;background:rgba(255,215,0,.12);color:#FFD700}
        .setup-screen textarea{width:100%;min-height:50px;margin-bottom:12px;padding:12px;border:1.5px solid #FFD700;border-radius:12px;background:rgba(255,215,0,.08);color:#fff;font-size:14px;resize:vertical}
        .setup-screen textarea::placeholder{color:rgba(255,255,255,.3)}
        .topic-card{width:100%;display:flex;flex-direction:column;align-items:flex-start;margin-bottom:8px;padding:12px;border:1.5px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);text-align:left}
        .topic-card b{color:#ccc;font-size:14px;font-weight:800}.topic-card small{display:-webkit-box;overflow:hidden;margin-top:3px;color:rgba(255,255,255,.4);font-size:11px;line-height:1.4;-webkit-box-orient:vertical;-webkit-line-clamp:2}
        .topic-card.topic-selected{border-color:#FF4D4D;background:rgba(255,77,77,.15)}.topic-card.topic-selected b{color:#FF4D4D}
        .start-debate{width:100%;display:flex;flex-direction:column;align-items:center;margin-top:20px;padding:16px;border:0;border-radius:16px;background:#FF4D4D}
        .start-debate b{font-size:18px;font-weight:900;letter-spacing:1px}.start-debate small{margin-top:2px;color:rgba(255,255,255,.6);font-size:11px}
        .donate-note{padding:24px 0;text-align:center;color:rgba(255,255,255,.25);font-size:10px}
      `}</style>
    </main>
  );
}