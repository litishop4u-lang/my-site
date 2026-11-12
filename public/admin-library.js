(function () {
  var fileInput = document.getElementById('lib-file');
  var statusEl = document.getElementById('lib-status');

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

  if (fileInput) {
    fileInput.addEventListener('change', async function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      fileInput.value = '';
      if (files.length === 0) return;

      var done = 0;
      var failed = 0;
      var lastError = '';
      for (var i = 0; i < files.length; i++) {
        statusEl.textContent = 'Đang tải ảnh ' + (i + 1) + '/' + files.length + '...';
        try {
          var small = await compress(files[i], 2000);
          var data = new FormData();
          data.append('file', small);
          var res = await fetch('/api/admin/upload/', { method: 'POST', body: data });
          var result = await res.json().catch(function () {
            return {};
          });
          if (!res.ok) throw new Error(result.error || 'Tải ảnh thất bại.');
          done++;
        } catch (err) {
          failed++;
          lastError = err && err.message ? err.message : 'không tải được';
        }
      }

      if (failed === 0) {
        window.location.href = '/admin/thu-vien/?msg=uploaded';
      } else {
        statusEl.textContent = 'Đã tải ' + done + ' ảnh, lỗi ' + failed + ': ' + lastError;
      }
    });
  }

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var full = window.location.origin + btn.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(full).then(function () {
          var old = btn.textContent;
          btn.textContent = 'Đã sao chép';
          setTimeout(function () {
            btn.textContent = old;
          }, 1500);
        });
      } else {
        window.prompt('Sao chép đường dẫn ảnh:', full);
      }
    });
  });
})();