function RatingWidget(container, options) {
  this.container = typeof container === 'string' ? document.getElementById(container) : container;
  this.context = options.context || '';
  this.min = options.min != null ? options.min : 0;
  this.max = options.max != null ? options.max : 100;
  this.value = options.value != null ? options.value : Math.round((this.max - this.min) / 2);
  this.label = options.label || '';
  this.submitLabel = options.submitLabel || 'SUBMIT RATING';
  this.loadingLabel = options.loadingLabel || 'Rating...';
  this.onSubmit = options.onSubmit || function() {};
  this.onChanged = options.onChanged || function() {};
  this.loading = false;
  this.result = null;
  this.thresholds = options.thresholds || [
    { at: 80, color: '#4CAF50', label: 'TREMENDOUS' },
    { at: 50, color: '#FFD700', label: 'NOT BAD' },
    { at: 0, color: '#ff4d4d', label: 'FAKE NEWS' }
  ];
}

RatingWidget.prototype.getThreshold = function() {
  for (var i = 0; i < this.thresholds.length; i++) {
    if (this.value >= this.thresholds[i].at) return this.thresholds[i];
  }
  return this.thresholds[this.thresholds.length - 1];
};

RatingWidget.prototype.render = function() {
  var t = this.getThreshold();
  var h = '';
  if (this.label) h += '<div class="feat-title">' + this.label + '</div>';
  h += '<div style="text-align:center;margin-bottom:8px;">';
  h += '<span style="font-size:48px;font-weight:900;color:' + t.color + ';font-family:Playfair Display,serif;">' + this.value + '</span>';
  h += '<span style="font-size:14px;color:#888;">/' + this.max + '</span></div>';
  h += '<div style="text-align:center;margin-bottom:8px;font-size:12px;font-weight:bold;color:' + t.color + ';letter-spacing:2px;">' + t.label + '</div>';
  h += '<div class="feat-rating-bar"><div class="feat-rating-fill" style="width:' + ((this.value - this.min) / (this.max - this.min) * 100) + '%;background:' + t.color + ';"></div></div>';
  h += '<input type="range" min="' + this.min + '" max="' + this.max + '" value="' + this.value + '" class="feat-slider" data-rw-slider style="accent-color:' + t.color + ';">';
  if (!this.result) {
    h += '<button class="feat-btn" data-rw-submit' + (this.loading ? ' disabled' : '') + '>' + (this.loading ? this.loadingLabel : this.submitLabel) + '</button>';
  }
  if (this.result) {
    h += '<div class="feat-result"><div class="result-label">' + this.context + ' SAYS</div><div class="result-text">"' + this.result + '"</div></div>';
  }
  return h;
};

RatingWidget.prototype.handleClick = function(e) {
  if (e.target.closest('[data-rw-submit]') && !this.loading) {
    this.onSubmit(this.value);
    return true;
  }
  return false;
};

RatingWidget.prototype.handleInput = function(e) {
  if (e.target.hasAttribute && e.target.hasAttribute('data-rw-slider')) {
    this.value = parseInt(e.target.value);
    this.onChanged(this.value);
    return true;
  }
  return false;
};

RatingWidget.prototype.setLoading = function(loading) {
  this.loading = loading;
};

RatingWidget.prototype.setResult = function(result) {
  this.result = result;
};

window.RatingWidget = RatingWidget;
