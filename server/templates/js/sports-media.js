function SportsMediaModule(containerId) {
  this.el = document.getElementById(containerId);
  this.activeTab = 'live';
  this.games = [];
  this.results = [];
  this.selectedGame = null;
  this.currentPersona = 'trump';
  this.isPlaying = false;
  this.audioEl = null;
  this.commentaryQueue = [];
  this.commentaryIndex = 0;
  this.autoPlay = false;
  this.commentaryCache = {};
  this.fetchingCommentary = false;
  this.isActive = true;
  this.abortCtrl = null;
  this.prefetchPromise = null;
  this.prefetchKey = null;
  this.affiliateLinks = {
    barstool: { base: 'https://store.barstoolsports.com/?ref=chatdjt', commission: '6%' },
    westwood: { base: 'https://www.westwoodone.com/AFFILIATE/', commission: 'Contact for rates' },
    audacy: { base: 'https://www.audacy.com/stations/sports', commission: 'Varies by partnership' },
    betmgm: { base: 'https://play.betmgm.com/en/sports', commission: 'Varies' }
  };
  this.personas = {
    trump:{name:"Trump",color:"#ff4d4d",img:"/api/persona-image/trump"},
    buffett:{name:"Buffett",color:"#4d4dff",img:"/api/persona-image/buffett"},
    musk:{name:"Elon",color:"#00ccff",img:"/api/persona-image/musk"},
    jordan:{name:"MJ",color:"#CE1141",img:"/api/persona-image/jordan"},
    bernie:{name:"Bernie",color:"#9B59B6",img:"/api/persona-image/bernie"},
    ruckus:{name:"Ruckus",color:"#8B4513",img:"/api/persona-image/ruckus"},
    grandma:{name:"Grandma",color:"#ffffff",img:"/api/persona-image/grandma"},
    mansa:{name:"Mansa",color:"#D4AF37",img:"/api/persona-image/mansa"}
  };
  this.fetchGames();
}

SportsMediaModule.prototype.esc = function(s) {
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
};

SportsMediaModule.prototype.safeId = function(id) {
  return String(id).replace(/[^\w.-]/g, '');
};

SportsMediaModule.prototype.fetchGames = function() {
  var self = this;
  this.el.innerHTML = '<div class="feat-loading">\uD83D\uDCFB Tuning in to live sports...</div>';
  fetch('/api/sports/upcoming')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      self.games = (data.games || []).slice(0, 12);
      self.results = (data.results || []).slice(0, 6);
      self.render();
    })
    .catch(function() {
      self.games = [];
      self.results = [];
      self.render();
    });
};

SportsMediaModule.prototype.render = function() {
  var h = '<div class="sm-hub">';

  h += '<div class="sm-header">';
  h += '<div class="feat-title">\uD83D\uDCFB LIVE SPORTS AUDIO HUB</div>';
  h += '<div class="feat-sub">Listen to games, expert commentary, and get fan gear \u2013 all in one place</div>';
  h += '<div class="sm-aff-disc">\u26A1 Affiliate links \u2022 We earn commissions on purchases</div>';
  h += '</div>';

  h += '<div class="sm-tabs">';
  h += '<button class="sm-tab-btn' + (this.activeTab === 'live' ? ' sm-tab-active' : '') + '" data-sm-tab="live">\uD83D\uDD34 LIVE GAMES</button>';
  h += '<button class="sm-tab-btn' + (this.activeTab === 'commentary' ? ' sm-tab-active' : '') + '" data-sm-tab="commentary">\uD83C\uDF99\uFE0F SPORTS TALK</button>';
  h += '<button class="sm-tab-btn' + (this.activeTab === 'gear' ? ' sm-tab-active' : '') + '" data-sm-tab="gear">\uD83E\uDDE2 FAN GEAR</button>';
  h += '<button class="sm-tab-btn' + (this.activeTab === 'betting' ? ' sm-tab-active' : '') + '" data-sm-tab="betting">\uD83D\uDCCA BETTING ANALYSIS</button>';
  h += '</div>';

  h += '<div class="sm-tab-content">';
  if (this.activeTab === 'live') {
    if (this.selectedGame) {
      h += this.renderPlayer();
    } else {
      h += this.renderLiveTab();
    }
  } else if (this.activeTab === 'commentary') {
    h += this.renderCommentaryTab();
  } else if (this.activeTab === 'gear') {
    h += this.renderGearTab();
  } else if (this.activeTab === 'betting') {
    h += this.renderBettingTab();
  }
  h += '</div>';

  h += this.renderQuickLinks();

  h += '</div>';
  this.el.innerHTML = h;
};

SportsMediaModule.prototype.renderLiveTab = function() {
  var h = '';

  h += '<div class="sm-persona-strip">';
  var pKeys = Object.keys(this.personas);
  for (var i = 0; i < pKeys.length; i++) {
    var pk = pKeys[i];
    var p = this.personas[pk];
    var sel = pk === this.currentPersona;
    h += '<div class="sm-persona' + (sel ? ' sm-persona-sel' : '') + '" data-sm-persona="' + pk + '" style="border-color:' + (sel ? p.color : '#333') + '">';
    h += '<img src="' + p.img + '" alt="' + this.esc(p.name) + '">';
    h += '<span class="sm-p-name" style="color:' + (sel ? p.color : '#aaa') + '">' + this.esc(p.name) + '</span>';
    h += '</div>';
  }
  h += '</div>';

  var liveGames = this.games.filter(function(g) { return g.score; });
  var upcomingGames = this.games.filter(function(g) { return !g.score; });

  if (liveGames.length > 0) {
    h += '<div class="sm-section-label">\uD83D\uDD34 LIVE NOW</div>';
    for (var i = 0; i < liveGames.length; i++) {
      h += this.renderGameCard(liveGames[i], true);
    }
  }

  if (upcomingGames.length > 0) {
    h += '<div class="sm-section-label">\uD83D\uDCC5 UPCOMING</div>';
    for (var j = 0; j < upcomingGames.length; j++) {
      h += this.renderGameCard(upcomingGames[j], false);
    }
  }

  if (this.results.length > 0) {
    h += '<div class="sm-section-label">\u2705 FINAL</div>';
    for (var k = 0; k < this.results.length; k++) {
      h += this.renderGameCard(this.results[k], false);
    }
  }

  if (!liveGames.length && !upcomingGames.length && !this.results.length) {
    h += '<div class="feat-loading">No games found right now. Check back soon!</div>';
  }

  h += '<div class="sm-stream-note">';
  h += '<p>\uD83D\uDCA1 <strong>Westwood One Sports 24/7</strong> \u2013 featuring "The Jim Rome Show" (3\u20136pm ET) and BetMGM Network programming</p>';
  h += '</div>';

  return h;
};

SportsMediaModule.prototype.renderGameCard = function(game, isLive) {
  var h = '<div class="sm-game-card' + (isLive ? ' sm-live-card' : '') + '" data-sm-game="' + this.safeId(game.id) + '">';
  h += '<div class="sm-game-top">';
  h += '<span class="s-league">' + this.esc(game.league) + '</span>';
  if (isLive) {
    h += '<span class="s-live">\uD83D\uDD34 LIVE</span>';
  } else if (game.final) {
    h += '<span class="sm-final-badge">FINAL</span>';
  } else {
    h += '<span class="s-time">' + this.esc(game.time) + '</span>';
  }
  h += '</div>';
  h += '<div class="sm-game-matchup">' + this.esc(game.game) + '</div>';
  if (game.score) {
    h += '<div class="sm-game-score">' + this.esc(game.score) + '</div>';
  }
  h += '<div class="sm-game-action">';
  if (isLive || game.final) {
    h += '<span class="sm-listen-cta">\uD83C\uDFA7 Listen</span>';
  } else {
    h += '<span class="sm-preview-cta">\uD83D\uDD2E Preview</span>';
  }
  h += '</div>';
  h += '</div>';
  return h;
};

SportsMediaModule.prototype.renderPlayer = function() {
  var g = this.selectedGame;
  var p = this.personas[this.currentPersona];
  var h = '';

  h += '<button class="sm-back" data-sm-back>\u2190 All Games</button>';

  h += '<div class="sm-persona-strip">';
  var pKeys = Object.keys(this.personas);
  for (var i = 0; i < pKeys.length; i++) {
    var pk = pKeys[i];
    var pp = this.personas[pk];
    var sel = pk === this.currentPersona;
    h += '<div class="sm-persona' + (sel ? ' sm-persona-sel' : '') + '" data-sm-persona="' + pk + '" style="border-color:' + (sel ? pp.color : '#333') + '">';
    h += '<img src="' + pp.img + '" alt="' + this.esc(pp.name) + '">';
    h += '<span class="sm-p-name" style="color:' + (sel ? pp.color : '#aaa') + '">' + this.esc(pp.name) + '</span>';
    h += '</div>';
  }
  h += '</div>';

  h += '<div class="sm-now-playing">';
  h += '<div class="sm-station">';
  if (g.score) {
    h += '<span class="s-live">\uD83D\uDD34 LIVE</span> ';
  }
  h += this.esc(g.league) + ' \u2022 ' + this.esc(g.game);
  h += '</div>';
  if (g.score) {
    h += '<div class="sm-score-big">' + this.esc(g.score) + '</div>';
  }
  h += '<div class="sm-time-info">' + this.esc(g.time || '') + '</div>';
  h += '</div>';

  h += '<div class="sm-booth">';
  h += '<div class="sm-booth-avatar" style="border-color:' + p.color + '">';
  h += '<img src="' + p.img + '" alt="' + this.esc(p.name) + '">';
  h += '</div>';
  h += '<div class="sm-booth-name" style="color:' + p.color + '">' + this.esc(p.name) + '</div>';
  h += '<div class="sm-booth-role">Play-by-Play Commentator</div>';
  h += '</div>';

  h += '<div class="sm-commentary-box" id="smCommentaryBox">';
  if (this.commentaryQueue.length > 0 && this.commentaryIndex < this.commentaryQueue.length) {
    h += '<div class="sm-commentary-text">\u201C' + this.esc(this.commentaryQueue[this.commentaryIndex]) + '\u201D</div>';
  } else if (this.fetchingCommentary) {
    h += '<div class="sm-commentary-text sm-loading-text">\uD83C\uDF99\uFE0F Generating commentary...</div>';
  } else {
    h += '<div class="sm-commentary-text sm-loading-text">Press play to hear ' + this.esc(p.name) + '\'s take</div>';
  }
  h += '</div>';

  h += '<div class="sm-controls">';
  h += '<button class="sm-ctrl-btn" data-sm-prev title="Previous">\u23EE</button>';
  h += '<button class="sm-play-btn' + (this.isPlaying ? ' sm-playing' : '') + '" data-sm-play style="background:' + p.color + '">';
  h += this.isPlaying ? '\u23F8' : '\u25B6';
  h += '</button>';
  h += '<button class="sm-ctrl-btn" data-sm-next title="Next">\u23ED</button>';
  h += '</div>';

  h += '<div class="sm-controls-row">';
  h += '<button class="sm-auto-btn' + (this.autoPlay ? ' sm-auto-on' : '') + '" data-sm-auto>';
  h += '\uD83D\uDD01 Auto-play ' + (this.autoPlay ? 'ON' : 'OFF');
  h += '</button>';
  h += '<button class="sm-refresh-btn" data-sm-refresh>\uD83D\uDD04 New Take</button>';
  h += '</div>';

  return h;
};

SportsMediaModule.prototype.renderCommentaryTab = function() {
  var ww = this.affiliateLinks.westwood.base;
  var h = '';
  h += '<h3 class="sm-tab-title">\uD83C\uDF99\uFE0F 24/7 SPORTS TALK</h3>';
  h += '<div class="feat-sub">Westwood One Sports 24/7 programming \u2013 expert commentary and analysis</div>';

  h += '<div class="sm-show-list">';

  h += '<div class="sm-show-card">';
  h += '<div class="sm-show-time">9am \u2013 12pm ET</div>';
  h += '<h4>You Better You Bet with Nick Kostos</h4>';
  h += '<p>Betting analysis and sports commentary from the BetMGM Network</p>';
  h += '<a href="' + ww + '" target="_blank" rel="noopener" class="sm-listen-link" data-sm-aff="westwood-betting">\uD83C\uDFA7 LISTEN LIVE</a>';
  h += '</div>';

  h += '<div class="sm-show-card sm-show-featured">';
  h += '<div class="sm-show-time">3pm \u2013 6pm ET</div>';
  h += '<h4>The Jim Rome Show</h4>';
  h += '<p>The legendary Jim Rome joins Westwood One Sports in the prime afternoon timeslot</p>';
  h += '<a href="' + ww + '" target="_blank" rel="noopener" class="sm-listen-link" data-sm-aff="westwood-rome">\uD83C\uDFA7 LISTEN LIVE</a>';
  h += '</div>';

  h += '<div class="sm-show-card">';
  h += '<div class="sm-show-time">6pm \u2013 11pm ET</div>';
  h += '<h4>BetMGM Tonight</h4>';
  h += '<p>Evening betting analysis and sports discussion</p>';
  h += '<a href="' + ww + '" target="_blank" rel="noopener" class="sm-listen-link" data-sm-aff="westwood-betmgm">\uD83C\uDFA7 LISTEN LIVE</a>';
  h += '</div>';

  h += '</div>';

  h += '<div class="sm-audacy-promo">';
  h += '<h4>\uD83D\uDCF1 Also available on the Audacy App</h4>';
  h += '<p>Access 40 owned-and-operated sports stations and 160 streaming channels</p>';
  h += '<a href="' + this.affiliateLinks.audacy.base + '" target="_blank" rel="noopener" class="feat-btn" data-sm-aff="audacy-app">\uD83D\uDCF2 GET THE APP</a>';
  h += '</div>';

  return h;
};

SportsMediaModule.prototype.renderGearTab = function() {
  var bs = this.affiliateLinks.barstool.base;
  var h = '';
  h += '<h3 class="sm-tab-title">\uD83E\uDDE2 OFFICIAL FAN GEAR</h3>';
  h += '<div class="feat-sub">Show your team pride with authentic merchandise</div>';

  h += '<div class="sm-gear-grid">';

  h += '<div class="sm-gear-card">';
  h += '<div class="sm-gear-icon">\uD83C\uDFC8</div>';
  h += '<h4>Authentic Jerseys</h4>';
  h += '<p>All NFL, NBA, MLB teams available</p>';
  h += '<a href="' + bs + '" target="_blank" rel="noopener" class="sm-shop-btn" data-sm-aff="barstool-jerseys">\uD83D\uDED2 SHOP NOW</a>';
  h += '</div>';

  h += '<div class="sm-gear-card">';
  h += '<div class="sm-gear-icon">\uD83E\uDDE2</div>';
  h += '<h4>Team Hats & Apparel</h4>';
  h += '<p>Official merchandise from Barstool Sports</p>';
  h += '<a href="' + bs + '" target="_blank" rel="noopener" class="sm-shop-btn" data-sm-aff="barstool-hats">\uD83D\uDED2 SHOP NOW</a>';
  h += '</div>';

  h += '<div class="sm-gear-card">';
  h += '<div class="sm-gear-icon">\uD83C\uDFC6</div>';
  h += '<h4>Limited Edition Gear</h4>';
  h += '<p>Exclusive drops and fan favorites</p>';
  h += '<a href="' + bs + '" target="_blank" rel="noopener" class="sm-shop-btn" data-sm-aff="barstool-collectibles">\uD83D\uDED2 SHOP NOW</a>';
  h += '</div>';

  h += '</div>';

  h += '<div class="sm-gear-note">';
  h += '<p>\uD83D\uDD25 Barstool Sports offers edgy, fan-focused merchandise perfect for our community</p>';
  h += '</div>';

  return h;
};

SportsMediaModule.prototype.renderBettingTab = function() {
  var bm = this.affiliateLinks.betmgm.base;
  var h = '';
  h += '<h3 class="sm-tab-title">\uD83D\uDCCA BETTING ANALYSIS</h3>';
  h += '<div class="feat-sub">Expert picks and analysis from the BetMGM Network</div>';

  h += '<div class="sm-show-list">';

  h += '<div class="sm-show-card">';
  h += '<h4>You Better You Bet</h4>';
  h += '<p>Daily betting insights with Nick Kostos \u2013 weekdays 9am\u201312pm ET</p>';
  h += '<a href="' + bm + '" target="_blank" rel="noopener" class="sm-betting-btn" data-sm-aff="betmgm-morning">\uD83D\uDCCA GET EXPERT PICKS</a>';
  h += '</div>';

  h += '<div class="sm-show-card">';
  h += '<h4>BetMGM Tonight</h4>';
  h += '<p>Evening betting analysis \u2013 weeknights 6\u201311pm ET</p>';
  h += '<a href="' + bm + '" target="_blank" rel="noopener" class="sm-betting-btn" data-sm-aff="betmgm-night">\uD83D\uDCCA GET EXPERT PICKS</a>';
  h += '</div>';

  h += '<div class="sm-show-card">';
  h += '<h4>Weekend Betting Specials</h4>';
  h += '<p>Exclusive weekend programming from BetMGM</p>';
  h += '<a href="' + bm + '" target="_blank" rel="noopener" class="sm-betting-btn" data-sm-aff="betmgm-weekend">\uD83D\uDCCA GET EXPERT PICKS</a>';
  h += '</div>';

  h += '</div>';

  h += '<div class="sm-betting-disc">';
  h += '<p>\u26A1 Bet responsibly \u2022 Must be 21+</p>';
  h += '</div>';

  return h;
};

SportsMediaModule.prototype.renderQuickLinks = function() {
  var h = '<div class="sm-quick-links">';
  h += '<h4>\u26A1 QUICK ACCESS</h4>';
  h += '<div class="sm-link-grid">';

  h += '<a href="' + this.affiliateLinks.audacy.base + '" target="_blank" rel="noopener" class="sm-quick-link" data-sm-aff="audacy">';
  h += '<span>\uD83D\uDCF1 Audacy App</span>';
  h += '<small>160+ sports channels</small>';
  h += '</a>';

  h += '<a href="' + this.affiliateLinks.westwood.base + '" target="_blank" rel="noopener" class="sm-quick-link" data-sm-aff="westwood">';
  h += '<span>\uD83C\uDFA7 Westwood One</span>';
  h += '<small>NFL, NCAA live coverage</small>';
  h += '</a>';

  h += '<a href="' + this.affiliateLinks.barstool.base + '" target="_blank" rel="noopener" class="sm-quick-link" data-sm-aff="barstool">';
  h += '<span>\uD83E\uDDE2 Barstool Store</span>';
  h += '<small>6% commission</small>';
  h += '</a>';

  h += '</div>';
  h += '</div>';
  return h;
};

SportsMediaModule.prototype.trackAffiliate = function(id) {
  fetch('/api/track-affiliate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ affiliate: id, timestamp: Date.now(), page: 'sports-media-hub' })
  }).catch(function() {});
  if (window.SoundManager && window.SoundManager.play) {
    window.SoundManager.play('click');
  }
};

SportsMediaModule.prototype.selectGame = function(gameId) {
  var all = this.games.concat(this.results);
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].id) === String(gameId)) {
      this.selectedGame = all[i];
      this.commentaryQueue = [];
      this.commentaryIndex = 0;
      this.isPlaying = false;
      this.stopAudio();
      this.render();
      return;
    }
  }
};

SportsMediaModule.prototype.selectPersona = function(pid) {
  if (!this.personas[pid]) return;
  this.currentPersona = pid;
  this.commentaryQueue = [];
  this.commentaryIndex = 0;
  this.isPlaying = false;
  this.stopAudio();
  this.render();
};

SportsMediaModule.prototype.fetchCommentary = function(cb) {
  var self = this;
  var g = this.selectedGame;
  if (!g || !this.isActive) return;

  var cacheKey = g.id + '_' + this.currentPersona;
  if (this.commentaryCache[cacheKey] && this.commentaryCache[cacheKey].length > this.commentaryIndex) {
    this.commentaryQueue = this.commentaryCache[cacheKey];
    if (cb) cb();
    return;
  }

  if (this.abortCtrl) { try { this.abortCtrl.abort(); } catch(e) {} }
  this.abortCtrl = new AbortController();

  this.fetchingCommentary = true;
  this.updateCommentaryBox();

  fetch('/api/sports/commentary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: g, personaId: this.currentPersona }),
    signal: this.abortCtrl.signal
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!self.isActive) return;
      self.fetchingCommentary = false;
      if (data.commentary) {
        var sentences = data.commentary.split(/(?<=[.!?])\s+/).filter(function(s) { return s.trim().length > 0; });
        if (sentences.length === 0) sentences = [data.commentary];
        if (!self.commentaryCache[cacheKey]) self.commentaryCache[cacheKey] = [];
        for (var i = 0; i < sentences.length; i++) {
          self.commentaryCache[cacheKey].push(sentences[i]);
        }
        self.commentaryQueue = self.commentaryCache[cacheKey];
        self.updateCommentaryBox();
        if (cb) cb();
      }
    })
    .catch(function(err) {
      if (err && err.name === 'AbortError') return;
      self.fetchingCommentary = false;
      self.updateCommentaryBox();
    });
};

SportsMediaModule.prototype.prefetchCommentary = function() {
  var self = this;
  var g = this.selectedGame;
  if (!g || !this.isActive) return;
  var cacheKey = g.id + '_' + this.currentPersona;
  if (this.prefetchKey === cacheKey && this.prefetchPromise) return;
  this.prefetchKey = cacheKey;
  this.prefetchPromise = new Promise(function(resolve) {
    var ctrl = new AbortController();
    fetch('/api/sports/commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: g, personaId: self.currentPersona }),
      signal: ctrl.signal
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!self.isActive) { resolve(false); return; }
        if (data.commentary) {
          var sentences = data.commentary.split(/(?<=[.!?])\s+/).filter(function(s) { return s.trim().length > 0; });
          if (sentences.length === 0) sentences = [data.commentary];
          if (!self.commentaryCache[cacheKey]) self.commentaryCache[cacheKey] = [];
          for (var i = 0; i < sentences.length; i++) {
            self.commentaryCache[cacheKey].push(sentences[i]);
          }
          self.commentaryQueue = self.commentaryCache[cacheKey];
        }
        self.prefetchPromise = null;
        self.prefetchKey = null;
        resolve(true);
      })
      .catch(function() {
        self.prefetchPromise = null;
        self.prefetchKey = null;
        resolve(false);
      });
  });
};

SportsMediaModule.prototype.updateCommentaryBox = function() {
  var box = document.getElementById('smCommentaryBox');
  if (!box) return;
  var p = this.personas[this.currentPersona];
  if (this.commentaryQueue.length > 0 && this.commentaryIndex < this.commentaryQueue.length) {
    box.innerHTML = '<div class="sm-commentary-text">\u201C' + this.esc(this.commentaryQueue[this.commentaryIndex]) + '\u201D</div>';
  } else if (this.fetchingCommentary) {
    box.innerHTML = '<div class="sm-commentary-text sm-loading-text">\uD83C\uDF99\uFE0F Generating commentary...</div>';
  } else {
    box.innerHTML = '<div class="sm-commentary-text sm-loading-text">Press play to hear ' + this.esc(p.name) + '\'s take</div>';
  }
};

SportsMediaModule.prototype.playCommentary = function() {
  var self = this;
  if (!this.selectedGame) return;
  if (this.commentaryQueue.length === 0 || this.commentaryIndex >= this.commentaryQueue.length) {
    this.fetchCommentary(function() { self.speakCurrent(); });
  } else {
    this.speakCurrent();
  }
};

SportsMediaModule.prototype.advanceQueue = function() {
  var self = this;
  if (!this.isActive || !this.isPlaying) return;
  this.commentaryIndex++;
  if (this.commentaryIndex < this.commentaryQueue.length) {
    this.speakCurrent();
  } else if (this.autoPlay) {
    if (this.prefetchPromise) {
      this.updateCommentaryBox();
      this.prefetchPromise.then(function(ok) {
        if (!self.isActive || !self.isPlaying) return;
        if (ok && self.commentaryIndex < self.commentaryQueue.length) {
          self.speakCurrent();
        } else {
          self.fetchCommentary(function() { self.speakCurrent(); });
        }
      });
    } else {
      this.fetchCommentary(function() { self.speakCurrent(); });
    }
  } else {
    this.isPlaying = false;
    this.updatePlayButton();
    this.updateCommentaryBox();
  }
};

SportsMediaModule.prototype.speakCurrent = function() {
  var self = this;
  if (!this.isActive) return;
  if (this.commentaryIndex >= this.commentaryQueue.length) {
    if (this.autoPlay) {
      if (this.prefetchPromise) {
        this.updateCommentaryBox();
        this.prefetchPromise.then(function(ok) {
          if (!self.isActive || !self.isPlaying) return;
          if (ok && self.commentaryIndex < self.commentaryQueue.length) {
            self.speakCurrent();
          } else {
            self.fetchCommentary(function() { self.speakCurrent(); });
          }
        });
      } else {
        this.fetchCommentary(function() { self.speakCurrent(); });
      }
    } else {
      this.isPlaying = false;
      this.render();
    }
    return;
  }

  this.isPlaying = true;
  this.updateCommentaryBox();
  this.updatePlayButton();

  this.prefetchCommentary();

  var text = this.commentaryQueue[this.commentaryIndex];
  var url = '/api/tts?text=' + encodeURIComponent(text) + '&mood=EXCITED&speechCategory=SPORTS_COMMENTARY';

  this.stopAudio();
  this.audioEl = new Audio(url);
  this.audioEl.addEventListener('ended', function() { self.advanceQueue(); });
  this.audioEl.addEventListener('error', function() {
    self.commentaryIndex++;
    if (self.isPlaying && self.commentaryIndex < self.commentaryQueue.length) {
      self.speakCurrent();
    } else {
      self.isPlaying = false;
      self.updatePlayButton();
    }
  });
  this.audioEl.play().catch(function() {
    self.isPlaying = false;
    self.updatePlayButton();
  });
};

SportsMediaModule.prototype.updatePlayButton = function() {
  var btn = this.el.querySelector('[data-sm-play]');
  if (btn) {
    btn.textContent = this.isPlaying ? '\u23F8' : '\u25B6';
    if (this.isPlaying) btn.classList.add('sm-playing');
    else btn.classList.remove('sm-playing');
  }
};

SportsMediaModule.prototype.stopAudio = function() {
  if (this.audioEl) {
    this.audioEl.pause();
    this.audioEl.src = '';
    this.audioEl = null;
  }
};

SportsMediaModule.prototype.togglePlay = function() {
  if (this.isPlaying) {
    this.isPlaying = false;
    this.stopAudio();
    this.updatePlayButton();
  } else {
    this.playCommentary();
  }
};

SportsMediaModule.prototype.nextTrack = function() {
  this.stopAudio();
  this.commentaryIndex++;
  if (this.isPlaying) this.playCommentary();
  else this.updateCommentaryBox();
};

SportsMediaModule.prototype.prevTrack = function() {
  this.stopAudio();
  if (this.commentaryIndex > 0) this.commentaryIndex--;
  if (this.isPlaying) this.speakCurrent();
  else this.updateCommentaryBox();
};

SportsMediaModule.prototype.newTake = function() {
  var g = this.selectedGame;
  if (!g) return;
  var cacheKey = g.id + '_' + this.currentPersona;
  delete this.commentaryCache[cacheKey];
  this.commentaryQueue = [];
  this.commentaryIndex = 0;
  this.prefetchPromise = null;
  this.prefetchKey = null;
  this.stopAudio();
  this.isPlaying = false;
  this.render();
  var self = this;
  this.fetchCommentary(function() {
    self.isPlaying = true;
    self.speakCurrent();
  });
};

SportsMediaModule.prototype.handleClick = function(e) {
  this.isActive = true;
  var t = e.target;

  var tab = t.closest('[data-sm-tab]');
  if (tab) {
    var tabName = tab.getAttribute('data-sm-tab');
    if (tabName !== this.activeTab) {
      if (this.activeTab === 'live') {
        this.selectedGame = null;
        this.stopAudio();
        this.isPlaying = false;
      }
      this.activeTab = tabName;
      this.render();
    }
    return;
  }

  var aff = t.closest('[data-sm-aff]');
  if (aff) {
    this.trackAffiliate(aff.getAttribute('data-sm-aff'));
    return;
  }

  var persona = t.closest('[data-sm-persona]');
  if (persona) {
    this.selectPersona(persona.getAttribute('data-sm-persona'));
    return;
  }

  var gameCard = t.closest('[data-sm-game]');
  if (gameCard) {
    this.selectGame(gameCard.getAttribute('data-sm-game'));
    return;
  }

  if (t.closest('[data-sm-back]')) {
    this.selectedGame = null;
    this.isPlaying = false;
    this.stopAudio();
    this.commentaryQueue = [];
    this.commentaryIndex = 0;
    this.render();
    return;
  }

  if (t.closest('[data-sm-play]')) { this.togglePlay(); return; }
  if (t.closest('[data-sm-next]')) { this.nextTrack(); return; }
  if (t.closest('[data-sm-prev]')) { this.prevTrack(); return; }

  if (t.closest('[data-sm-auto]')) {
    this.autoPlay = !this.autoPlay;
    var btn = t.closest('[data-sm-auto]');
    btn.textContent = '\uD83D\uDD01 Auto-play ' + (this.autoPlay ? 'ON' : 'OFF');
    if (this.autoPlay) btn.classList.add('sm-auto-on');
    else btn.classList.remove('sm-auto-on');
    return;
  }

  if (t.closest('[data-sm-refresh]')) { this.newTake(); return; }
};

SportsMediaModule.prototype.handleInput = function() {};
SportsMediaModule.prototype.handleKeydown = function() {};

SportsMediaModule.prototype.stop = function() {
  this.isActive = false;
  this.isPlaying = false;
  this.fetchingCommentary = false;
  if (this.abortCtrl) { try { this.abortCtrl.abort(); } catch(e) {} this.abortCtrl = null; }
  this.prefetchPromise = null;
  this.prefetchKey = null;
  this.stopAudio();
  this.commentaryQueue = [];
  this.commentaryIndex = 0;
};

window.SportsMediaModule = SportsMediaModule;
