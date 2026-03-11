function FaceoffModule(id) {
  this.el = document.getElementById(id);
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
  this.assets = ['AAPL','TSLA','BTC','GOLD','SPY','AMC','NVDA','META'];
  this.p1 = 'trump'; this.p2 = 'buffett'; this.asset = 'BTC';
  this.voted = false; this.debating = false; this.pick1 = ''; this.pick2 = '';
  this.bindEvents();
  this.render();
}
FaceoffModule.prototype.bindEvents = function() {
  var self = this;
  this.el.addEventListener('click', function(e) {
    var t = e.target;
    var chip = t.closest('[data-fp]');
    if (chip) { self.selectPersona(chip.getAttribute('data-fp')); return; }
    var asset = t.closest('[data-fasset]');
    if (asset) { self.asset = asset.getAttribute('data-fasset'); self.voted = false; self.pick1 = ''; self.pick2 = ''; self.render(); return; }
    if (t.closest('[data-fdebate]')) { self.startDebate(); return; }
    var vote = t.closest('[data-fvote]');
    if (vote) { self.castVote(vote.getAttribute('data-fvote')); return; }
    var speak = t.closest('[data-fspeak]');
    if (speak) { e.stopPropagation(); self.speak(speak.getAttribute('data-fspeak'), speak.getAttribute('data-ftext') || ''); return; }
  });
};
FaceoffModule.prototype.selectPersona = function(id) {
  if (id === this.p1) return;
  if (id === this.p2) { this.p2 = this.p1; this.p1 = id; } else { this.p2 = id; }
  this.voted = false; this.pick1 = ''; this.pick2 = ''; this.render();
};
FaceoffModule.prototype.startDebate = function() {
  if (this.debating) return;
  this.debating = true; this.render();
  var self = this;
  fetch('/api/faceoff/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({asset: this.asset, persona1: this.p1, persona2: this.p2}) })
  .then(function(r) { return r.json(); })
  .then(function(d) { self.pick1 = d.response1 || d.pick1 || 'BUY! This is tremendous!'; self.pick2 = d.response2 || d.pick2 || 'I\'d wait for better value.'; self.debating = false; self.render(); })
  .catch(function() { self.pick1 = 'BUY! Greatest opportunity ever!'; self.pick2 = 'SELL. The fundamentals are weak.'; self.debating = false; self.render(); });
};
FaceoffModule.prototype.castVote = function(winner) {
  if (this.voted) return; this.voted = true;
  var loser = winner === this.p1 ? this.p2 : this.p1;
  fetch('/api/faceoff/vote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({debateId:'web_'+this.p1+'_'+this.p2+'_'+Date.now(), asset:this.asset, persona1:this.p1, persona2:this.p2, votedFor:winner}) }).catch(function(){});
  this.render();
};
FaceoffModule.prototype.speak = function(pid, text) {
  var btn = this.el.querySelector('[data-fspeak="'+pid+'"]');
  if (btn) btn.textContent = '...';
  fetch('/api/persona-speak', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text:(text||'No comment.').slice(0,300), personaId:pid}) })
  .then(function(r){return r.blob();}).then(function(b){ var u=URL.createObjectURL(b); var a=new Audio(u); a.play(); a.onended=function(){URL.revokeObjectURL(u);}; if(btn)btn.textContent='\u{1F50A}'; })
  .catch(function(){if(btn)btn.textContent='\u{1F50A}';});
};
FaceoffModule.prototype.render = function() {
  var p1 = this.personas[this.p1], p2 = this.personas[this.p2];
  var h = '<div class="feat-title">FINANCIAL FACEOFF</div><div class="feat-sub">Pick two personas. Pick an asset. Let them debate.</div>';
  h += '<div class="s-persona-row">';
  var ids = Object.keys(this.personas);
  for (var i=0;i<ids.length;i++) { var id=ids[i],p=this.personas[id],s1=this.p1===id,s2=this.p2===id,bc=s1?p1.color:(s2?p2.color:'#333');
    h+='<div class="s-chip'+(s1||s2?' sel':'')+'" style="border-color:'+bc+';" data-fp="'+id+'"><img src="'+p.img+'" style="border-color:'+p.color+';" onerror="this.style.display=\'none\'"><div class="s-chip-name" style="color:'+(s1||s2?p.color:'#aaa')+';">'+p.name+'</div></div>';
  } h += '</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">';
  for (var a=0;a<this.assets.length;a++) { var ast=this.assets[a]; h+='<button data-fasset="'+ast+'" style="padding:6px 12px;background:'+(this.asset===ast?'rgba(212,164,32,0.15)':'#1a1a1a')+';border:1px solid '+(this.asset===ast?'#D4A420':'#333')+';border-radius:20px;color:'+(this.asset===ast?'#D4A420':'#aaa')+';font-size:11px;font-weight:bold;cursor:pointer;">'+ast+'</button>'; }
  h += '</div>';
  if (!this.pick1 && !this.debating) { h += '<button class="feat-btn" data-fdebate>START DEBATE: '+p1.name+' vs '+p2.name+' on '+this.asset+'</button>'; }
  if (this.debating) { h += '<div class="feat-loading">Generating debate...</div>'; }
  if (this.pick1) {
    h += '<div class="s-debate">';
    h += '<div class="s-debater" style="border-color:'+p1.color+';"><img src="'+p1.img+'" style="border-color:'+p1.color+';" onerror="this.style.display=\'none\'"><div class="s-d-name" style="color:'+p1.color+';">'+p1.name+'</div><div class="s-d-pick">'+this.pick1+'</div><button class="s-d-listen" data-fspeak="'+this.p1+'" data-ftext="'+this.pick1.replace(/"/g,'&quot;')+'">\u{1F50A}</button><button class="s-vote-btn" style="background:'+p1.color+';"'+(this.voted?' disabled':'')+' data-fvote="'+this.p1+'">VOTE</button></div>';
    h += '<div class="s-vs">VS</div>';
    h += '<div class="s-debater" style="border-color:'+p2.color+';"><img src="'+p2.img+'" style="border-color:'+p2.color+';" onerror="this.style.display=\'none\'"><div class="s-d-name" style="color:'+p2.color+';">'+p2.name+'</div><div class="s-d-pick">'+this.pick2+'</div><button class="s-d-listen" data-fspeak="'+this.p2+'" data-ftext="'+this.pick2.replace(/"/g,'&quot;')+'">\u{1F50A}</button><button class="s-vote-btn" style="background:'+p2.color+';"'+(this.voted?' disabled':'')+' data-fvote="'+this.p2+'">VOTE</button></div>';
    h += '</div>';
  }
  h += '<div style="text-align:center;margin-top:12px;"><a href="/financial-faceoff" style="color:#FFD700;font-size:12px;text-decoration:none;">Open full Faceoff \u2192</a></div>';
  this.el.innerHTML = h;
};

window.FaceoffModule = FaceoffModule;
