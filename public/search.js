(function () {
  var root = document.querySelector('[data-search]');
  if (!root) return;
  var input = root.querySelector('input[name="q"]');
  var panel = root.querySelector('[data-search-results]');
  if (!input || !panel) return;

  var timer = null;
  var controller = null;
  var active = -1;

  function fmt(n) {
    return Number(n).toLocaleString('vi-VN') + ' đ';
  }

  function close() {
    panel.hidden = true;
    active = -1;
  }

  function links() {
    return Array.prototype.slice.call(panel.querySelectorAll('.search-item'));
  }

  function setActive(i) {
    var list = links();
    if (list.length === 0) return;
    active = (i + list.length) % list.length;
    list.forEach(function (a, n) {
      a.classList.toggle('active', n === active);
    });
    list[active].scrollIntoView({ block: 'nearest' });
  }

  function render(items, q) {
    panel.textContent = '';
    active = -1;

    if (items.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.textContent = 'Không tìm thấy sản phẩm phù hợp.';
      panel.appendChild(empty);
    }

    items.forEach(function (it) {
      if (!it || !/^[a-z0-9-]+$/.test(it.slug || '')) return;

      var a = document.createElement('a');
      a.className = 'search-item';
      a.href = '/san-pham/' + it.slug + '/';

      var thumb;
      if (typeof it.image === 'string' && /^\/media\/\?k=[a-z0-9\-\/]+\.(jpg|png|webp|gif)$/.test(it.image)) {
        thumb = document.createElement('img');
        thumb.src = it.image;
        thumb.alt = '';
        thumb.loading = 'lazy';
      } else {
        thumb = document.createElement('span');
      }
      thumb.className = 'search-thumb';

      var body = document.createElement('span');
      body.className = 'search-body';

      var name = document.createElement('span');
      name.className = 'search-name';
      name.textContent = it.name;

      var price = document.createElement('span');
      price.className = 'search-price';
      price.textContent = Number(it.price) > 0 ? fmt(it.price) : 'Giá liên hệ';
      if (Number(it.price) > 0 && Number(it.old_price) > Number(it.price)) {
        var del = document.createElement('del');
        del.textContent = fmt(it.old_price);
        price.appendChild(del);
      }

      body.appendChild(name);
      body.appendChild(price);
      a.appendChild(thumb);
      a.appendChild(body);
      panel.appendChild(a);
    });

    if (items.length > 0) {
      var all = document.createElement('a');
      all.className = 'search-all';
      all.href = '/tim-kiem/?q=' + encodeURIComponent(q);
      all.textContent = 'Xem tất cả kết quả';
      panel.appendChild(all);
    }

    panel.hidden = false;
  }

  function search() {
    var q = input.value.trim();
    if (q.length < 2) {
      close();
      return;
    }
    if (controller) controller.abort();
    controller = new AbortController();

    fetch('/api/search/?q=' + encodeURIComponent(q), { signal: controller.signal })
      .then(function (res) {
        return res.ok ? res.json() : { items: [] };
      })
      .then(function (data) {
        if (input.value.trim() === q) {
          render(Array.isArray(data.items) ? data.items : [], q);
        }
      })
      .catch(function () {});
  }

  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(search, 200);
  });

  input.addEventListener('focus', function () {
    if (panel.childNodes.length > 0 && input.value.trim().length >= 2) {
      panel.hidden = false;
    }
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (panel.hidden) search();
      else setActive(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active - 1);
    } else if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter' && active >= 0) {
      var list = links();
      if (list[active]) {
        e.preventDefault();
        window.location.href = list[active].href;
      }
    }
  });

  document.addEventListener('click', function (e) {
    if (!root.contains(e.target)) close();
  });
})();