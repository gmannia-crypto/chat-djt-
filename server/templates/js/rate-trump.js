function RateModule(id) {
  this.el = document.getElementById(id);
  this.rating = 75;
  this.result = null;
  this.loading = false;
  this.leaderboard = [];
  this.bindEvents();
  this.fetchLeaderboard();
  this.render();
}
RateModule.prototype.bindEvents = function() {
  var self = this;
  this.el.addEventListener('input', function(e) {
    if (e.target.classList.contains('feat-slider')) { self.rating = parseInt(e.target.value); self.render(); }
  });
  this.el.addEventListener('click', function(e) {
    if (e.target.closest('[data-rsubmit]')) self.submit();
  });
};
RateModule.prototype.fetchLeaderboard = function() {
  var self = this;
  fetch('/api/rate-trump/leaderboard').then(function(r){return r.json();}).then(function(d){ self.leaderboard = d.leaderboard || d.ratings || []; self.render(); }).catch(function(){});
};
RateModule.prototype.submit = function() {
  if (this.loading) return;
  this.loading = true; this.render();
  var self = this;
  fetch('/api/rate-trump', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({rating:this.rating, name:'Web Visitor'})})
  .then(function(r){return r.json();})
  .then(function(d){ self.result = d.reaction || d.response || 'Tremendous rating!'; self.loading = false; self.render(); })
  .catch(function(){ self.result = self.rating >= 80 ? 'Now THAT is a tremendous rating! You clearly have great taste!' : self.rating >= 50 ? 'Not bad, but I\'ve seen better. Much better.' : 'Fake rating! Very unfair!'; self.loading = false; self.render(); });
};
RateModule.prototype.render = function() {
  var col = this.rating >= 80 ? '#4CAF50' : this.rating >= 50 ? '#FFD700' : '#ff4d4d';
  var label = this.rating >= 80 ? 'TREMENDOUS' : this.rating >= 50 ? 'NOT BAD' : 'FAKE NEWS';
  var h = '<div class="feat-title">RATE TRUMP</div><div class="feat-sub">How great is the greatest president ever?</div>';
  h += '<div style="text-align:center;margin-bottom:8px;"><span style="font-size:48px;font-weight:900;color:'+col+';font-family:Playfair Display,serif;">'+this.rating+'</span><span style="font-size:14px;color:#888;">/100</span></div>';
  h += '<div style="text-align:center;margin-bottom:8px;font-size:12px;font-weight:bold;color:'+col+';letter-spacing:2px;">'+label+'</div>';
  h += '<div class="feat-rating-bar"><div class="feat-rating-fill" style="width:'+this.rating+'%;background:'+col+';"></div></div>';
  h += '<input type="range" min="0" max="100" value="'+this.rating+'" class="feat-slider" style="accent-color:'+col+';">';
  if (!this.result) h += '<button class="feat-btn" data-rsubmit'+(this.loading?' disabled':'')+'>'+( this.loading ? 'Rating...' : 'SUBMIT RATING')+'</button>';
  if (this.result) { h += '<div class="feat-result"><div class="result-label">TRUMP SAYS</div><div class="result-text">"'+this.result+'"</div></div>'; }
  if (this.leaderboard.length > 0) {
    h += '<div style="margin-top:14px;"><div style="font-size:11px;color:#FFD700;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">TOP RATERS</div><ul class="feat-leaderboard">';
    for (var i=0;i<Math.min(this.leaderboard.length,5);i++) { var r=this.leaderboard[i]; h+='<li><span class="rank">#'+(i+1)+'</span><span class="name">'+(r.name||'Anonymous')+'</span><span class="score">'+(r.rating||r.score||0)+'</span></li>'; }
    h += '</ul></div>';
  }
  this.el.innerHTML = h;
};

window.RateModule = RateModule;
