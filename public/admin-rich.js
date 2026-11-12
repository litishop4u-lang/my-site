(function () {
  var root = document.querySelector('[data-rich]');
  if (!root) return;

  var area = root.querySelector('[data-rich-area]');
  var toolbar = root.querySelector('[data-rich-toolbar]');
  var mediaBar = root.querySelector('[data-rich-media-bar]');
  var hidden = root.querySelector('[data-rich-input]');
  var videoFile = root.querySelector('[data-rich-video-file]');
  var statusEl = root.querySelector('[data-rich-status]');
  var dataEl = root.querySelector('[data-rich-data]');
  var form = root.closest('form');
  var savedRange = null;
  var selectedFig = null;
  var busy = 0;

  function q(selector) {
    return root.querySelector(selector);
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  var initial = '';
  try {
    initial = JSON.parse(dataEl.textContent || '""');
  } catch (e) {
    initial = '';
  }
  if (typeof initial !== 'string') initial = '';
  area.innerHTML = initial.trim() ? initial : '<p><br></p>';
  try {
    document.execCommand('defaultParagraphSeparator', false, 'p');
  } catch (e) {}

  function ytId(input) {
    var value = String(input).trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
    try {
      var url = new URL(value);
      var host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
      var id = null;
      if (host === 'youtu.be') {
        id = url.pathname.slice(1).split('/')[0];
      } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (url.pathname === '/watch') {
          id = url.searchParams.get('v');
        } else {
          var m = url.pathname.match(/^\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
          if (m) id = m[2];
        }
      }
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    } catch (e) {
      return null;
    }
  }

  function prepareMedia() {
    area.querySelectorAll('figure').forEach(function (fig) {
      fig.setAttribute('contenteditable', 'false');
      var yt = fig.getAttribute('data-yt');
      if (yt && !fig.querySelector('img')) {
        var img = document.createElement('img');
        img.src = 'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg';
        img.alt = 'Video YouTube';
        fig.appendChild(img);
      }
      if (!fig.getAttribute('data-size')) fig.setAttribute('data-size', 'l');
    });
  }

  function saveRange() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      var r = sel.getRangeAt(0);
      if (area.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
    }
  }

  function restoreRange() {
    area.focus();
    var sel = window.getSelection();
    sel.removeAllRanges();
    if (savedRange) {
      sel.addRange(savedRange);
    } else {
      var r = document.createRange();
      r.selectNodeContents(area);
      r.collapse(false);
      sel.addRange(r);
    }
  }

  document.addEventListener('selectionchange', saveRange);

  function exec(cmd, value) {
    restoreRange();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, value == null ? null : value);
    saveRange();
  }

  function insertHtml(html) {
    restoreRange();
    document.execCommand('insertHTML', false, html);
    prepareMedia();
    saveRange();
  }

  function applySize(px) {
    restoreRange();
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      alert('Hãy bôi đen đoạn chữ cần đổi cỡ trước.');
      return;
    }
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontSize', false, '7');
    area.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach(function (el) {
      var target = el;
      if (el.tagName === 'FONT') {
        target = document.createElement('span');
        while (el.firstChild) target.appendChild(el.firstChild);
        el.replaceWith(target);
      }
      target.style.fontSize = px + 'px';
      target.querySelectorAll('[style*="font-size"]').forEach(function (c) {
        c.style.removeProperty('font-size');
      });
    });
    saveRange();
  }

  toolbar.querySelectorAll('button').forEach(function (btn) {
    btn.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });
  });
  mediaBar.querySelectorAll('button').forEach(function (btn) {
    btn.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });
  });

  toolbar.querySelectorAll('[data-cmd]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      exec(btn.getAttribute('data-cmd'));
    });
  });

  var blockSel = q('[data-rich-block]');
  blockSel.addEventListener('change', function () {
    if (blockSel.value) exec('formatBlock', blockSel.value);
    blockSel.value = '';
  });

  var fontSel = q('[data-rich-font]');
  fontSel.addEventListener('change', function () {
    if (fontSel.value) exec('fontName', fontSel.value);
    fontSel.value = '';
  });

  var sizeSel = q('[data-rich-size]');
  sizeSel.addEventListener('change', function () {
    if (sizeSel.value) applySize(Number(sizeSel.value));
    sizeSel.value = '';
  });

  var colorInput = q('[data-rich-color]');
  colorInput.addEventListener('change', function () {
    exec('foreColor', colorInput.value);
  });

  q('[data-rich-link]').addEventListener('click', function () {
    var url = window.prompt('Dán đường dẫn liên kết (ví dụ: https://...):');
    if (!url) return;
    url = url.trim();
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) url = 'https://' + url;
    restoreRange();
    var sel = window.getSelection();
    if (sel.isCollapsed) {
      var a = document.createElement('a');
      a.setAttribute('href', url);
      a.textContent = url;
      document.execCommand('insertHTML', false, a.outerHTML);
    } else {
      document.execCommand('createLink', false, url);
    }
    saveRange();
  });

  q('[data-rich-img]').addEventListener('click', function () {
    saveRange();
    if (!window.MediaPicker) {
      alert('Thư viện ảnh chưa sẵn sàng, vui lòng tải lại trang.');
      return;
    }
    window.MediaPicker.open({
      multiple: true,
      maxSize: 1600,
      onSelect: function (urls) {
        urls.forEach(function (url) {
          insertHtml('<figure data-size="l"><img src="' + url + '" alt=""></figure><p><br></p>');
        });
      },
    });
  });

  q('[data-rich-yt]').addEventListener('click', function () {
    var input = window.prompt('Dán đường dẫn video YouTube (ví dụ: https://www.youtube.com/watch?v=...):');
    if (!input) return;
    var id = ytId(input);
    if (!id) {
      alert('Đường dẫn YouTube không hợp lệ.');
      return;
    }
    insertHtml('<figure data-size="l" data-yt="' + id + '"></figure><p><br></p>');
  });

  q('[data-rich-video]').addEventListener('click', function () {
    saveRange();
    videoFile.click();
  });

  videoFile.addEventListener('change', async function () {
    var file = videoFile.files && videoFile.files[0];
    videoFile.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert('Video quá lớn (tối đa 50 MB). Video dài hơn hãy đăng YouTube rồi dán link.');
      return;
    }
    busy++;
    setStatus('Đang tải video lên, có thể mất vài phút...');
    try {
      var res = await fetch('/api/admin/upload-video/', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      var result = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(result.error || 'Tải video thất bại.');
      insertHtml('<figure data-size="l"><video src="' + result.url + '" controls></video></figure><p><br></p>');
      setStatus('Đã tải video xong. Nhớ bấm Lưu bên dưới.');
    } catch (err) {
      setStatus('Lỗi: ' + (err && err.message ? err.message : 'không tải được video.'));
    } finally {
      busy--;
    }
  });

  function selectFigure(fig) {
    area.querySelectorAll('figure.selected').forEach(function (f) {
      if (f !== fig) f.classList.remove('selected');
    });
    selectedFig = fig;
    if (fig) {
      fig.classList.add('selected');
      mediaBar.hidden = false;
    } else {
      mediaBar.hidden = true;
    }
  }

  area.addEventListener('click', function (e) {
    var fig = e.target.closest ? e.target.closest('figure') : null;
    selectFigure(fig && area.contains(fig) ? fig : null);
  });

  mediaBar.querySelectorAll('[data-size]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (selectedFig) selectedFig.setAttribute('data-size', btn.getAttribute('data-size'));
    });
  });

  function removeSelected() {
    if (!selectedFig) return;
    selectedFig.remove();
    selectFigure(null);
    if (!area.querySelector('p, h2, h3, h4, blockquote, ul, ol, figure')) {
      area.innerHTML = '<p><br></p>';
    }
  }

  q('[data-rich-media-del]').addEventListener('click', removeSelected);

  area.addEventListener('keydown', function (e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFig) {
      e.preventDefault();
      removeSelected();
    }
  });

  area.addEventListener('dragover', function (e) {
    if (e.dataTransfer && e.dataTransfer.types && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) {
      e.preventDefault();
    }
  });
  area.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      e.preventDefault();
    }
  });

  prepareMedia();

  if (form) {
    form.addEventListener('submit', function (e) {
      if (busy > 0) {
        e.preventDefault();
        alert('Đang tải video lên, vui lòng đợi xong rồi bấm Lưu.');
        return;
      }
      area.querySelectorAll('figure.selected').forEach(function (f) {
        f.classList.remove('selected');
      });
      hidden.value = area.innerHTML;
    });
  }
})();