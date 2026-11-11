(function () {
  var KEY = 'viewed_products_v1';
  var box = document.querySelector('[data-viewed]');
  var listEl = document.querySelector('[data-viewed-list]');
  var dataEl = document.getElementById('current-product');
  if (!box || !listEl || !dataEl) return;

  var current = null;
  try {
    current = JSON.parse(dataEl.textContent || 'null');
  } catch (e) {
    current = null;
  }
  if (!current || !/^[a-z0-9-]+$/.test(current.slug || '')) return;

  var list = [];
  try {
    list = JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch (e) {
    list = [];
  }
  if (!Array.isArray(list)) list = [];

  function valid(p) {
    return p && typeof p.slug === 'string' && /^[a-z0-9-]+$/.test(p.slug) && typeof p.name === 'string';
  }

  function fmt(n) {
    return Number(n).toLocaleString('vi-VN') + ' đ';
  }

  var others = list
    .filter(function (p) {
      return valid(p) && p.slug !== current.slug;
    })
    .slice(0, 3);

  others.forEach(function (p) {
    var href = '/san-pham/' + p.slug + '/';
    var li = document.createElement('li');
    li.className = 'side-item';

    var thumb = document.createElement('a');
    thumb.className = 'side-thumb';
    thumb.href = href;
    if (typeof p.image === 'string' && /^\/media\/\?k=[a-z0-9\-\/]+\.(jpg|png|webp|gif)$/.test(p.image)) {
      var img = document.createElement('img');
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      thumb.appendChild(img);
    }

    var body = document.createElement('div');
    body.className = 'side-body';

    var name = document.createElement('a');
    name.className = 'side-name';
    name.href = href;
    name.textContent = p.name;

    var price = document.createElement('div');
    price.className = 'side-price';
    price.textContent = Number(p.price) > 0 ? fmt(p.price) : 'Giá liên hệ';
    if (Number(p.old_price) > Number(p.price) && Number(p.price) > 0) {
      var del = document.createElement('del');
      del.textContent = fmt(p.old_price);
      price.appendChild(del);
    }

    body.appendChild(name);
    body.appendChild(price);
    li.appendChild(thumb);
    li.appendChild(body);
    listEl.appendChild(li);
  });

  if (others.length > 0) box.hidden = false;

  var next = [current]
    .concat(
      list.filter(function (p) {
        return valid(p) && p.slug !== current.slug;
      }),
    )
    .slice(0, 12);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {}
})();