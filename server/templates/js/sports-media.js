function SportsMediaModule(containerId) {
  this.el = document.getElementById(containerId);
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
  this.personas = {
    trump:{name:"Trump",color:"#ff4d4d",img:"/api/persona-image/trump",voice:null},
    buffett:{name:"Buffett",color:"#4d4dff",img:"/api/persona-image/buffett",voice:null},
    musk:{name:"Elon",color:"#00ccff",img:"/api/persona-image/musk",voice:null},
    jordan:{name:"MJ",color:"#CE1141",img:"/api/persona-image/jordan",voice:null},
    bernie:{name:"Bernie",color:"#9B59B6",img:"/api/persona-image/bernie",voice:null},
    ruckus:{name:"Ruckus",color:"#8B4513",img:"/api/persona-image/ruckus",voice:null},
    grandma:{name:"Grandma",color:"#ffffff",img:"/api/persona-image/grandma",voice:null},
    mansa:{name:"Mansa",color:"#D4AF37",img:"/api/persona-image/mansa",voice:null}
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
  this.el.innerHTML = '<div class="feat-loading">📻 Tuning in to live sports...</div>';
  fetch('/api/sports/upcoming')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      self.games = (data.games || []).slice(0, 12);
      self.results = (data.results || []).slice(0, 6);
      self.render();
    })
    .catch(function() {
      self.el.innerHTML = '<div class="feat-loading">Could not load games. Try again later.</div>';
    });
};

SportsMediaModule.prototype.render = function() {
  var h = '<div class="sm-inner">';
  h += '<div class="feat-title">\uD83D\uDCFB Live Sports Audio</div>';
  h += '<div class="feat-sub">AI-powered play-by-play commentary from your favorite personas</div>';

  h += '<div class="sm-persona-strip">';
  var pKeys = Object.keys(this.personas);
  for (var i = 0; i < pKeys.length; i++) {
    var pk = pKeys[i];
    var p = this.personas[pk];
    var sel = pk === this.currentPersona ? ' sm-persona-sel' : '';
    h += '<div class="sm-persona' + sel + '" data-sm-persona="' + pk + '" style="border-color:' + (pk === this.currentPersona ? p.color : '#333') + '">';
    h += '<img src="' + p.img + '" alt="' + this.esc(p.name) + '">';
    h += '<span class="sm-p-name" style="color:' + (pk === this.currentPersona ? p.color : '#aaa') + '">' + this.esc(p.name) + '</span>';
    h += '</div>';
  }
  h += '</div>';

  if (this.selectedGame) {
    h += this.renderPlayer();
  } else {
    h += this.renderGameList();
  }

  h += '</div>';
  this.el.innerHTML = h;
};

SportsMediaModule.prototype.renderGameList = function() {
  var h = '';
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

  h += '<div class="sm-player">';
  h += '<button class="sm-back" data-sm-back>\u2190 All Games</button>';

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
    var c = this.commentaryQueue[this.commentaryIndex];
    h += '<div class="sm-commentary-text">"' + this.esc(c) + '"</div>';
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

  h += '</div>';
  return h;
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

        if (!self.commentaryCache[cacheKey]) {
          self.commentaryCache[cacheKey] = [];
        }
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

SportsMediaModule.prototype.updateCommentaryBox = function() {
  var box = document.getElementById('smCommentaryBox');
  if (!box) return;
  var p = this.personas[this.currentPersona];
  if (this.commentaryQueue.length > 0 && this.commentaryIndex < this.commentaryQueue.length) {
    var c = this.commentaryQueue[this.commentaryIndex];
    box.innerHTML = '<div class="sm-commentary-text">"' + this.esc(c) + '"</div>';
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
    this.fetchCommentary(function() {
      self.speakCurrent();
    });
  } else {
    this.speakCurrent();
  }
};

SportsMediaModule.prototype.speakCurrent = function() {
  var self = this;
  if (!this.isActive) return;
  if (this.commentaryIndex >= this.commentaryQueue.length) {
    if (this.autoPlay) {
      this.fetchCommentary(function() {
        self.speakCurrent();
      });
    } else {
      this.isPlaying = false;
      this.render();
    }
    return;
  }

  this.isPlaying = true;
  this.updateCommentaryBox();
  this.updatePlayButton();

  var text = this.commentaryQueue[this.commentaryIndex];
  var voice = this.personas[this.currentPersona].voice;
  var url = '/api/tts?text=' + encodeURIComponent(text);
  if (voice) url += '&voice=' + voice;
  url += '&mood=EXCITED&speechCategory=SPORTS_COMMENTARY';

  this.stopAudio();
  this.audioEl = new Audio(url);
  this.audioEl.addEventListener('ended', function() {
    self.commentaryIndex++;
    if (self.isPlaying) {
      if (self.commentaryIndex < self.commentaryQueue.length) {
        self.speakCurrent();
      } else if (self.autoPlay) {
        self.fetchCommentary(function() {
          self.speakCurrent();
        });
      } else {
        self.isPlaying = false;
        self.updatePlayButton();
        self.updateCommentaryBox();
      }
    }
  });
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
    if (this.isPlaying) {
      btn.classList.add('sm-playing');
    } else {
      btn.classList.remove('sm-playing');
    }
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
  if (this.isPlaying) {
    this.playCommentary();
  } else {
    this.updateCommentaryBox();
  }
};

SportsMediaModule.prototype.prevTrack = function() {
  this.stopAudio();
  if (this.commentaryIndex > 0) this.commentaryIndex--;
  if (this.isPlaying) {
    this.speakCurrent();
  } else {
    this.updateCommentaryBox();
  }
};

SportsMediaModule.prototype.newTake = function() {
  var g = this.selectedGame;
  if (!g) return;
  var cacheKey = g.id + '_' + this.currentPersona;
  delete this.commentaryCache[cacheKey];
  this.commentaryQueue = [];
  this.commentaryIndex = 0;
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

  if (t.closest('[data-sm-play]')) {
    this.togglePlay();
    return;
  }

  if (t.closest('[data-sm-next]')) {
    this.nextTrack();
    return;
  }

  if (t.closest('[data-sm-prev]')) {
    this.prevTrack();
    return;
  }

  if (t.closest('[data-sm-auto]')) {
    this.autoPlay = !this.autoPlay;
    var btn = t.closest('[data-sm-auto]');
    btn.textContent = '\uD83D\uDD01 Auto-play ' + (this.autoPlay ? 'ON' : 'OFF');
    if (this.autoPlay) {
      btn.classList.add('sm-auto-on');
    } else {
      btn.classList.remove('sm-auto-on');
    }
    return;
  }

  if (t.closest('[data-sm-refresh]')) {
    this.newTake();
    return;
  }
};

SportsMediaModule.prototype.handleInput = function() {};
SportsMediaModule.prototype.handleKeydown = function() {};

SportsMediaModule.prototype.stop = function() {
  this.isActive = false;
  this.isPlaying = false;
  this.fetchingCommentary = false;
  if (this.abortCtrl) { try { this.abortCtrl.abort(); } catch(e) {} this.abortCtrl = null; }
  this.stopAudio();
  this.commentaryQueue = [];
  this.commentaryIndex = 0;
};

window.SportsMediaModule = SportsMediaModule;
