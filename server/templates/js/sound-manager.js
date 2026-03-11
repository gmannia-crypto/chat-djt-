(function() {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  var soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
  var audioCtx = null;

  function getContext() {
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function beep() {
    if (!soundEnabled) return;
    try {
      var ctx = getContext();
      var oscillator = ctx.createOscillator();
      var gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }

  function updateToggle() {
    var el = document.getElementById('soundToggle');
    if (el) el.innerHTML = soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
  }

  window.SoundManager = {
    isEnabled: function() { return soundEnabled; },
    beep: beep,
    toggle: function() {
      soundEnabled = !soundEnabled;
      localStorage.setItem('soundEnabled', String(soundEnabled));
      updateToggle();
      if (soundEnabled) beep();
    }
  };

  var btn = document.createElement('button');
  btn.id = 'soundToggle';
  btn.innerHTML = soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
  btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9999;background:rgba(30,30,30,0.85);border:2px solid #FFD700;border-radius:50%;width:44px;height:44px;font-size:20px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
  document.body.appendChild(btn);

  document.addEventListener('click', function(e) {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('#soundToggle')) {
      window.SoundManager.toggle();
      return;
    }
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      beep();
    }
  });
})();
