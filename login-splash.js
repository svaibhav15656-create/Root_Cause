(function () {
  'use strict';

  var canvas = document.getElementById('tunnel-canvas');
  var ctx = canvas.getContext('2d');
  var W, H, cx, cy, raf;
  var RING_COUNT = 14;
  var TUNNEL_DURATION = 2800;
  var FADE_START = 1900;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
  }

  resize();
  window.addEventListener('resize', resize);

  var startTime = null;
  var tunnelDone = false;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
  }

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function drawTunnel(ts) {
    if (!startTime) startTime = ts;
    var elapsed = ts - startTime;
    var progress = Math.min(elapsed / TUNNEL_DURATION, 1);
    var ease = easeInOutCubic(progress);

    var alpha = 1;
    if (elapsed > FADE_START) {
      alpha = 1 - easeOutExpo((elapsed - FADE_START) / (TUNNEL_DURATION - FADE_START));
      if (alpha < 0) alpha = 0;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    var maxRadius = Math.hypot(cx, cy) * 1.15;

    for (var i = 0; i < RING_COUNT; i++) {
      var ringPhase = ((i / RING_COUNT) + ease * 0.9) % 1;
      var perspective = 1 - ringPhase;
      var radius = maxRadius * perspective;
      var ringAlpha = alpha * (0.05 + perspective * 0.25);

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.5, radius), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(110,155,220,' + ringAlpha + ')';
      ctx.lineWidth = 0.7 + perspective * 1.5;
      ctx.stroke();
    }

    /* horizontal scan lines */
    for (var row = 0; row < H; row += 80) {
      ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.018) + ')';
      ctx.fillRect(0, row, W, 1);
    }

    /* central glow */
    if (alpha > 0.02) {
      var glowR = 150 * (0.5 + ease * 0.7);
      var grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, 'rgba(90,150,255,' + (alpha * 0.14) + ')');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }

    if (progress < 1) {
      raf = requestAnimationFrame(drawTunnel);
    } else {
      tunnelDone = true;
      showPicker();
    }
  }

  function showPicker() {
    var splash = document.getElementById('splash');
    var picker = document.getElementById('picker');

    splash.style.transition = 'opacity 0.6s ease';
    splash.style.opacity = '0';

    setTimeout(function () {
      splash.style.display = 'none';
      cancelAnimationFrame(raf);
      picker.classList.add('visible');

      var cards = picker.querySelectorAll('.feature-card');
      for (var i = 0; i < cards.length; i++) {
        (function (card, index) {
          setTimeout(function () {
            card.classList.add('card-in');
          }, index * 100);
        })(cards[i], i);
      }
    }, 600);
  }

  /* skip tunnel on reduced-motion */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tunnelDone = true;
    showPicker();
  } else {
    raf = requestAnimationFrame(drawTunnel);
  }

  /* Escape shortcut: go straight to explainer */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && tunnelDone) {
      window.location.href = '/dashboard.html#explain';
    }
  });

})();
