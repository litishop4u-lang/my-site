(function () {
  function h(tag, props) {
    var node = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      if (value === false || value == null) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : String(value));
    });
    for (var i = 2; i < arguments.length; i++) {
      if (arguments[i]) node.append(arguments[i]);
    }
    return node;
  }

  async function compress(file, maxSize) {
    if (file.type === 'image/gif') return file;
    try {
      var bitmap = await createImageBitmap(file);
      var scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
      var w = Math.round(bitmap.width * scale);
      var hgt = Math.round(bitmap.height * scale);
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = hgt;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, hgt);
      var blob = await new Promise(function (resolve) {
        canvas.toBlob(resolve, 'image/webp', 0.85);
      });
      if (!blob) return file;
      return new File([blob], 'image.webp', { type: 'image/webp' });
    } catch (e) {
      return file;
    }
  }

  async function fetchLibrary() {
    var res = await fetch('/api/admin/media/', { cache: 'no-store' });
    if (!res.ok) throw new Error('Không tải được thư viện ảnh.');
    var data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  }

  function open(opts) {
    opts = opts || {};
    var multiple = !!opts.multiple;
    var maxSize = opts.maxSize || 1600;
    var selected = [];
    var items = [];
    var uploading = false;

    var grid = h('div', { class: 'mp-grid' });
    var statusEl = h('span', { class: 'mp-status', text: 'Đang tải thư viện ảnh...' });
    var countEl = h('span', { class: 'mp-count' });
    var okBtn = h('button', {
      type: 'button',
      class: 'adm-btn',
      text: multiple ? 'Chèn ảnh đã chọn' : 'Chọn ảnh này',
    });
    var cancelBtn = h('button', { type: 'button', class: 'adm-icon-btn', text: 'Huỷ' });
    var closeBtn = h('button', { type: 'button', class: 'mp-close', title: 'Đóng', text: '✕' });
    var uploadBtn = h('button', { type: 'button', class: 'adm-icon-btn', text: '+ Tải ảnh mới từ máy' });
    var fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });

    var dialog = h(
      'div',
      { class: 'mp-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Thư viện ảnh' },
      h('div', { class: 'mp-head' }, h('h3', { text: 'Thư viện ảnh' }), closeBtn),
      h(
        'div',
        { class: 'mp-bar' },
        uploadBtn,
        statusEl,
        fileInput,
      ),
      grid,
      h('div', { class: 'mp-foot' }, countEl, h('div', { class: 'mp-foot-btns' }, cancelBtn, okBtn)),
    );
    var overlay = h('div', { class: 'mp-overlay' }, dialog);

    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    function close() {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function confirm() {
      if (selected.length === 0) return;
      var urls = selected.slice();
      close();
      if (opts.onSelect) opts.onSelect(urls);
    }

    function toggle(url) {
      var idx = selected.indexOf(url);
      if (multiple) {
        if (idx >= 0) selected.splice(idx, 1);
        else selected.push(url);
      } else {
        selected = idx >= 0 ? [] : [url];
      }
      renderGrid();
    }

    function renderGrid() {
      grid.textContent = '';
      if (items.length === 0) {
        grid.append(
          h('p', { class: 'mp-empty', text: 'Thư viện chưa có ảnh nào. Bấm "+ Tải ảnh mới từ máy".' }),
        );
      }
      items.forEach(function (it) {
        var idx = selected.indexOf(it.url);
        grid.append(
          h(
            'button',
            {
              type: 'button',
              class: 'mp-tile' + (idx >= 0 ? ' selected' : ''),
              title: 'Bấm để chọn',
              onclick: function () {
                toggle(it.url);
              },
              ondblclick: multiple
                ? null
                : function () {
                    selected = [it.url];
                    confirm();
                  },
            },
            h('img', { src: it.url, alt: '', loading: 'lazy', decoding: 'async' }),
            idx >= 0 ? h('span', { class: 'mp-badge', text: multiple ? String(idx + 1) : '✓' }) : null,
          ),
        );
      });
      countEl.textContent = selected.length ? 'Đã chọn ' + selected.length + ' ảnh' : 'Chưa chọn ảnh';
      okBtn.disabled = selected.length === 0 || uploading;
    }

    async function uploadFiles(files) {
      uploading = true;
      okBtn.disabled = true;
      var done = 0;
      var failed = 0;
      var lastError = '';
      for (var i = 0; i < files.length; i++) {
        statusEl.textContent = 'Đang tải ảnh ' + (i + 1) + '/' + files.length + '...';
        try {
          var small = await compress(files[i], maxSize);
          var data = new FormData();
          data.append('file', small);
          var res = await fetch('/api/admin/upload/', { method: 'POST', body: data });
          var result = await res.json().catch(function () {
            return {};
          });
          if (!res.ok) throw new Error(result.error || 'Tải ảnh thất bại.');
          var url = result.url;
          if (
            !items.some(function (it) {
              return it.url === url;
            })
          ) {
            items.unshift({ url: url });
          }
          if (multiple) {
            if (selected.indexOf(url) < 0) selected.push(url);
          } else {
            selected = [url];
          }
          done++;
        } catch (err) {
          failed++;
          lastError = err && err.message ? err.message : 'không tải được';
        }
      }
      uploading = false;
      statusEl.textContent = failed
        ? 'Đã tải ' + done + ' ảnh, lỗi ' + failed + ': ' + lastError
        : 'Đã tải xong ' + done + ' ảnh. Ảnh trùng với ảnh cũ sẽ tự dùng lại, không lưu thêm.';
      renderGrid();
    }

    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    okBtn.addEventListener('click', confirm);
    uploadBtn.addEventListener('click', function () {
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      fileInput.value = '';
      if (files.length) uploadFiles(files);
    });
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
    renderGrid();

    fetchLibrary()
      .then(function (list) {
        items = list;
        statusEl.textContent = list.length + ' ảnh trong thư viện (mới nhất ở trên cùng)';
        renderGrid();
      })
      .catch(function (err) {
        statusEl.textContent = err && err.message ? err.message : 'Không tải được thư viện ảnh.';
      });
  }

  window.MediaPicker = { open: open };
})();