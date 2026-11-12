(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-store]'));
  var frame = document.querySelector('[data-sr-map]');

  function select(card) {
    if (!card) return;
    cards.forEach(function (c) {
      c.classList.toggle('active', c === card);
    });
    var src = card.getAttribute('data-map');
    if (frame && src && frame.getAttribute('src') !== src) {
      frame.setAttribute('src', src);
    }
  }

  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      select(card);
    });
    var title = card.querySelector('[data-select]');
    if (title) {
      title.addEventListener('click', function (e) {
        e.stopPropagation();
        select(card);
      });
    }
  });

  document.querySelectorAll('[data-photo]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var url = btn.getAttribute('data-photo');
      if (!url) return;

      var overlay = document.createElement('div');
      overlay.className = 'lb';
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'lb-close';
      close.textContent = '✕';
      close.setAttribute('aria-label', 'Đóng');

      function onKey(ev) {
        if (ev.key === 'Escape') shut();
      }
      function shut() {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
      }

      overlay.addEventListener('click', function (ev) {
        if (ev.target !== img) shut();
      });
      close.addEventListener('click', shut);
      document.addEventListener('keydown', onKey);
      overlay.appendChild(img);
      overlay.appendChild(close);
      document.body.appendChild(overlay);
    });
  });
})();