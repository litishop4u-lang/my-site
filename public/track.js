(function () {
  try {
    var path = location.pathname;

    function send(type) {
      fetch('/api/hit/', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: type, p: path, r: document.referrer || '' }),
      }).catch(function () {});
    }

    // Lượt xem: mỗi trang chỉ tính 1 lần / 30 phút trong cùng một trình duyệt
    var key = 'hit:' + path;
    var now = Date.now();
    var last = 0;
    try {
      last = Number(sessionStorage.getItem(key) || 0);
    } catch (e) {}
    if (!last || now - last > 30 * 60 * 1000) {
      try {
        sessionStorage.setItem(key, String(now));
      } catch (e) {}
      send('view');
    }

    // Lượt bấm Gọi / Zalo / Messenger
    document.addEventListener(
      'click',
      function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        var h = a.getAttribute('href') || '';
        if (h.indexOf('tel:') === 0) send('call');
        else if (h.indexOf('zalo.me') > -1) send('zalo');
        else if (h.indexOf('m.me') > -1 || h.indexOf('messenger.com') > -1) send('messenger');
      },
      true,
    );
  } catch (e) {}
})();