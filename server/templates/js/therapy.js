function TherapyModule(id) {
  this.el = document.getElementById(id);
  this.therapist = 'trump';
  this.therapists = {
    trump: {name:'Dr. Trump',img:'/api/persona-image/trump',color:'#ff4d4d',style:'Tough love with tremendous confidence'},
    sophia: {name:'Dr. Sophia',img:'/server/assets/sophia.png',color:'#E91E63',style:'Warm, empathetic professional'},
    james: {name:'Dr. James',img:'/server/assets/james.png',color:'#2196F3',style:'Analytical, solution-focused'}
  };
  this.messages = [];
  this.loading = false;
  this.bindEvents();
  this.render();
}
TherapyModule.prototype.bindEvents = function() {
  var self = this;
  this.el.addEventListener('click', function(e) {
    var t = e.target;
    var th = t.closest('[data-therapist]');
    if (th) { self.therapist = th.getAttribute('data-therapist'); self.messages = []; self.render(); return; }
    if (t.closest('[data-tsend]')) { self.send(); return; }
  });
  this.el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.classList.contains('feat-input')) { self.send(); }
  });
};
TherapyModule.prototype.send = function() {
  var input = this.el.querySelector('.feat-input');
  if (!input || !input.value.trim() || this.loading) return;
  var msg = input.value.trim(); input.value = '';
  this.messages.push({role:'user', text:msg});
  this.loading = true; this.render();
  var self = this;
  fetch('/api/therapy', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message:msg, therapist:this.therapist, sessionId:'web_'+Date.now()})})
  .then(function(r){return r.json();})
  .then(function(d){ self.messages.push({role:'therapist', text: d.response || d.message || 'I hear you. Tell me more.'}); self.loading = false; self.render(); })
  .catch(function(){ self.messages.push({role:'therapist', text:'I hear you. Tell me more about that.'}); self.loading = false; self.render(); });
};
TherapyModule.prototype.render = function() {
  var th = this.therapists[this.therapist];
  var h = '<div class="feat-title">TRUMP THERAPY</div><div class="feat-sub">AI-powered counseling with a twist</div>';
  h += '<div class="feat-therapy-personas">';
  var ids = Object.keys(this.therapists);
  for (var i=0;i<ids.length;i++) { var tid=ids[i], t=this.therapists[tid];
    h += '<div class="feat-therapist'+(this.therapist===tid?' sel':'')+'" data-therapist="'+tid+'" style="border-color:'+(this.therapist===tid?t.color:'#333')+';">';
    h += '<img src="'+t.img+'" onerror="this.style.display=\'none\'"><div class="t-name" style="color:'+(this.therapist===tid?t.color:'#aaa')+';">'+t.name+'</div></div>';
  } h += '</div>';
  h += '<div class="feat-card"><p style="font-size:11px;color:#888;">Style: '+th.style+'</p></div>';
  if (this.messages.length > 0) {
    for (var m=0;m<this.messages.length;m++) { var msg=this.messages[m];
      if (msg.role==='user') h += '<div style="text-align:right;margin-bottom:8px;"><span style="background:#2a2a2a;padding:8px 12px;border-radius:16px 16px 4px 16px;font-size:12px;display:inline-block;max-width:80%;">'+msg.text+'</span></div>';
      else h += '<div style="margin-bottom:8px;display:flex;gap:6px;align-items:flex-start;"><img src="'+th.img+'" style="width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'"><span style="background:#141414;border:1px solid '+th.color+';padding:8px 12px;border-radius:4px 16px 16px 16px;font-size:12px;display:inline-block;max-width:80%;color:#eee;">'+msg.text+'</span></div>';
    }
    if (this.loading) h += '<div class="feat-loading">Thinking...</div>';
  }
  h += '<div style="display:flex;gap:8px;margin-top:10px;"><input class="feat-input" placeholder="What\'s on your mind?" style="flex:1;margin-bottom:0;"><button class="feat-btn" data-tsend style="width:auto;margin-top:0;padding:12px 20px;">Send</button></div>';
  h += '<div style="text-align:center;margin-top:12px;"><a href="/therapy-viral" style="color:#FFD700;font-size:12px;text-decoration:none;">Open full Therapy \u2192</a></div>';
  this.el.innerHTML = h;
  var chatArea = this.el.querySelector('.feat-input');
  if (chatArea) chatArea.focus();
};

window.TherapyModule = TherapyModule;
