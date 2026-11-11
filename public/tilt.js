(function () {
  if (!window.matchMedia) return;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  document.querySelectorAll('.product-img').forEach(function (el) {
    var raf = null;

    el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        el.style.transform =
          'perspective(800px) translateY(-6px) rotateX(' +
          (-y * 8).toFixed(2) +
          'deg) rotateY(' +
          (x * 10).toFixed(2) +
          'deg)';
      });
    });

    el.addEventListener('pointerleave', function () {
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = '';
    });
  });
})();