(function () {
  var submitBtn = document.getElementById('submit-btn');

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

  document.querySelectorAll('[data-image-field]').forEach(function (box) {
    var fileInput = box.querySelector('[data-file]');
    var hidden = box.querySelector('[data-value]');
    var preview = box.querySelector('[data-preview]');
    var statusEl = box.querySelector('[data-status]');
    var removeBtn = box.querySelector('[data-remove]');
    var pickBtn = box.querySelector('[data-pick]');
    var maxSize = Number(box.getAttribute('data-max')) || 1600;

    function showImage(url) {
      hidden.value = url || '';
      if (url) {
        preview.src = url;
        preview.hidden = false;
        removeBtn.hidden = false;
      } else {
        preview.removeAttribute('src');
        preview.hidden = true;
        removeBtn.hidden = true;
      }
    }

    fileInput.addEventListener('change', async function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      statusEl.textContent = 'Đang tải ảnh lên...';
      if (submitBtn) submitBtn.disabled = true;
      try {
        var small = await compress(file, maxSize);
        var data = new FormData();
        data.append('file', small);
        var res = await fetch('/api/admin/upload/', { method: 'POST', body: data });
        var result = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) throw new Error(result.error || 'Tải ảnh thất bại.');
        showImage(result.url);
        statusEl.textContent = 'Đã tải ảnh lên. Nhớ bấm Lưu bên dưới.';
      } catch (err) {
        statusEl.textContent = 'Lỗi: ' + (err && err.message ? err.message : 'không tải được ảnh.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        fileInput.value = '';
      }
    });

    removeBtn.addEventListener('click', function () {
      showImage('');
      statusEl.textContent = '';
    });

    if (pickBtn) {
      pickBtn.addEventListener('click', function () {
        window.MediaPicker.open({
          multiple: false,
          maxSize: maxSize,
          onSelect: function (urls) {
            if (urls[0]) {
              showImage(urls[0]);
              statusEl.textContent = 'Đã chọn ảnh từ thư viện. Nhớ bấm Lưu bên dưới.';
            }
          },
        });
      });
    }
  });
})();