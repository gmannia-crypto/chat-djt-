function DashboardModule(id) {
  this.el = document.getElementById(id);
  this.news = [];
  this.hotTakes = [];
  this.loading = true;
  this.bindEvents();
  this.fetchData();
}
DashboardModule.prototype.bindEvents = function() {
  var self = this;
  this.el.addEventListener('click', function(e) {
    if (e.target.closest('[data-drefresh]')) { self.loading = true; self.render(); self.fetchData(); }
  });
};
DashboardModule.prototype.fetchData = function() {
  var self = this;
  Promise.all([
    fetch('/api/news').then(function(r){return r.json();}).catch(function(){return {headlines:[]};}),
    fetch('/api/market-hot-takes').then(function(r){return r.json();}).catch(function(){return {takes:[]};})
  ]).then(function(results) {
    self.news = results[0].headlines || results[0].articles || [];
    self.hotTakes = results[1].takes || results[1].hotTakes || [];
    self.loading = false;
    self.render();
  }).catch(function() {
    self.news = [{title:'Markets doing tremendous things today', source:'Trump News Network'}];
    self.hotTakes = [{take:'The economy is the best it has ever been. Believe me!'}];
    self.loading = false;
    self.render();
  });
};
DashboardModule.prototype.render = function() {
  var h = '<div class="feat-title">DASHBOARD</div><div class="feat-sub">Trump\'s take on today\'s world</div>';
  if (this.loading) { h += '<div class="feat-loading">Loading intelligence briefing...</div>'; this.el.innerHTML = h; return; }
  h += '<div class="feat-grid"><div class="feat-stat"><div class="stat-val">'+this.news.length+'</div><div class="stat-lbl">HEADLINES</div></div><div class="feat-stat"><div class="stat-val">'+this.hotTakes.length+'</div><div class="stat-lbl">HOT TAKES</div></div></div>';
  if (this.news.length > 0) {
    h += '<div style="font-size:11px;color:#FFD700;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">TOP HEADLINES</div>';
    for (var i=0;i<Math.min(this.news.length,5);i++) { var n=this.news[i];
      h += '<div class="feat-card"><h4>'+(n.title || n.headline || 'Breaking News')+'</h4><p>'+(n.source || '')+'</p></div>';
    }
  }
  if (this.hotTakes.length > 0) {
    h += '<div style="font-size:11px;color:#ff4d4d;font-weight:bold;letter-spacing:2px;margin:12px 0 8px;">MARKET HOT TAKES</div>';
    for (var j=0;j<Math.min(this.hotTakes.length,3);j++) { var t=this.hotTakes[j];
      h += '<div class="feat-card" style="border-color:rgba(255,77,77,0.2);"><p>'+(t.take || t.text || t.commentary || 'Markets are tremendous!')+'</p></div>';
    }
  }
  h += '<button class="feat-btn" data-drefresh style="background:linear-gradient(135deg,#333,#555);color:#fff;">REFRESH BRIEFING</button>';
  this.el.innerHTML = h;
};

window.DashboardModule = DashboardModule;
