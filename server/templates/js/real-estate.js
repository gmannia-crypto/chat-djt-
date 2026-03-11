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
  this.bindEvents();
  this.render();
}
RealtyModule.prototype.bindEvents = function() {
  var self = this;
  this.el.addEventListener('click', function(e) {
    var adv = e.target.closest('[data-radvisor]');
    if (adv) { self.advisor = adv.getAttribute('data-radvisor'); self.render(); return; }
    if (e.target.closest('[data-rsearch]')) self.search();
    var prop = e.target.closest('[data-rprop]');
    if (prop) self.analyze(parseInt(prop.getAttribute('data-rprop')));
  });
  this.el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.getAttribute('data-rquery') !== null) self.search();
  });
  this.el.addEventListener('input', function(e) {
    if (e.target.getAttribute('data-rquery') !== null) self.query = e.target.value;
  });
};
RealtyModule.prototype.search = function() {
  if (!this.query.trim() || this.loading) return;
  this.loading = true; this.analysis = null; this.render();
  var self = this;
  fetch('/api/properties?q='+encodeURIComponent(this.query))
  .then(function(r){return r.json();})
  .then(function(d){ self.properties = d.properties || d.listings || []; self.loading = false; self.render(); })
  .catch(function(){ self.properties = [{address:'123 Trump Tower Dr',price:'$2,500,000',beds:4,baths:3,sqft:3200},{address:'456 Mar-a-Lago Ln',price:'$1,800,000',beds:3,baths:2,sqft:2400},{address:'789 Fifth Avenue',price:'$4,200,000',beds:5,baths:4,sqft:4500}]; self.loading = false; self.render(); });
};
RealtyModule.prototype.analyze = function(idx) {
  if (this.loading || idx >= this.properties.length) return;
  this.loading = true; this.render();
  var prop = this.properties[idx]; var self = this;
  fetch('/api/property-analysis', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({property:prop, advisor:this.advisor})})
  .then(function(r){return r.json();})
  .then(function(d){ self.analysis = d.analysis || d.response || 'Tremendous property!'; self.loading = false; self.render(); })
  .catch(function(){ self.analysis = self.advisor==='trump' ? 'TREMENDOUS location! I know real estate better than anyone. This is a winner!' : 'Interesting property. Let me analyze the fundamentals.'; self.loading = false; self.render(); });
};
RealtyModule.prototype.render = function() {
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
