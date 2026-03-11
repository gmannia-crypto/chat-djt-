function RealtyModule(id) {
  this.el = document.getElementById(id);
  this.query = '';
  this.advisor = 'trump';
  this.advisors = {
    trump:{name:'Trump',img:'/api/persona-image/trump',color:'#ff4d4d'},
    buffett:{name:'Buffett',img:'/api/persona-image/buffett',color:'#4d4dff'},
    suze:{name:'Suze',img:'/api/persona-image/suze',color:'#ff99cc'},
    genie:{name:'Genie',img:'/api/persona-image/genie',color:'#9B59B6'},
    ruckus:{name:'Ruckus',img:'/api/persona-image/ruckus',color:'#8B4513'}
  };
  this.properties = [];
  this.analysis = null;
  this.loading = false;
  this.active = null;
  this.signupDone = false;
  this.checkStatus();
}
RealtyModule.prototype.checkStatus = function() {
  var self = this;
  fetch('/api/realty/status')
    .then(function(r) { return r.json(); })
    .then(function(d) { self.active = !!d.active; self.render(); })
    .catch(function() { self.active = false; self.render(); });
};
RealtyModule.prototype.handleClick = function(e) {
  if (e.target.closest('[data-rsignup]')) { this.signup(); return; }
  if (!this.active) return;
  var adv = e.target.closest('[data-radvisor]');
  if (adv) { this.advisor = adv.getAttribute('data-radvisor'); this.render(); return; }
  if (e.target.closest('[data-rsearch]')) this.search();
  var prop = e.target.closest('[data-rprop]');
  if (prop) this.analyze(parseInt(prop.getAttribute('data-rprop')));
};
RealtyModule.prototype.handleKeydown = function(e) {
  if (!this.active) return;
  if (e.key === 'Enter' && e.target.getAttribute('data-rquery') !== null) this.search();
};
RealtyModule.prototype.handleInput = function(e) {
  if (e.target.getAttribute('data-rquery') !== null) this.query = e.target.value;
  if (e.target.getAttribute('data-remail') !== null) this.signupEmail = e.target.value;
};
RealtyModule.prototype.signup = function() {
  var email = (this.signupEmail || '').trim();
  if (!email || email.indexOf('@') === -1) return;
  var self = this;
  fetch('/api/realty-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  })
  .then(function() { self.signupDone = true; self.render(); })
  .catch(function() { self.signupDone = true; self.render(); });
};
RealtyModule.prototype.search = function() {
  if (!this.query.trim() || this.loading) return;
  this.loading = true; this.analysis = null; this.render();
  var self = this;
  fetch('/api/properties?location='+encodeURIComponent(this.query))
  .then(function(r){return r.json();})
  .then(function(d){ self.properties = d.properties || d.listings || []; self.loading = false; self.render(); })
  .catch(function(){ self.properties = [{address:'123 Trump Tower Dr',price:'$2,500,000',beds:4,baths:3,sqft:3200},{address:'456 Mar-a-Lago Ln',price:'$1,800,000',beds:3,baths:2,sqft:2400},{address:'789 Fifth Avenue',price:'$4,200,000',beds:5,baths:4,sqft:4500}]; self.loading = false; self.render(); });
};
RealtyModule.prototype.analyze = function(idx) {
  if (this.loading || idx >= this.properties.length) return;
  this.loading = true; this.render();
  var prop = this.properties[idx]; var self = this;
  fetch('/api/property-analysis', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({property:prop, personaId:this.advisor})})
  .then(function(r){return r.json();})
  .then(function(d){ self.analysis = d.comment || d.analysis || d.response || 'Tremendous property!'; self.loading = false; self.render(); })
  .catch(function(){ self.analysis = self.advisor==='trump' ? 'TREMENDOUS location! I know real estate better than anyone. This is a winner!' : 'Interesting property. Let me analyze the fundamentals.'; self.loading = false; self.render(); });
};
RealtyModule.prototype.renderConstruction = function() {
  var now = new Date().getTime();
  var target = new Date('2026-07-01T00:00:00').getTime();
  var dist = Math.max(0, target - now);
  var days = Math.floor(dist / 86400000);
  var hrs = Math.floor((dist % 86400000) / 3600000);
  var mins = Math.floor((dist % 3600000) / 60000);
  var secs = Math.floor((dist % 60000) / 1000);
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  var h = '<div class="re-construction">';
  h += '<div style="font-size:64px;margin-bottom:16px;">&#x1F3D7;&#xFE0F;</div>';
  h += '<h2 style="color:#ff4d4d;font-size:24px;font-weight:900;margin-bottom:10px;font-family:Playfair Display,serif;">Trump Reality \u2013 Under Construction</h2>';
  h += '<p style="color:#aaa;margin-bottom:20px;">We\'re integrating live Airbnb data and AI\u2011powered property analysis. Stay tuned!</p>';

  if (dist > 0) {
    h += '<div class="re-countdown">';
    var items = [[pad(days),'Days'],[pad(hrs),'Hours'],[pad(mins),'Minutes'],[pad(secs),'Seconds']];
    for (var i = 0; i < items.length; i++) {
      h += '<div class="re-cd-item"><span class="re-cd-num">' + items[i][0] + '</span><span class="re-cd-label">' + items[i][1] + '</span></div>';
    }
    h += '</div>';
  } else {
    h += '<div style="text-align:center;color:#FFD700;font-size:18px;margin:20px 0;">\uD83C\uDF89 Launching soon! Check back shortly.</div>';
  }

  if (this.signupDone) {
    h += '<div style="text-align:center;color:#4CAF50;margin:16px 0;font-weight:bold;">\u2705 Thanks! We\'ll notify you when we launch.</div>';
  } else {
    h += '<p style="color:#ccc;margin-top:16px;">Enter your email to get early access:</p>';
    h += '<div class="re-signup"><input type="email" data-remail placeholder="your@email.com" class="re-email-input"><button class="feat-btn" data-rsignup style="width:auto;padding:10px 18px;margin-top:0;">\uD83D\uDD14 NOTIFY ME</button></div>';
  }
  h += '<p style="font-size:11px;color:#666;margin-top:10px;">We\'ll never spam you. One\u2011time notification when we launch.</p>';
  h += '</div>';
  return h;
};
RealtyModule.prototype.render = function() {
  if (this.active === null) {
    this.el.innerHTML = '<div class="feat-loading">Loading...</div>';
    return;
  }
  if (!this.active) {
    this.el.innerHTML = this.renderConstruction();
    return;
  }
  var h = '<div class="feat-title">TRUMP REALTY</div><div class="feat-sub">AI-powered property analysis with persona advisors</div>';
  h += '<div class="feat-advisor-row">';
  var ids = Object.keys(this.advisors);
  for (var i=0;i<ids.length;i++) { var aid=ids[i],a=this.advisors[aid];
    h += '<div class="feat-advisor'+(this.advisor===aid?' sel':'')+'" data-radvisor="'+aid+'" style="border-color:'+(this.advisor===aid?a.color:'#333')+';">';
    h += '<img src="'+a.img+'" onerror="this.style.display=\'none\'"><div class="a-name" style="color:'+(this.advisor===aid?a.color:'#aaa')+';">'+a.name+'</div></div>';
  } h += '</div>';
  h += '<div style="display:flex;gap:8px;margin-bottom:12px;"><input class="feat-input" data-rquery placeholder="Search a city or zip code..." value="'+this.query+'" style="flex:1;margin-bottom:0;"><button class="feat-btn" data-rsearch style="width:auto;margin-top:0;padding:12px 20px;">Search</button></div>';
  if (this.loading && this.properties.length===0) h += '<div class="feat-loading">Searching properties...</div>';
  for (var p=0;p<this.properties.length;p++) { var pr=this.properties[p];
    h += '<div class="feat-property" data-rprop="'+p+'" style="cursor:pointer;"><h4>'+(pr.address||pr.title||'Property')+'</h4><div class="prop-price">'+(pr.price||'$0')+'</div><div class="prop-details">'+(pr.beds||'?')+' bed / '+(pr.baths||'?')+' bath / '+(pr.sqft||'?')+' sqft</div></div>';
  }
  if (this.loading && this.properties.length>0) h += '<div class="feat-loading">Analyzing property...</div>';
  if (this.analysis) { var adv=this.advisors[this.advisor]; h += '<div class="feat-result" style="border-color:'+adv.color+';"><div class="result-label" style="color:'+adv.color+';">'+adv.name.toUpperCase()+' SAYS</div><div class="result-text">"'+this.analysis+'"</div></div>'; }
  this.el.innerHTML = h;
};

window.RealtyModule = RealtyModule;
