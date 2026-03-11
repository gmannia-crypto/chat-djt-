function FortuneModule(id) {
  this.el = document.getElementById(id);
  this.name = '';
  this.zodiac = '';
  this.topic = 'money';
  this.result = null;
  this.loading = false;
  this.zodiacs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  this.topics = ['money','love','career','health','power'];
  this.bindEvents();
  this.render();
}
FortuneModule.prototype.bindEvents = function() {
  var self = this;
  this.el.addEventListener('click', function(e) {
    var z = e.target.closest('[data-zodiac]');
    if (z) { self.zodiac = z.getAttribute('data-zodiac'); self.render(); return; }
    var tp = e.target.closest('[data-ftopic]');
    if (tp) { self.topic = tp.getAttribute('data-ftopic'); self.render(); return; }
    if (e.target.closest('[data-fortune]')) self.getFortune();
  });
  this.el.addEventListener('input', function(e) {
    if (e.target.getAttribute('data-fname') !== null) self.name = e.target.value;
  });
};
FortuneModule.prototype.getFortune = function() {
  if (this.loading || !this.zodiac) return;
  this.loading = true; this.render();
  var self = this;
  fetch('/api/fortune', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:this.name||'Friend', zodiac:this.zodiac, topic:this.topic})})
  .then(function(r){return r.json();})
  .then(function(d){ self.result = d.fortune || d.response || d.prediction || 'The stars say TREMENDOUS things are coming!'; self.loading = false; self.render(); })
  .catch(function(){ self.result = 'The crystal ball shows... WINNING! Believe me, ' + (self.name || 'my friend') + ', the best is yet to come!'; self.loading = false; self.render(); });
};
FortuneModule.prototype.render = function() {
  var h = '<div class="feat-title">FORTUNE PARLOR</div><div class="feat-sub">Trump reads your destiny</div>';
  h += '<div class="feat-fortune-orb">\u{1F52E}</div>';
  h += '<input class="feat-input" data-fname placeholder="Enter your name..." value="'+this.name+'">';
  h += '<div style="font-size:11px;color:#9B59B6;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">ZODIAC SIGN</div>';
  h += '<div class="feat-zodiac-row">';
  for (var i=0;i<this.zodiacs.length;i++) { var z=this.zodiacs[i]; h+='<button class="feat-zodiac'+(this.zodiac===z?' sel':'')+'" data-zodiac="'+z+'">'+z+'</button>'; }
  h += '</div>';
  h += '<div style="font-size:11px;color:#9B59B6;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">TOPIC</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">';
  for (var t=0;t<this.topics.length;t++) { var tp=this.topics[t]; h+='<button data-ftopic="'+tp+'" style="padding:6px 14px;background:'+(this.topic===tp?'rgba(155,89,182,0.15)':'#1a1a1a')+';border:1px solid '+(this.topic===tp?'#9B59B6':'#333')+';border-radius:20px;color:'+(this.topic===tp?'#9B59B6':'#aaa')+';font-size:11px;font-weight:bold;cursor:pointer;text-transform:capitalize;">'+tp+'</button>'; }
  h += '</div>';
  if (!this.result) h += '<button class="feat-btn" data-fortune style="background:linear-gradient(135deg,#9B59B6,#6C3483);"'+(this.loading || !this.zodiac?' disabled':'')+'>'+( this.loading ? 'Consulting the stars...' : 'REVEAL MY FORTUNE')+'</button>';
  if (this.result) { h += '<div class="feat-result" style="border-color:#9B59B6;"><div class="result-label" style="color:#9B59B6;">YOUR FORTUNE</div><div class="result-text">"'+this.result+'"</div></div>'; }
  this.el.innerHTML = h;
};

window.FortuneModule = FortuneModule;
