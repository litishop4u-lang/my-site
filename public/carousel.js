(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DELAY = 3500;

  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var track = root.querySelector('[data-pc-track]');
    var prev = root.querySelector('[data-pc-prev]');
    var next = root.querySelector('[data-pc-next]');
    if (!track) return;

    var paused = false;
    var timer = null;
    var resumeTimer = null;

    function hasOverflow() {
      return track.scrollWidth - track.clientWidth > 4;
    }

    function stepWidth() {
      var item = track.querySelector('.pc-item');
      if (!item) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return item.getBoundingClientRect().width + gap;
    }

    function atEnd() {
      return track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    }

    function go(dir) {
      if (dir > 0) {
        if (atEnd()) track.scrollTo({ left: 0, behavior: 'smooth' });
        else track.scrollBy({ left: stepWidth(), behavior: 'smooth' });
      } else {
        if (track.scrollLeft <= 4) track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
        else track.scrollBy({ left: -stepWidth(), behavior: 'smooth' });
      }
    }

    function start() {
      if (reduce || timer) return;
      timer = setInterval(function () {
        if (!paused && !document.hidden) go(1);
      }, DELAY);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function refresh() {
      var over = hasOverflow();
      if (prev) prev.hidden = !over;
      if (next) next.hidden = !over;
      if (over) start();
      else stop();
    }

    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });

    root.addEventListener('mouseenter', function () { paused = true; });
    root.addEventListener('mouseleave', function () { paused = false; });
    root.addEventListener('focusin', function () { paused = true; });
    root.addEventListener('focusout', function () { paused = false; });
    root.addEventListener('touchstart', function () {
      paused = true;
      clearTimeout(resumeTimer);
    }, { passive: true });
    root.addEventListener('touchend', function () {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () { paused = false; }, 5000);
    }, { passive: true });

    window.addEventListener('resize', refresh);
    refresh();
  });
})();