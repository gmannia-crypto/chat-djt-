function RateModule(id) {
  this.el = document.getElementById(id);
  this.leaderboard = [];
  var self = this;
  this.widget = new RatingWidget(this.el, {
    context: 'TRUMP',
    label: 'RATE TRUMP',
    value: 75,
    thresholds: [
      { at: 80, color: '#4CAF50', label: 'TREMENDOUS' },
      { at: 50, color: '#FFD700', label: 'NOT BAD' },
      { at: 0, color: '#ff4d4d', label: 'FAKE NEWS' }
    ],
    onSubmit: function(val) { self.submit(val); },
    onChanged: function() {}
  });
  this.fetchLeaderboard();
  this.render();
}
RateModule.prototype.handleClick = function(e) {
  this.widget.handleClick(e);
};
RateModule.prototype.handleInput = function(e) {
  if (this.widget.handleInput(e)) { this.render(); }
};
RateModule.prototype.fetchLeaderboard = function() {
  var self = this;
  fetch('/api/rate-trump/leaderboard').then(function(r){return r.json();}).then(function(d){ self.leaderboard = d.leaderboard || d.ratings || []; self.render(); }).catch(function(){});
};
RateModule.prototype.submit = function(val) {
  if (this.widget.loading) return;
  this.widget.setLoading(true); this.render();
  var self = this;
  fetch('/api/rate-trump', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({rating: val, name:'Web Visitor'})})
  .then(function(r){return r.json();})
  .then(function(d){ self.widget.setResult(d.reaction || d.response || 'Tremendous rating!'); self.widget.setLoading(false); self.render(); })
  .catch(function(){ var v = val; self.widget.setResult(v >= 80 ? 'Now THAT is a tremendous rating! You clearly have great taste!' : v >= 50 ? 'Not bad, but I\'ve seen better. Much better.' : 'Fake rating! Very unfair!'); self.widget.setLoading(false); self.render(); });
};
RateModule.prototype.render = function() {
  var h = '<div class="feat-sub">How great is the greatest president ever?</div>';
  h += this.widget.render();
  if (this.leaderboard.length > 0) {
    h += '<div style="margin-top:14px;"><div style="font-size:11px;color:#FFD700;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">TOP RATERS</div><ul class="feat-leaderboard">';
    for (var i=0;i<Math.min(this.leaderboard.length,5);i++) { var r=this.leaderboard[i]; h+='<li><span class="rank">#'+(i+1)+'</span><span class="name">'+(r.name||'Anonymous')+'</span><span class="score">'+(r.rating||r.score||0)+'</span></li>'; }
    h += '</ul></div>';
  }
  this.el.innerHTML = h;
};

window.RateModule = RateModule;
