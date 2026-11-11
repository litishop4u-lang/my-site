(function () {
  var root = document.querySelector('[data-banner]');
  if (!root) return;

  var slides = Array.prototype.slice.call(root.querySelectorAll('[data-slide]'));
  if (slides.length < 2) return;
  var dots = Array.prototype.slice.call(root.querySelectorAll('[data-dot]'));
  var delay = Number(root.getAttribute('data-interval')) || 5000;
  var index = 0;
  var timer = null;
  var hovering = false;
  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function show(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach(function (s, n) {
      s.classList.toggle('active', n === index);
      s.setAttribute('aria-hidden', n === index ? 'false' : 'true');
    });
    dots.forEach(function (d, n) {
      d.classList.toggle('active', n === index);
    });
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
    }, delay);
  }

  function restart() {
    stop();
    start();
  }

  var prev = root.querySelector('[data-prev]');
  var next = root.querySelector('[data-next]');
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
  dots.forEach(function (d, n) {
    d.addEventListener('click', function () {
      show(n);
      restart();
    });
  });

  root.addEventListener('pointerenter', function (e) {
    if (e.pointerType === 'mouse') {
      hovering = true;
      stop();
    }
  });
  root.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') {
      hovering = false;
      start();
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  var startX = null;
  root.addEventListener(
    'touchstart',
    function (e) {
      startX = e.touches[0].clientX;
    },
    { passive: true },
  );
  root.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) {
      show(dx < 0 ? index + 1 : index - 1);
      restart();
    }
  });

  slides.forEach(function (s, n) {
    s.setAttribute('aria-hidden', n === 0 ? 'false' : 'true');
  });
  start();
})();