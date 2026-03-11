function SportsBettingModule(containerId) {
  this.el = document.getElementById(containerId);
  this.p1 = 'trump';
  this.p2 = 'buffett';
  this.voted = false;
  this.games = [];
  this.h2h = { w: 0, l: 0, t: 0 };
  this.personas = {
    trump:{name:"Trump",color:"#ff4d4d",img:"/api/persona-image/trump"},
    buffett:{name:"Buffett",color:"#4d4dff",img:"/api/persona-image/buffett"},
    musk:{name:"Elon",color:"#00ccff",img:"/api/persona-image/musk"},
    jordan:{name:"MJ",color:"#CE1141",img:"/api/persona-image/jordan"},
    bernie:{name:"Bernie",color:"#9B59B6",img:"/api/persona-image/bernie"},
    ruckus:{name:"Ruckus",color:"#8B4513",img:"/api/persona-image/ruckus"},
    genie:{name:"Genie",color:"#9B59B6",img:"/api/persona-image/genie"},
    grandma:{name:"Grandma",color:"#ffffff",img:"/api/persona-image/grandma"},
    suze:{name:"Suze",color:"#ff99cc",img:"/api/persona-image/suze"},
    dave:{name:"Dave",color:"#ffaa00",img:"/api/persona-image/dave"},
    mansa:{name:"Mansa",color:"#D4AF37",img:"/api/persona-image/mansa"}
  };
  this.picks = {
    trump:{nfl:"Take the FAVORITE! Winners pick winners!",nba:"Lakers — tremendous team.",ufc:"The toughest guy wins. Always.",mlb:"Yankees! New York's team. MY team.",soccer:"Real Madrid — they're like me. Winners.",g:"I pick winners. Always."},
    buffett:{nfl:"Look for value where the public overreacts.",nba:"Take the under. Be contrarian.",ufc:"Take the underdog at +200.",mlb:"Think season totals, not one game.",soccer:"The draw at +240 is where value lives.",g:"Find mispriced lines. Be patient."},
    musk:{nfl:"The OVER. We're going to Mars, not playing defense.",nba:"Player props. Individual performance is more predictable.",ufc:"Underdog by KO. Maximum disruption.",mlb:"First 5 innings bet. Limit your downside.",soccer:"Both teams to score. Chaos is certainty.",g:"Take the contrarian bet."},
    jordan:{nfl:"Take the better team. Champions win.",nba:"Take the under. Defense wins championships.",ufc:"Bet on the champion. Mentality matters.",mlb:"Bet on the ace pitcher.",soccer:"The team with more hunger.",g:"Winners want the ball when the game is on the line."},
    bernie:{nfl:"I ain't finna bet! But if I DID... take the over!",nba:"Gimme the team wit' the most heart!",ufc:"I'd take the underdog! I LOVE an underdog!",mlb:"If the Yankees playin', bet the Yanks.",soccer:"Sheeeeit, I don't watch soccer. Pick anybody!",g:"Don't be out here actin' a fool wit' yo money!"},
    ruckus:{nfl:"I'm takin' the home team. Less trouble.",nba:"The team wit' better defense. Defense don't lie.",ufc:"The bigger man wins! Simple as that!",mlb:"Bet the pitcher. A good arm don't lie!",soccer:"Take the draw. Nobody deserves to win.",g:"I don't trust gamblin'. At ALL."},
    genie:{nfl:"The underdog shall rise! Choose WISELY, master!",nba:"Take the team with fresher legs. The lamp knows!",ufc:"The underdog by submission!",mlb:"Take the over. Magic favors abundance!",soccer:"The draw — the universe seeks BALANCE!",g:"You have THREE betting wishes. Use them wisely!"},
    grandma:{nfl:"Oh dear, I just hope nobody gets hurt!",nba:"Just enjoy the game, honey.",ufc:"Fighting?! Oh my, please be careful!",mlb:"Your grandfather'd say bet the home team.",soccer:"They run around so much!",g:"Don't bet your rent money, sweetie."},
    suze:{nfl:"Set a LIMIT! Then take the under.",nba:"Small, responsible bets only!",ufc:"That's your emergency fund you're risking! DENIED!",mlb:"Do you have 8 months saved? Didn't think so.",soccer:"International betting = currency risk!",g:"Can you AFFORD to lose this money?"},
    dave:{nfl:"GAMBLING IS DUMB! Enjoy the game, pay off your card.",nba:"If you have DEBT, do NOT bet!",ufc:"Fight your way out of DEBT!",mlb:"Put that money in MUTUAL FUNDS!",soccer:"Put that money in your Roth IRA!",g:"Sports betting is for people who can't do MATH!"},
    mansa:{nfl:"Pick the richer franchise.",nba:"Take the team that controls pace.",ufc:"Bet on the one with the most to prove.",mlb:"Take the team with the better bullpen.",soccer:"Take the home side. Home is empire.",g:"Don't collapse YOUR economy with bad bets."}
  };
  this.trashTalk = {
    trump:["I've won more than {o} has DREAMED of winning!","Nobody knows sports like me. NOBODY."],
    buffett:["The odds favor patience, not {o}'s impulsiveness.","Value is found where {o} panics."],
    jordan:["I took {o}'s pick PERSONALLY.","Six rings > {o}'s record."],
    bernie:["Man, {o} don't know NOTHIN'!","Sheeeeit, my GRANDMAMA picks better!"],
    ruckus:["I don't trust {o}'s picks OR judgment!","{o} couldn't pick a winner to save their life!"],
    genie:["In 10,000 years, never seen picks as bad as {o}'s!","The lamp reveals {o} is WRONG!"],
    grandma:["Oh, {o} is nice, but Grandma knows best.","Your grandfather always said don't listen to {o}."],
    musk:["My rockets have better odds than {o}'s picks!","{o} is literally wrong. Like, literally."],
    suze:["Can {o} AFFORD to be this wrong? DENIED!","{o} should check their financial health before giving picks."],
    dave:["Debt-free people pick winners. {o} picks losers.","{o} needs to take Financial Peace University."],
    mansa:["In my empire, {o} would be the court jester.","I've funded better picks than {o} could dream of."]
  };
  this.affiliates = {
    draftkings:{name:'DraftKings',url:'https://www.draftkings.com',logo:'\u{1F7E2}'},
    fanduel:{name:'FanDuel',url:'https://www.fanduel.com',logo:'\u{1F535}'}
  };
  this.loadH2H();
  this.bindEvents();
  this.fetchGames();
}

SportsBettingModule.prototype.getPick = function(pid, game) {
  var lk = (game.league || '').toLowerCase();
  var p = this.picks[pid];
  if (!p) return "No comment.";
  return p[lk] || p.g || "No comment.";
};

SportsBettingModule.prototype.getTalk = function(pid, opponentName) {
  var lines = this.trashTalk[pid] || ["I know more about sports than {o}!"];
  var l = lines[Math.floor(Math.random() * lines.length)];
  return l.replace(/\{o\}/g, opponentName);
};

SportsBettingModule.prototype.speak = function(pid, text) {
  var btn = this.el.querySelector('[data-speak="' + pid + '"]');
  if (btn) btn.textContent = '...';
  fetch('/api/persona-speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 300), personaId: pid })
  })
  .then(function(r) { return r.blob(); })
  .then(function(b) {
    var u = URL.createObjectURL(b);
    var a = new Audio(u);
    a.play();
    a.onended = function() { URL.revokeObjectURL(u); };
    if (btn) btn.textContent = '\u{1F50A}';
  })
  .catch(function() { if (btn) btn.textContent = '\u{1F50A}'; });
};

SportsBettingModule.prototype.selectPersona = function(id) {
  if (id === this.p1) return;
  if (id === this.p2) { this.p2 = this.p1; this.p1 = id; }
  else { this.p2 = id; }
  this.voted = false;
  this.loadH2H();
  this.render();
};

SportsBettingModule.prototype.castVote = function(winnerId, loserId) {
  if (this.voted) return;
  this.voted = true;
  fetch('/api/faceoff/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debateId: 'sports_' + winnerId + '_' + loserId + '_' + Date.now(), asset: 'sports', persona1: winnerId, persona2: loserId, votedFor: winnerId })
  }).catch(function() {});
  this.h2h.w += (winnerId === this.p1 ? 1 : 0);
  this.h2h.l += (winnerId === this.p2 ? 1 : 0);
  this.h2h.t += 1;
  this.saveH2H();
  this.render();
};

SportsBettingModule.prototype.loadH2H = function() {
  var k = 'sp_h2h_' + [this.p1, this.p2].sort().join('_');
  try { var s = localStorage.getItem(k); this.h2h = s ? JSON.parse(s) : { w: 0, l: 0, t: 0 }; }
  catch(e) { this.h2h = { w: 0, l: 0, t: 0 }; }
};

SportsBettingModule.prototype.saveH2H = function() {
  var k = 'sp_h2h_' + [this.p1, this.p2].sort().join('_');
  try { localStorage.setItem(k, JSON.stringify(this.h2h)); } catch(e) {}
};

SportsBettingModule.prototype.trackClick = function(programId) {
  var p = this.affiliates[programId];
  if (p) {
    window.open(p.url, '_blank');
    fetch('/api/track-viral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'sportsbook_click', data: { program: programId } })
    }).catch(function() {});
  }
};

SportsBettingModule.prototype.fmtTime = function(d) {
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var h = d.getHours(); var m = d.getMinutes();
  var ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return days[d.getDay()] + ' ' + h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
};

SportsBettingModule.prototype.defaultGames = function() {
  var n = new Date();
  var t1 = new Date(n); t1.setHours(20, 15, 0, 0);
  var t2 = new Date(n); t2.setDate(n.getDate() + 1); t2.setHours(19, 30, 0, 0);
  var t3 = new Date(n); t3.setDate(n.getDate() + (6 - n.getDay() + 7) % 7); t3.setHours(22, 0, 0, 0);
  return [
    { id: 1, league: 'NFL', game: 'Chiefs vs Bills', time: this.fmtTime(t1), odds: 'Chiefs -3.5 | O/U 48.5' },
    { id: 2, league: 'NBA', game: 'Lakers vs Celtics', time: this.fmtTime(t2), odds: 'Lakers +4 | O/U 225.5' },
    { id: 3, league: 'UFC', game: 'Jones vs Miocic', time: this.fmtTime(t3), odds: 'Jones -250 | Miocic +200' },
    { id: 4, league: 'MLB', game: 'Yankees vs Dodgers', time: this.fmtTime(t3), odds: 'Yankees +105 | Dodgers -125' },
    { id: 5, league: 'SOCCER', game: 'Real Madrid vs Barcelona', time: this.fmtTime(t3), odds: 'Madrid +120 | Draw +240' }
  ];
};

SportsBettingModule.prototype.fetchGames = function() {
  var self = this;
  fetch('/api/sports/upcoming')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      self.games = (d.games && d.games.length > 0) ? d.games : self.defaultGames();
      self.render();
    })
    .catch(function() {
      self.games = self.defaultGames();
      self.render();
    });
};

SportsBettingModule.prototype.render = function() {
  if (!this.el) return;
  this.el.style.display = 'block';
  var p1 = this.personas[this.p1], p2 = this.personas[this.p2];
  var fg = this.games[0] || { game: 'TBD', league: 'TBD', time: 'Soon' };
  var pk1 = this.getPick(this.p1, fg), pk2 = this.getPick(this.p2, fg);
  var tk1 = this.getTalk(this.p1, p2.name), tk2 = this.getTalk(this.p2, p1.name);
  var prog = this.affiliates.draftkings;
  var self = this;
  var h = '<div class="sports-inner">';
  h += '<div class="s-title">TRUMP\'S SPORTS BOOK</div>';
  h += '<div class="s-sub"><span class="s-live">LIVE PICKS</span></div>';

  h += '<div class="s-persona-row">';
  var ids = Object.keys(this.personas);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i], p = this.personas[id];
    var s1 = this.p1 === id, s2 = this.p2 === id;
    var bc = s1 ? p1.color : (s2 ? p2.color : '#333');
    h += '<div class="s-chip' + (s1 || s2 ? ' sel' : '') + '" style="border-color:' + bc + ';" data-persona="' + id + '">';
    h += '<img src="' + p.img + '" style="border-color:' + p.color + ';" onerror="this.style.display=\'none\'">';
    h += '<div class="s-chip-name" style="color:' + (s1 || s2 ? p.color : '#aaa') + ';">' + p.name + '</div></div>';
  }
  h += '</div>';

  h += '<div class="s-featured" data-aff="draftkings">';
  h += '<div class="s-f-logo">' + prog.logo + '</div>';
  h += '<div style="flex:1;"><h3>FEATURED: ' + prog.name + '</h3></div>';
  h += '<button class="s-f-btn">BET NOW</button></div>';

  h += '<div style="font-size:11px;color:#FFD700;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">TODAY\'S DEBATE: ' + fg.game + '</div>';
  h += '<div class="s-debate">';

  h += '<div class="s-debater" style="border-color:' + p1.color + ';">';
  h += '<img src="' + p1.img + '" style="border-color:' + p1.color + ';" onerror="this.style.display=\'none\'">';
  h += '<div class="s-d-name" style="color:' + p1.color + ';">' + p1.name + '</div>';
  h += '<div class="s-d-pick">' + pk1 + '</div>';
  h += '<button class="s-d-listen" data-speak="' + this.p1 + '" data-pickid="1">\u{1F50A}</button>';
  h += '<button class="s-vote-btn" style="background:' + p1.color + ';"' + (this.voted ? ' disabled' : '') + ' data-vote="' + this.p1 + '" data-loser="' + this.p2 + '">VOTE ' + p1.name.toUpperCase() + '</button>';
  h += '</div>';

  h += '<div class="s-vs">VS</div>';

  h += '<div class="s-debater" style="border-color:' + p2.color + ';">';
  h += '<img src="' + p2.img + '" style="border-color:' + p2.color + ';" onerror="this.style.display=\'none\'">';
  h += '<div class="s-d-name" style="color:' + p2.color + ';">' + p2.name + '</div>';
  h += '<div class="s-d-pick">' + pk2 + '</div>';
  h += '<button class="s-d-listen" data-speak="' + this.p2 + '" data-pickid="2">\u{1F50A}</button>';
  h += '<button class="s-vote-btn" style="background:' + p2.color + ';"' + (this.voted ? ' disabled' : '') + ' data-vote="' + this.p2 + '" data-loser="' + this.p1 + '">VOTE ' + p2.name.toUpperCase() + '</button>';
  h += '</div></div>';

  if (this.h2h.t > 0) {
    h += '<div class="s-h2h">HEAD-TO-HEAD: <span class="s-rec" style="color:' + p1.color + ';">' + p1.name + ' ' + this.h2h.w + '</span> - <span class="s-rec" style="color:' + p2.color + ';">' + this.h2h.l + ' ' + p2.name + '</span></div>';
  }

  if (this.voted) {
    h += '<div class="s-trash"><h4>TRASH TALK</h4>';
    h += '<div class="s-talk" style="color:' + p1.color + ';">"' + tk1 + '"</div>';
    h += '<div class="s-talk" style="color:' + p2.color + ';">"' + tk2 + '"</div></div>';
  }

  for (var g = 0; g < this.games.length; g++) {
    var game = this.games[g];
    h += '<div class="s-game">';
    h += '<div class="s-game-top"><span class="s-league">' + game.league + '</span><span class="s-time">' + game.time + '</span></div>';
    h += '<div class="s-matchup">' + game.game + '</div>';
    if (game.odds) h += '<div class="s-odds">' + game.odds + '</div>';
    h += '<div class="s-picks">';
    var debaters = [this.p1, this.p2];
    for (var d = 0; d < debaters.length; d++) {
      var pp = this.personas[debaters[d]], pick = this.getPick(debaters[d], game);
      h += '<div class="s-pick-line"><img src="' + pp.img + '" onerror="this.style.display=\'none\'"><span style="color:' + pp.color + ';font-weight:bold;">' + pp.name + ':</span> ' + pick + '</div>';
    }
    h += '</div>';
    h += '<button class="s-bet-btn" data-aff="draftkings">BET ON DRAFTKINGS</button>';
    h += '</div>';
  }

  h += '<div style="text-align:center;margin-top:12px;"><a href="/sports-betting" style="color:#FFD700;font-size:12px;text-decoration:none;">Open full Sports Book \u2192</a></div>';
  h += '<div class="s-disclaimer">21+ only. Gamble responsibly. 1-800-GAMBLER.<br>Affiliate links. Not real betting advice.</div>';
  h += '</div>';

  this.el.innerHTML = h;
};

SportsBettingModule.prototype.bindEvents = function() {
  var self = this;
  this.el.addEventListener('click', function(e) {
    var t = e.target;
    var persona = t.closest('[data-persona]');
    if (persona) { self.selectPersona(persona.getAttribute('data-persona')); return; }
    var speak = t.closest('[data-speak]');
    if (speak) {
      e.stopPropagation();
      var pid = speak.getAttribute('data-speak');
      var pickId = speak.getAttribute('data-pickid');
      var fg = self.games[0] || { game: 'TBD', league: 'TBD', time: 'Soon' };
      var text = self.getPick(pickId === '1' ? self.p1 : self.p2, fg);
      self.speak(pid, text);
      return;
    }
    var vote = t.closest('[data-vote]');
    if (vote) { self.castVote(vote.getAttribute('data-vote'), vote.getAttribute('data-loser')); return; }
    var aff = t.closest('[data-aff]');
    if (aff) { self.trackClick(aff.getAttribute('data-aff')); return; }
  });
};

window.SportsBettingModule = SportsBettingModule;
