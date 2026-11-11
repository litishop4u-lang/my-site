(function () {
  var form = document.getElementById('banner-add');
  if (!form) return;

  var fileInput = document.getElementById('bn-file');
  var pickBtn = document.getElementById('bn-pick');
  var preview = document.getElementById('bn-preview');
  var hiddenBox = document.getElementById('bn-hidden');
  var statusEl = document.getElementById('bn-status');
  var submitBtn = document.getElementById('bn-submit');
  var urls = [];
  var busy = 0;

  function render() {
    preview.textContent = '';
    hiddenBox.textContent = '';
    urls.forEach(function (url, i) {
      var chip = document.createElement('div');
      chip.className = 'bn-chip';
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '✕';
      rm.title = 'Bỏ ảnh này';
      rm.addEventListener('click', function () {
        urls.splice(i, 1);
        render();
      });
      chip.appendChild(img);
      chip.appendChild(rm);
      preview.appendChild(chip);

      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'image';
      input.value = url;
      hiddenBox.appendChild(input);
    });
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

  fileInput.addEventListener('change', async function () {
    var files = Array.prototype.slice.call(fileInput.files || []);
    fileInput.value = '';
    if (files.length === 0) return;

    busy++;
    submitBtn.disabled = true;
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
        if (urls.indexOf(result.url) < 0) urls.push(result.url);
        done++;
      } catch (err) {
        failed++;
        lastError = err && err.message ? err.message : 'không tải được';
      }
    }
    statusEl.textContent = failed
      ? 'Đã tải ' + done + ' ảnh, lỗi ' + failed + ': ' + lastError
      : 'Đã tải xong ' + done + ' ảnh. Bấm "+ Thêm banner" để lưu.';
    render();
    busy--;
    if (busy === 0) submitBtn.disabled = false;
  });

  pickBtn.addEventListener('click', function () {
    window.MediaPicker.open({
      multiple: true,
      maxSize: 2000,
      onSelect: function (selected) {
        selected.forEach(function (url) {
          if (urls.indexOf(url) < 0) urls.push(url);
        });
        statusEl.textContent = 'Đã chọn ' + urls.length + ' ảnh. Bấm "+ Thêm banner" để lưu.';
        render();
      },
    });
  });

  form.addEventListener('submit', function (e) {
    if (busy > 0) {
      e.preventDefault();
      alert('Đang tải ảnh lên, vui lòng đợi xong rồi bấm Thêm banner.');
      return;
    }
    if (urls.length === 0) {
      e.preventDefault();
      alert('Vui lòng chọn hoặc tải lên ít nhất một ảnh banner.');
    }
  });

  render();
})();