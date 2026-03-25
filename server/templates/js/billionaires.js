function _bEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function BillionairesModule(id) {
  this.el = document.getElementById(id);
  this.netWorth = 1000000;
  this.round = 0;
  this.deals = [];
  this.history = [];
  this.gameOver = false;
  this.generateDeals();
  this.render();
}
BillionairesModule.prototype.handleClick = function(e) {
  var deal = e.target.closest('[data-bdeal]');
  if (deal) { this.makeDeal(parseInt(deal.getAttribute('data-bdeal'))); return; }
  if (e.target.closest('[data-breset]')) { this.netWorth=1000000; this.round=0; this.history=[]; this.gameOver=false; this.generateDeals(); this.render(); }
};
BillionairesModule.prototype.generateDeals = function() {
  var allDeals = [
    {name:'Trump Tower Penthouse',cost:500000,roi:0.35,risk:0.2},{name:'Bitcoin Mining Farm',cost:250000,roi:0.8,risk:0.5},
    {name:'Golf Course Resort',cost:750000,roi:0.25,risk:0.15},{name:'Tech Startup',cost:100000,roi:1.5,risk:0.6},
    {name:'Oil Pipeline',cost:400000,roi:0.4,risk:0.3},{name:'Casino & Hotel',cost:600000,roi:0.5,risk:0.4},
    {name:'Social Media Platform',cost:300000,roi:1.0,risk:0.55},{name:'Private Jet Charter',cost:800000,roi:0.3,risk:0.25},
    {name:'NFT Collection',cost:50000,roi:2.0,risk:0.7},{name:'Manhattan Real Estate',cost:900000,roi:0.2,risk:0.1},
    {name:'Space Tourism',cost:450000,roi:1.2,risk:0.65},{name:'Luxury Brand',cost:350000,roi:0.45,risk:0.2}
  ];
  this.deals = [];
  for (var i=0;i<3;i++) { var idx=Math.floor(Math.random()*allDeals.length); this.deals.push(allDeals.splice(idx,1)[0]); }
};
BillionairesModule.prototype.makeDeal = function(idx) {
  if (this.gameOver || idx >= this.deals.length) return;
  var deal = this.deals[idx];
  if (deal.cost > this.netWorth) return;
  var won = Math.random() > deal.risk;
  var profit = won ? Math.floor(deal.cost * deal.roi) : -deal.cost;
  this.netWorth += profit;
  this.history.push({deal:deal.name, profit:profit, won:won});
  this.round++;
  if (this.netWorth <= 0) { this.gameOver = true; }
  else if (this.netWorth >= 1000000000) { this.gameOver = true; }
  else { this.generateDeals(); }
  this.render();
};
BillionairesModule.prototype.render = function() {
  var h = '<div class="feat-title">BILLIONAIRES</div><div class="feat-sub">Build your empire. Can you hit $1B?</div>';
  var col = this.netWorth >= 1000000000 ? '#4CAF50' : this.netWorth > 500000 ? '#D4A420' : '#ff4d4d';
  h += '<div class="feat-net-worth" style="color:'+col+';">$'+this.netWorth.toLocaleString()+'</div>';
  h += '<div class="feat-grid"><div class="feat-stat"><div class="stat-val">'+this.round+'</div><div class="stat-lbl">ROUND</div></div><div class="feat-stat"><div class="stat-val">'+this.history.filter(function(x){return x.won;}).length+'</div><div class="stat-lbl">WINS</div></div></div>';
  if (this.gameOver) {
    if (this.netWorth >= 1000000000) h += '<div class="feat-result" style="border-color:#4CAF50;"><div class="result-label" style="color:#4CAF50;">BILLIONAIRE STATUS</div><div class="result-text">You did it! Trump would be proud. Tremendous business instincts!</div></div>';
    else h += '<div class="feat-result" style="border-color:#ff4d4d;"><div class="result-label" style="color:#ff4d4d;">BANKRUPT</div><div class="result-text">You\'re fired! But don\'t worry, even Trump went bankrupt a few times.</div></div>';
    h += '<button class="feat-btn" data-breset>PLAY AGAIN</button>';
  } else {
    h += '<div style="font-size:11px;color:#FFD700;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">CHOOSE YOUR DEAL</div>';
    for (var i=0;i<this.deals.length;i++) { var d=this.deals[i]; var canAfford=d.cost<=this.netWorth;
      h += '<div class="feat-deal" data-bdeal="'+i+'" style="opacity:'+(canAfford?'1':'0.4')+';cursor:'+(canAfford?'pointer':'not-allowed')+';">';
      h += '<h4>'+_bEsc(d.name)+'</h4><div class="deal-price">Cost: $'+d.cost.toLocaleString()+'</div>';
      h += '<div class="deal-roi" style="color:#4CAF50;">Potential ROI: +'+(d.roi*100).toFixed(0)+'%</div>';
      h += '<div class="deal-roi" style="color:#ff4d4d;">Risk: '+(d.risk*100).toFixed(0)+'%</div></div>';
    }
  }
  if (this.history.length > 0) {
    h += '<div style="margin-top:12px;font-size:11px;color:#FFD700;font-weight:bold;letter-spacing:2px;margin-bottom:6px;">DEAL HISTORY</div>';
    for (var j=this.history.length-1;j>=Math.max(0,this.history.length-3);j--) { var hl=this.history[j];
      h += '<div style="font-size:11px;padding:4px 0;color:'+(hl.won?'#4CAF50':'#ff4d4d')+';">'+(hl.won?'\u2713':'\u2717')+' '+_bEsc(hl.deal)+': '+(hl.profit>=0?'+':'')+' $'+Math.abs(hl.profit).toLocaleString()+'</div>';
    }
  }
  this.el.innerHTML = h;
};

window.BillionairesModule = BillionairesModule;
