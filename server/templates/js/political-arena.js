function RealTimeConversationEngine(id) {
  this.el = document.getElementById(id);
  this.allPersonas = {
    trump:{name:"Trump",color:"#ff4d4d",img:"/api/persona-image/trump",faction:"SELF"},
    netanyahu:{name:"Netanyahu",color:"#0038b8",img:"",initials:"BN",faction:"SUPPORTER"},
    ruckus:{name:"Ruckus",color:"#8b0000",img:"/api/persona-image/ruckus",faction:"SUPPORTER"},
    megynkelly:{name:"Megyn Kelly",color:"#d4af37",img:"",initials:"MK",faction:"SUPPORTER"},
    pambondi:{name:"Pam Bondi",color:"#b22222",img:"",initials:"PB",faction:"SUPPORTER"},
    candace:{name:"Candace Owens",color:"#ff8c00",img:"",initials:"CO",faction:"WILDCARD"},
    galloway:{name:"Galloway",color:"#c41e3a",img:"",initials:"GG",faction:"OPPONENT"},
    mcconnell:{name:"McConnell",color:"#708090",img:"",initials:"MM",faction:"OPPONENT"},
    carville:{name:"Carville",color:"#e63946",img:"",initials:"JC",faction:"OPPONENT"},
    maddow:{name:"Maddow",color:"#7c3aed",img:"",initials:"RM",faction:"OPPONENT"},
    omar:{name:"Omar",color:"#06b6d4",img:"",initials:"IO",faction:"OPPONENT"},
    biden:{name:"Biden",color:"#3b82f6",img:"",initials:"JB",faction:"OPPONENT"},
    rosie:{name:"Rosie",color:"#ec4899",img:"",initials:"RO",faction:"OPPONENT"},
    berniemc:{name:"Bernie Mac",color:"#f59e0b",img:"/api/persona-image/bernie",faction:"OPPONENT"}
  };
  this.personas = {};
  this.selectedPersonas = {};
  this.phase = 'select';
  this.topic = '';
  this.topics = [];
  this.messages = [];
  this.running = false;
  this.loading = false;
  this.voiceEnabled = false;
  this.turboMode = false;
  this.audioEl = null;
  this.prefetchPromise = null;
  this.freeUsed = 0;
  this.freeLimit = 4;
  this.locked = false;
  this.votes = {};
  this.allTimeScores = this.loadScores();
  this.replayIndex = 0;
  this.replaying = false;
  var ids = Object.keys(this.allPersonas);
  for (var i = 0; i < ids.length; i++) this.selectedPersonas[ids[i]] = true;
  this.fetchTopics();
}
RealTimeConversationEngine.prototype.loadScores = function() {
  try {
    var s = localStorage.getItem('arena_alltime_scores');
    return s ? JSON.parse(s) : {};
  } catch(e) { return {}; }
};
RealTimeConversationEngine.prototype.saveScores = function() {
  try { localStorage.setItem('arena_alltime_scores', JSON.stringify(this.allTimeScores)); } catch(e) {}
};
RealTimeConversationEngine.prototype.fetchTopics = function() {
  var self = this;
  fetch('/api/arena/topics').then(function(r){return r.json();}).then(function(d){
    if (d.topics && d.topics.length > 0) {
      self.topics = d.topics.map(function(t){return t.title;});
      if (!self.topic) self.topic = self.topics[0];
    } else {
      self.topics = ['Economy','Immigration','Foreign Policy','Media','Middle East','Big Tech'];
      if (!self.topic) self.topic = 'Economy';
    }
    self.render();
  }).catch(function(){
    self.topics = ['Economy','Immigration','Foreign Policy','Media','Middle East','Big Tech'];
    if (!self.topic) self.topic = 'Economy';
    self.render();
  });
};
RealTimeConversationEngine.prototype.handleClick = function(e) {
  var t = e.target;
  var topicBtn = t.closest('[data-ctopic]');
  if (topicBtn) { this.topic = topicBtn.getAttribute('data-ctopic'); this.render(); return; }
  if (t.closest('[data-cstart]')) { this.startDebate(); return; }
  if (t.closest('[data-cstop]')) { this.stop(); return; }
  if (t.closest('[data-cclear]')) { this.messages = []; this.votes = {}; this.locked = false; this.freeUsed = 0; this.phase = 'select'; this.render(); return; }
  if (t.closest('[data-cvoice]')) { this.voiceEnabled = !this.voiceEnabled; this.render(); return; }
  if (t.closest('[data-cturbo]')) { this.turboMode = !this.turboMode; this.render(); return; }
  if (t.closest('[data-creplay]')) { this.replaySession(); return; }
  if (t.closest('[data-cstopreplay]')) { this.stopReplay(); return; }
  if (t.closest('[data-cscores]')) { this.phase = (this.phase === 'scores' ? 'select' : 'scores'); this.render(); return; }
  var toggle = t.closest('[data-ctoggle]');
  if (toggle) {
    var pid = toggle.getAttribute('data-ctoggle');
    this.selectedPersonas[pid] = !this.selectedPersonas[pid];
    this.render();
    return;
  }
  if (t.closest('[data-cselectall]')) {
    var ids = Object.keys(this.allPersonas);
    for (var i = 0; i < ids.length; i++) this.selectedPersonas[ids[i]] = true;
    this.render();
    return;
  }
  if (t.closest('[data-cdeselectall]')) {
    var ids2 = Object.keys(this.allPersonas);
    for (var j = 0; j < ids2.length; j++) this.selectedPersonas[ids2[j]] = false;
    this.render();
    return;
  }
  var voteBtn = t.closest('[data-cvote]');
  if (voteBtn) {
    var vid = voteBtn.getAttribute('data-cvote');
    var midx = parseInt(voteBtn.getAttribute('data-cmsg'), 10);
    this.castVote(vid, midx);
    return;
  }
  var speak = t.closest('[data-cspeak]');
  if (speak) { e.stopPropagation(); this.speak(speak.getAttribute('data-cspeak'), speak.getAttribute('data-ctext') || ''); return; }
};
RealTimeConversationEngine.prototype.castVote = function(pid, msgIdx) {
  var key = 'msg_' + msgIdx;
  this.votes[key] = pid;
  if (!this.allTimeScores[pid]) this.allTimeScores[pid] = 0;
  this.allTimeScores[pid]++;
  this.saveScores();
  this.render();
  var stream = this.el.querySelector('.conv-stream');
  if (stream) stream.scrollTop = stream.scrollHeight;
};
RealTimeConversationEngine.prototype.startDebate = function() {
  var sel = Object.keys(this.selectedPersonas).filter(function(k) { return this.selectedPersonas[k]; }.bind(this));
  if (sel.length < 2) return;
  this.personas = {};
  for (var i = 0; i < sel.length; i++) this.personas[sel[i]] = this.allPersonas[sel[i]];
  this.phase = 'debate';
  this.start();
};
RealTimeConversationEngine.prototype.start = function() {
  if (this.running || this.locked) return;
  this.running = true;
  this.render();
  this.conversationLoop();
};
RealTimeConversationEngine.prototype.stop = function() {
  this.running = false;
  this.prefetchPromise = null;
  if (this.audioEl) { this.audioEl.pause(); this.audioEl = null; }
  window.TimerManager.clear('conversation');
  window.TimerManager.clear('replay');
  this.replaying = false;
  this.render();
};
RealTimeConversationEngine.prototype.conversationLoop = function() {
  if (!this.running || this.locked) return;
  var self = this;
  this.generate(function() {
    if (!self.running) return;
    self.prefetchNext();
    var delay = self.turboMode ? 300 : 1000;
    window.TimerManager.set('conversation', function() { self.conversationLoop(); }, delay);
  });
};
RealTimeConversationEngine.prototype.prefetchNext = function() {
  if (this.prefetchPromise || this.locked || !this.running) return;
  var self = this;
  var ids = Object.keys(this.personas);
  var lastSpeaker = this.messages.length > 0 ? this.messages[this.messages.length - 1].persona : null;
  var candidates = lastSpeaker ? ids.filter(function(id) { return id !== lastSpeaker; }) : ids;
  var responderId = candidates[Math.floor(Math.random() * candidates.length)];
  var toSpeakerId = lastSpeaker || ids[Math.floor(Math.random() * ids.length)];
  var history = this.messages.slice(-6).map(function(m) { return { speakerName: self.personas[m.persona] ? self.personas[m.persona].name : m.persona, text: m.text }; });
  this.prefetchPromise = fetch('/api/arena/respond', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ responderId: responderId, toSpeakerId: toSpeakerId, topic: this.topic, conversationHistory: history })
  }).then(function(r) { return r.json(); }).then(function(d) {
    self.prefetchPromise = null;
    if (d && d.response) return d;
    return null;
  }).catch(function() { self.prefetchPromise = null; return null; });
};
RealTimeConversationEngine.prototype.generate = function(cb) {
  if (this.loading || this.locked) { if (cb) cb(); return; }
  this.loading = true;
  var self = this;
  var doProcess = function(d, fallbackId) {
    if (!d || !d.response) { self.loading = false; if (cb) cb(); return; }
    var pid = d.personaId || fallbackId;
    self.messages.push({ persona: pid, text: d.response, time: new Date() });
    if (self.messages.length > 50) self.messages = self.messages.slice(-30);
    self.freeUsed++;
    if (d.freeRemaining !== undefined) self.freeUsed = self.freeLimit - d.freeRemaining;
    self.loading = false;
    self.render();
    var stream = self.el.querySelector('.conv-stream');
    if (stream) stream.scrollTop = stream.scrollHeight;
    if (self.voiceEnabled && d.response) {
      self.speak(pid, d.response, cb);
    } else {
      if (cb) cb();
    }
  };
  if (this.prefetchPromise) {
    var p = this.prefetchPromise;
    this.prefetchPromise = null;
    p.then(function(d) {
      if (d) { doProcess(d, d.personaId); }
      else { self.loading = false; self.doFreshGenerate(doProcess, cb); }
    });
    return;
  }
  this.doFreshGenerate(doProcess, cb);
};
RealTimeConversationEngine.prototype.doFreshGenerate = function(doProcess, cb) {
  var self = this;
  var ids = Object.keys(this.personas);
  var lastSpeaker = this.messages.length > 0 ? this.messages[this.messages.length - 1].persona : null;
  var candidates = lastSpeaker ? ids.filter(function(id) { return id !== lastSpeaker; }) : ids;
  var responderId = candidates[Math.floor(Math.random() * candidates.length)];
  var toSpeakerId = lastSpeaker || ids[Math.floor(Math.random() * ids.length)];
  var history = this.messages.slice(-6).map(function(m) { return { speakerName: self.personas[m.persona] ? self.personas[m.persona].name : m.persona, text: m.text }; });
  fetch('/api/arena/respond', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ responderId: responderId, toSpeakerId: toSpeakerId, topic: this.topic, conversationHistory: history })
  })
  .then(function(r) {
    if (r.status === 403) { return r.json().then(function(){ self.locked = true; self.stop(); self.render(); return null; }); }
    return r.json();
  })
  .then(function(d) { doProcess(d, responderId); })
  .catch(function() { self.loading = false; if (cb) cb(); });
};
RealTimeConversationEngine.prototype.speak = function(pid, text, cb) {
  var self = this;
  var btn = this.el.querySelector('[data-cspeak="'+pid+'"]');
  if (btn) btn.textContent = '...';
  var params = new URLSearchParams({text:(text||'No comment.').slice(0,300), personaId:pid});
  fetch('/api/persona-speak?'+params.toString())
  .then(function(r){return r.blob();}).then(function(b){
    var u=URL.createObjectURL(b);
    if (self.audioEl) { self.audioEl.pause(); self.audioEl = null; }
    self.audioEl=new Audio(u);
    self.audioEl.onended=function(){
      URL.revokeObjectURL(u);
      self.audioEl = null;
      if(btn)btn.innerHTML='&#x1F50A;';
      var pause = self.turboMode ? 50 : 300;
      if (cb) setTimeout(cb, pause);
    };
    self.audioEl.play();
  })
  .catch(function(){if(btn)btn.innerHTML='&#x1F50A;'; if(cb) cb();});
};
RealTimeConversationEngine.prototype.replaySession = function() {
  if (this.messages.length === 0 || this.replaying) return;
  this.stop();
  this.replaying = true;
  this.replayIndex = 0;
  this.replayNext();
};
RealTimeConversationEngine.prototype.stopReplay = function() {
  this.replaying = false;
  if (this.audioEl) { this.audioEl.pause(); this.audioEl = null; }
  window.TimerManager.clear('replay');
  this.render();
};
RealTimeConversationEngine.prototype.replayNext = function() {
  if (!this.replaying || this.replayIndex >= this.messages.length) {
    this.replaying = false;
    this.render();
    return;
  }
  var self = this;
  var msg = this.messages[this.replayIndex];
  this.render();
  var stream = this.el.querySelector('.conv-stream');
  if (stream) {
    var items = stream.querySelectorAll('[data-replay-idx]');
    for (var i = 0; i < items.length; i++) {
      items[i].style.opacity = parseInt(items[i].getAttribute('data-replay-idx'), 10) <= this.replayIndex ? '1' : '0.3';
    }
  }
  this.speak(msg.persona, msg.text, function() {
    self.replayIndex++;
    if (self.replaying) {
      var pause = self.turboMode ? 50 : 300;
      window.TimerManager.set('replay', function() { self.replayNext(); }, pause);
    }
  });
};
RealTimeConversationEngine.prototype.esc = function(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
};
RealTimeConversationEngine.prototype.render = function() {
  var self = this;
  if (this.phase === 'scores') return this.renderScores();
  if (this.phase === 'select') return this.renderSelect();
  return this.renderDebate();
};
RealTimeConversationEngine.prototype.renderSelect = function() {
  var h = '<div class="feat-title" style="display:flex;align-items:center;gap:10px;">REAL TALK';
  h += '<button data-cscores style="background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:16px;padding:4px 10px;cursor:pointer;color:#FFD700;font-size:11px;">&#x1F3C6; All-Time Scores</button>';
  h += '</div>';
  h += '<div class="feat-sub">Choose your debaters. Pick at least 2.</div>';
  h += '<div style="display:flex;gap:6px;justify-content:center;margin-bottom:10px;">';
  h += '<button data-cselectall style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:4px 12px;color:#aaa;font-size:10px;cursor:pointer;">Select All</button>';
  h += '<button data-cdeselectall style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:4px 12px;color:#aaa;font-size:10px;cursor:pointer;">Deselect All</button>';
  h += '</div>';
  h += '<div class="s-persona-row" style="margin-bottom:12px;">';
  var ids = Object.keys(this.allPersonas);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i], p = this.allPersonas[id], sel = this.selectedPersonas[id];
    var borderStyle = sel ? '3px solid ' + p.color : '2px solid #333';
    var opacity = sel ? '1' : '0.4';
    var imgHtml = p.img ? '<img src="'+p.img+'" style="width:36px;height:36px;border-radius:50%;border:2px solid '+p.color+';object-fit:cover;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' : '';
    var initialsHtml = '<div style="'+(p.img?'display:none;':'display:flex;')+'width:36px;height:36px;border-radius:50%;border:2px solid '+p.color+';background:rgba(255,255,255,0.08);align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:'+p.color+';">'+(p.initials||p.name.slice(0,2).toUpperCase())+'</div>';
    var checkmark = sel ? '<div style="position:absolute;top:-2px;right:-2px;width:16px;height:16px;background:#4ADE80;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;">&#x2713;</div>' : '';
    h += '<div data-ctoggle="'+id+'" class="s-chip" style="border:'+borderStyle+';opacity:'+opacity+';cursor:pointer;position:relative;">'+checkmark+imgHtml+initialsHtml+'<div class="s-chip-name" style="color:'+p.color+';">'+p.name+'</div><div style="font-size:8px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;">'+p.faction+'</div></div>';
  }
  h += '</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;justify-content:center;">';
  for (var t = 0; t < this.topics.length; t++) {
    var tp = this.topics[t], active = this.topic === tp;
    h += '<button data-ctopic="'+tp+'" style="padding:5px 12px;background:'+(active?'rgba(212,164,32,0.15)':'#1a1a1a')+';border:1px solid '+(active?'#D4A420':'#333')+';border-radius:20px;color:'+(active?'#D4A420':'#aaa')+';font-size:11px;font-weight:bold;cursor:pointer;">'+tp+'</button>';
  }
  h += '</div>';
  var selCount = Object.keys(this.selectedPersonas).filter(function(k) { return this.selectedPersonas[k]; }.bind(this)).length;
  if (selCount >= 2) {
    h += '<button class="feat-btn" data-cstart>START DEBATE (' + selCount + ' debaters)</button>';
  } else {
    h += '<div style="text-align:center;color:#666;font-size:12px;padding:8px;">Select at least 2 debaters to begin</div>';
  }
  this.el.innerHTML = h;
};
RealTimeConversationEngine.prototype.renderScores = function() {
  var h = '<div class="feat-title" style="display:flex;align-items:center;gap:10px;">&#x1F3C6; ALL-TIME SCORES';
  h += '<button data-cscores style="background:rgba(255,255,255,0.06);border:1px solid #333;border-radius:16px;padding:4px 10px;cursor:pointer;color:#aaa;font-size:11px;">&#x2190; Back</button>';
  h += '</div>';
  var entries = [];
  var allIds = Object.keys(this.allPersonas);
  for (var i = 0; i < allIds.length; i++) {
    var pid = allIds[i];
    entries.push({ id: pid, name: this.allPersonas[pid].name, color: this.allPersonas[pid].color, score: this.allTimeScores[pid] || 0 });
  }
  entries.sort(function(a, b) { return b.score - a.score; });
  h += '<div style="margin-top:12px;">';
  for (var j = 0; j < entries.length; j++) {
    var e = entries[j];
    var medal = j === 0 ? '&#x1F947;' : (j === 1 ? '&#x1F948;' : (j === 2 ? '&#x1F949;' : ''));
    var maxScore = entries[0].score || 1;
    var barWidth = Math.max(5, Math.round((e.score / maxScore) * 100));
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px 10px;background:rgba(255,255,255,0.02);border-radius:8px;border-left:3px solid '+e.color+';">';
    h += '<span style="width:20px;font-size:12px;text-align:center;">'+(medal || (j+1))+'</span>';
    h += '<span style="width:90px;font-size:12px;font-weight:bold;color:'+e.color+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+e.name+'</span>';
    h += '<div style="flex:1;height:14px;background:#1a1a1a;border-radius:7px;overflow:hidden;"><div style="width:'+barWidth+'%;height:100%;background:'+e.color+';border-radius:7px;transition:width 0.5s;"></div></div>';
    h += '<span style="width:30px;text-align:right;font-size:12px;font-weight:bold;color:#fff;">'+e.score+'</span>';
    h += '</div>';
  }
  h += '</div>';
  this.el.innerHTML = h;
};
RealTimeConversationEngine.prototype.renderDebate = function() {
  var personaCount = Object.keys(this.personas).length;
  var h = '<div class="feat-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">REAL TALK';
  h += '<button data-cvoice style="background:'+(this.voiceEnabled?'rgba(255,215,0,0.15)':'rgba(255,255,255,0.06)')+';border:1px solid '+(this.voiceEnabled?'rgba(255,215,0,0.3)':'#333')+';border-radius:16px;padding:4px 10px;cursor:pointer;color:'+(this.voiceEnabled?'#FFD700':'#666')+';font-size:11px;">'+(this.voiceEnabled?'&#x1F50A; ON':'&#x1F507; OFF')+'</button>';
  h += '<button data-cturbo style="background:'+(this.turboMode?'rgba(255,77,77,0.15)':'rgba(255,255,255,0.06)')+';border:1px solid '+(this.turboMode?'rgba(255,77,77,0.3)':'#333')+';border-radius:16px;padding:4px 10px;cursor:pointer;color:'+(this.turboMode?'#ff4d4d':'#666')+';font-size:11px;">&#x26A1; '+(this.turboMode?'TURBO':'NORMAL')+'</button>';
  h += '<button data-cscores style="background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:16px;padding:4px 10px;cursor:pointer;color:#FFD700;font-size:11px;">&#x1F3C6;</button>';
  if (this.freeUsed > 0 && this.freeUsed < this.freeLimit && !this.locked) {
    h += '<span style="font-size:9px;color:rgba(255,255,255,0.4);">'+(this.freeLimit - this.freeUsed)+' free left</span>';
  }
  h += '</div><div class="feat-sub">' + personaCount + ' debaters in the arena. Vote for the best takes!</div>';
  h += '<div class="s-persona-row">';
  var ids = Object.keys(this.personas);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i], p = this.personas[id];
    var sessionVotes = 0;
    var vKeys = Object.keys(this.votes);
    for (var v = 0; v < vKeys.length; v++) { if (this.votes[vKeys[v]] === id) sessionVotes++; }
    var imgHtml = p.img ? '<img src="'+p.img+'" style="width:36px;height:36px;border-radius:50%;border:2px solid '+p.color+';object-fit:cover;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' : '';
    var initialsHtml = '<div style="'+(p.img?'display:none;':'display:flex;')+'width:36px;height:36px;border-radius:50%;border:2px solid '+p.color+';background:rgba(255,255,255,0.08);align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:'+p.color+';">'+(p.initials||p.name.slice(0,2).toUpperCase())+'</div>';
    h += '<div class="s-chip" style="border-color:'+p.color+';">'+imgHtml+initialsHtml+'<div class="s-chip-name" style="color:'+p.color+';">'+p.name+'</div>';
    if (sessionVotes > 0) h += '<div style="font-size:9px;color:#FFD700;font-weight:bold;">'+sessionVotes+' vote'+(sessionVotes>1?'s':'')+'</div>';
    h += '</div>';
  }
  h += '</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;justify-content:center;">';
  for (var t = 0; t < this.topics.length; t++) {
    var tp = this.topics[t], active = this.topic === tp;
    h += '<button data-ctopic="'+tp+'" style="padding:5px 12px;background:'+(active?'rgba(212,164,32,0.15)':'#1a1a1a')+';border:1px solid '+(active?'#D4A420':'#333')+';border-radius:20px;color:'+(active?'#D4A420':'#aaa')+';font-size:11px;font-weight:bold;cursor:pointer;">'+tp+'</button>';
  }
  h += '</div>';
  if (this.locked) {
    h += '<div style="text-align:center;padding:16px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:12px;margin-bottom:12px;">';
    h += '<div style="font-size:14px;font-weight:bold;color:#FFD700;margin-bottom:4px;">Arena Access Required</div>';
    h += '<div style="font-size:11px;color:rgba(255,255,255,0.5);">Download the app to unlock full access with tokens</div>';
    h += '</div>';
  } else if (!this.running) {
    h += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
    h += '<button class="feat-btn" data-cstart style="flex:1;min-width:120px;">CONTINUE DEBATE</button>';
    if (this.messages.length > 0) {
      if (this.replaying) {
        h += '<button class="feat-btn" data-cstopreplay style="flex:0;background:rgba(255,77,77,0.15);border-color:#ff4d4d;color:#ff4d4d;">&#x23F9; STOP REPLAY</button>';
      } else {
        h += '<button class="feat-btn" data-creplay style="flex:0;background:rgba(77,255,77,0.1);border-color:#4ADE80;color:#4ADE80;">&#x1F501; REPLAY ALL</button>';
      }
    }
    h += '</div>';
  } else {
    h += '<button class="feat-btn" style="background:rgba(255,77,77,0.15);border-color:#ff4d4d;color:#ff4d4d;" data-cstop>PAUSE</button>';
  }
  if (this.messages.length > 0) {
    h += this.renderTally();
    h += '<div class="conv-stream" style="margin-top:12px;max-height:320px;overflow-y:auto;border:1px solid #222;border-radius:12px;padding:10px;background:#0a0a0a;">';
    for (var m = 0; m < this.messages.length; m++) {
      var msg = this.messages[m], mp = this.personas[msg.persona] || this.allPersonas[msg.persona];
      if (!mp) continue;
      var factionColor = mp.faction==='SELF'?'#ff4d4d':(mp.faction==='SUPPORTER'?'#4ADE80':(mp.faction==='WILDCARD'?'#ff8c00':'#60A5FA'));
      var voteKey = 'msg_' + m;
      var voted = this.votes[voteKey];
      h += '<div data-replay-idx="'+m+'" style="margin-bottom:10px;padding:8px 10px;border-left:3px solid '+mp.color+';background:rgba(255,255,255,0.02);border-radius:0 8px 8px 0;">';
      h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
      h += '<span style="font-size:11px;font-weight:bold;color:'+mp.color+';">'+this.esc(mp.name)+'</span>';
      h += '<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.06);color:'+factionColor+';text-transform:uppercase;letter-spacing:1px;">'+mp.faction+'</span>';
      h += '<button data-cspeak="'+msg.persona+'" data-ctext="'+this.esc(msg.text).replace(/"/g,'&quot;')+'" style="margin-left:auto;background:none;border:none;color:#888;cursor:pointer;font-size:12px;">&#x1F50A;</button>';
      if (!voted) {
        h += '<button data-cvote="'+msg.persona+'" data-cmsg="'+m+'" style="background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:10px;padding:2px 8px;color:#FFD700;font-size:10px;cursor:pointer;">&#x1F44D;</button>';
      } else {
        h += '<span style="font-size:10px;color:#4ADE80;">&#x2713; voted</span>';
      }
      h += '</div>';
      h += '<div style="font-size:12px;color:#ccc;line-height:1.5;">'+this.esc(msg.text)+'</div>';
      h += '</div>';
    }
    h += '</div>';
    if (!this.running && !this.replaying) {
      h += '<div style="text-align:center;margin-top:8px;display:flex;gap:8px;justify-content:center;">';
      h += '<button data-cclear style="background:none;border:1px solid #333;border-radius:8px;padding:4px 14px;color:#888;cursor:pointer;font-size:11px;">New Debate</button>';
      h += '</div>';
    }
  }
  if (this.loading) { h += '<div class="feat-loading">Generating response...</div>'; }
  this.el.innerHTML = h;
};
RealTimeConversationEngine.prototype.renderTally = function() {
  var tally = {};
  var ids = Object.keys(this.personas);
  for (var i = 0; i < ids.length; i++) tally[ids[i]] = 0;
  var vKeys = Object.keys(this.votes);
  var totalVotes = vKeys.length;
  for (var v = 0; v < vKeys.length; v++) {
    var pid = this.votes[vKeys[v]];
    if (tally[pid] !== undefined) tally[pid]++;
  }
  if (totalVotes === 0) return '';
  var sorted = ids.slice().sort(function(a, b) { return tally[b] - tally[a]; });
  var h = '<div style="margin-top:10px;padding:8px 12px;background:rgba(255,215,0,0.05);border:1px solid rgba(255,215,0,0.15);border-radius:10px;">';
  h += '<div style="font-size:11px;font-weight:bold;color:#FFD700;margin-bottom:6px;">SESSION SCOREBOARD (' + totalVotes + ' vote' + (totalVotes>1?'s':'') + ')</div>';
  for (var s = 0; s < sorted.length; s++) {
    var pid2 = sorted[s], p = this.personas[pid2];
    if (!p || tally[pid2] === 0) continue;
    var pct = Math.round((tally[pid2] / totalVotes) * 100);
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">';
    h += '<span style="width:80px;font-size:10px;font-weight:bold;color:'+p.color+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+p.name+'</span>';
    h += '<div style="flex:1;height:10px;background:#1a1a1a;border-radius:5px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+p.color+';border-radius:5px;"></div></div>';
    h += '<span style="width:35px;text-align:right;font-size:10px;color:#fff;">'+tally[pid2]+'</span>';
    h += '</div>';
  }
  h += '</div>';
  return h;
};
RealTimeConversationEngine.prototype.handleInput = function() {};
RealTimeConversationEngine.prototype.handleKeydown = function() {};

window.RealTimeConversationEngine = RealTimeConversationEngine;
