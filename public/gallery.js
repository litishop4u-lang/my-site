(function () {
  var g = document.querySelector('[data-gallery]');
  if (!g) return;
  var area = g.querySelector('.gallery-main');
  var main = g.querySelector('[data-gallery-main]');
  if (!area || !main) return;

  function applyRatio() {
    if (!main.naturalWidth || !main.naturalHeight) return;
    var r = main.naturalWidth / main.naturalHeight;
    r = Math.min(1.4, Math.max(0.75, r));
    area.style.aspectRatio = String(r);
  }
  if (main.complete) {
    applyRatio();
  } else {
    main.addEventListener('load', applyRatio, { once: true });
  }

  var thumbs = Array.prototype.slice.call(g.querySelectorAll('[data-gallery-thumb]'));
  if (thumbs.length < 2) return;

  var index = 0;
  var seq = 0;
  var DELAY = 3500;
  var timer = null;
  var hovering = false;
  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function srcAt(i) {
    return thumbs[(i + thumbs.length) % thumbs.length].getAttribute('data-src');
  }

  function show(i) {
    index = (i + thumbs.length) % thumbs.length;
    var src = srcAt(index);
    var token = ++seq;
    thumbs.forEach(function (t, n) {
      t.classList.toggle('active', n === index);
    });
    main.classList.add('is-fading');
    setTimeout(function () {
      var pre = new Image();
      var done = function () {
        if (token !== seq) return;
        main.src = src;
        main.classList.remove('is-fading');
      };
      pre.onload = done;
      pre.onerror = done;
      pre.src = src;
    }, 180);
    new Image().src = srcAt(index + 1);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    if (reduceMotion || hovering || timer || document.hidden) return;
    timer = setInterval(function () {
      show(index + 1);
    }, DELAY);
  }

  function restart() {
    stop();
    start();
  }

  thumbs.forEach(function (t, n) {
    t.addEventListener('click', function () {
      show(n);
      restart();
    });
  });

  var prev = g.querySelector('[data-gallery-prev]');
  var next = g.querySelector('[data-gallery-next]');
  if (prev) {
    prev.addEventListener('click', function () {
      show(index - 1);
      restart();
    });
  }
  if (next) {
    next.addEventListener('click', function () {
      show(index + 1);
      restart();
    });
  }

  g.addEventListener('pointerenter', function (e) {
    if (e.pointerType === 'mouse') {
      hovering = true;
      stop();
    }
  });
  g.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') {
      hovering = false;
      start();
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  var startX = null;
  area.addEventListener(
    'touchstart',
    function (e) {
      startX = e.touches[0].clientX;
    },
    { passive: true },
  );
  area.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) {
      show(dx < 0 ? index + 1 : index - 1);
      restart();
    }
  });

  start();
})();