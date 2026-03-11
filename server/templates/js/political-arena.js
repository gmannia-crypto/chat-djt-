function RealTimeConversationEngine(id) {
  this.el = document.getElementById(id);
  this.personas = {
    trump:{name:"Trump",color:"#ff4d4d",img:"/api/persona-image/trump",faction:"SELF"},
    netanyahu:{name:"Netanyahu",color:"#0038b8",img:"",initials:"BN",faction:"SUPPORTER"},
    ruckus:{name:"Ruckus",color:"#8b0000",img:"/api/persona-image/ruckus",faction:"SUPPORTER"},
    galloway:{name:"Galloway",color:"#c41e3a",img:"",initials:"GG",faction:"OPPONENT"},
    mcconnell:{name:"McConnell",color:"#708090",img:"",initials:"MM",faction:"OPPONENT"},
    carville:{name:"Carville",color:"#e63946",img:"",initials:"JC",faction:"OPPONENT"},
    maddow:{name:"Maddow",color:"#7c3aed",img:"",initials:"RM",faction:"OPPONENT"},
    omar:{name:"Omar",color:"#06b6d4",img:"",initials:"IO",faction:"OPPONENT"},
    biden:{name:"Biden",color:"#3b82f6",img:"",initials:"JB",faction:"OPPONENT"},
    rosie:{name:"Rosie",color:"#ec4899",img:"",initials:"RO",faction:"OPPONENT"},
    berniemc:{name:"Bernie Mac",color:"#f59e0b",img:"/api/persona-image/bernie",faction:"OPPONENT"}
  };
  this.topic = '';
  this.topics = [];
  this.messages = [];
  this.running = false;
  this.loading = false;
  this.voiceEnabled = false;
  this.freeUsed = 0;
  this.freeLimit = 4;
  this.locked = false;
  this.fetchTopics();
}
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
  if (t.closest('[data-cstart]')) { this.start(); return; }
  if (t.closest('[data-cstop]')) { this.stop(); return; }
  if (t.closest('[data-cclear]')) { this.messages = []; this.locked = false; this.freeUsed = 0; this.render(); return; }
  if (t.closest('[data-cvoice]')) { this.voiceEnabled = !this.voiceEnabled; this.render(); return; }
  var speak = t.closest('[data-cspeak]');
  if (speak) { e.stopPropagation(); this.speak(speak.getAttribute('data-cspeak'), speak.getAttribute('data-ctext') || ''); return; }
};
RealTimeConversationEngine.prototype.start = function() {
  if (this.running || this.locked) return;
  this.running = true;
  this.render();
  this.generate();
  var self = this;
  window.TimerManager.set('conversation', function() { self.generate(); }, 4000);
};
RealTimeConversationEngine.prototype.stop = function() {
  this.running = false;
  window.TimerManager.clear('conversation');
  this.render();
};
RealTimeConversationEngine.prototype.generate = function() {
  if (this.loading || this.locked) return;
  this.loading = true;
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
    if (r.status === 403) { return r.json().then(function(d){ self.locked = true; self.stop(); self.render(); return null; }); }
    return r.json();
  })
  .then(function(d) {
    if (!d || !d.response) { self.loading = false; return; }
    self.messages.push({ persona: d.personaId || responderId, text: d.response, time: new Date() });
    if (self.messages.length > 50) self.messages = self.messages.slice(-30);
    self.freeUsed++;
    if (d.freeRemaining !== undefined) self.freeUsed = self.freeLimit - d.freeRemaining;
    self.loading = false;
    self.render();
    var stream = self.el.querySelector('.conv-stream');
    if (stream) stream.scrollTop = stream.scrollHeight;
    if (self.voiceEnabled && d.response) {
      self.speak(d.personaId || responderId, d.response);
    }
  })
  .catch(function() { self.loading = false; });
};
RealTimeConversationEngine.prototype.speak = function(pid, text) {
  var btn = this.el.querySelector('[data-cspeak="'+pid+'"]');
  if (btn) btn.textContent = '...';
  var params = new URLSearchParams({text:(text||'No comment.').slice(0,300), personaId:pid});
  fetch('/api/persona-speak?'+params.toString())
  .then(function(r){return r.blob();}).then(function(b){ var u=URL.createObjectURL(b); var a=new Audio(u); a.play(); a.onended=function(){URL.revokeObjectURL(u);}; if(btn)btn.innerHTML='&#x1F50A;'; })
  .catch(function(){if(btn)btn.innerHTML='&#x1F50A;';});
};
RealTimeConversationEngine.prototype.render = function() {
  var h = '<div class="feat-title" style="display:flex;align-items:center;gap:10px;">REAL TALK';
  h += '<button data-cvoice style="background:'+(this.voiceEnabled?'rgba(255,215,0,0.15)':'rgba(255,255,255,0.06)')+';border:1px solid '+(this.voiceEnabled?'rgba(255,215,0,0.3)':'#333')+';border-radius:16px;padding:4px 10px;cursor:pointer;color:'+(this.voiceEnabled?'#FFD700':'#666')+';font-size:11px;">'+(this.voiceEnabled?'&#x1F50A; ON':'&#x1F507; OFF')+'</button>';
  if (this.freeUsed > 0 && this.freeUsed < this.freeLimit && !this.locked) {
    h += '<span style="font-size:9px;color:rgba(255,255,255,0.4);">'+(this.freeLimit - this.freeUsed)+' free left</span>';
  }
  h += '</div><div class="feat-sub">11 political heavyweights. One room. No filter.</div>';
  h += '<div class="s-persona-row">';
  var ids = Object.keys(this.personas);
  for (var i=0;i<ids.length;i++) {
    var id=ids[i], p=this.personas[id];
    var imgHtml = p.img ? '<img src="'+p.img+'" style="width:36px;height:36px;border-radius:50%;border:2px solid '+p.color+';object-fit:cover;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' : '';
    var initialsHtml = '<div style="'+(p.img?'display:none;':'display:flex;')+'width:36px;height:36px;border-radius:50%;border:2px solid '+p.color+';background:rgba(255,255,255,0.08);align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:'+p.color+';">'+(p.initials||p.name.slice(0,2).toUpperCase())+'</div>';
    h += '<div class="s-chip" style="border-color:'+p.color+';">'+imgHtml+initialsHtml+'<div class="s-chip-name" style="color:'+p.color+';">'+p.name+'</div><div style="font-size:8px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;">'+p.faction+'</div></div>';
  }
  h += '</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;justify-content:center;">';
  for (var t=0;t<this.topics.length;t++) {
    var tp=this.topics[t], active=this.topic===tp;
    h += '<button data-ctopic="'+tp+'" style="padding:5px 12px;background:'+(active?'rgba(212,164,32,0.15)':'#1a1a1a')+';border:1px solid '+(active?'#D4A420':'#333')+';border-radius:20px;color:'+(active?'#D4A420':'#aaa')+';font-size:11px;font-weight:bold;cursor:pointer;">'+tp+'</button>';
  }
  h += '</div>';
  if (this.locked) {
    h += '<div style="text-align:center;padding:16px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:12px;margin-bottom:12px;">';
    h += '<div style="font-size:14px;font-weight:bold;color:#FFD700;margin-bottom:4px;">Arena Access Required</div>';
    h += '<div style="font-size:11px;color:rgba(255,255,255,0.5);">Download the app to unlock full access with tokens</div>';
    h += '</div>';
  } else if (!this.running) {
    h += '<button class="feat-btn" data-cstart>START CONVERSATION</button>';
  } else {
    h += '<button class="feat-btn" style="background:rgba(255,77,77,0.15);border-color:#ff4d4d;color:#ff4d4d;" data-cstop>PAUSE</button>';
  }
  if (this.messages.length > 0) {
    h += '<div class="conv-stream" style="margin-top:12px;max-height:320px;overflow-y:auto;border:1px solid #222;border-radius:12px;padding:10px;background:#0a0a0a;">';
    for (var m=0;m<this.messages.length;m++) {
      var msg=this.messages[m], mp=this.personas[msg.persona];
      if (!mp) continue;
      var factionColor = mp.faction==='SELF'?'#ff4d4d':(mp.faction==='SUPPORTER'?'#4ADE80':'#60A5FA');
      h += '<div style="margin-bottom:10px;padding:8px 10px;border-left:3px solid '+mp.color+';background:rgba(255,255,255,0.02);border-radius:0 8px 8px 0;">';
      h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
      h += '<span style="font-size:11px;font-weight:bold;color:'+mp.color+';">'+mp.name+'</span>';
      h += '<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.06);color:'+factionColor+';text-transform:uppercase;letter-spacing:1px;">'+mp.faction+'</span>';
      h += '<button data-cspeak="'+msg.persona+'" data-ctext="'+msg.text.replace(/"/g,'&quot;').replace(/'/g,'&#39;')+'" style="margin-left:auto;background:none;border:none;color:#888;cursor:pointer;font-size:12px;">&#x1F50A;</button>';
      h += '</div>';
      h += '<div style="font-size:12px;color:#ccc;line-height:1.5;">'+msg.text+'</div>';
      h += '</div>';
    }
    h += '</div>';
    if (!this.running) { h += '<div style="text-align:center;margin-top:8px;"><button data-cclear style="background:none;border:1px solid #333;border-radius:8px;padding:4px 14px;color:#888;cursor:pointer;font-size:11px;">Clear</button></div>'; }
  }
  if (this.loading) { h += '<div class="feat-loading">Generating response...</div>'; }
  this.el.innerHTML = h;
};

window.RealTimeConversationEngine = RealTimeConversationEngine;
