(() => {
  const dataEl = document.getElementById('pf-data');
  let initial = {};
  try {
    initial = JSON.parse(dataEl.textContent || '{}');
  } catch (e) {
    initial = {};
  }

  const state = {
    images: Array.isArray(initial.images) ? [...initial.images] : [],
    specs: (Array.isArray(initial.specs) ? initial.specs : []).map((s) => ({
      label: s.label || '',
      value: s.value || '',
    })),
  };

  const MAX_IMAGES = 20;
  const form = document.getElementById('product-form');
  const submitBtn = document.getElementById('submit-btn');
  const statusEl = document.getElementById('pf-status');
  const galleryEl = document.getElementById('pf-gallery');
  const specsEl = document.getElementById('pf-specs');
  let busy = 0;

  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    for (const key in props || {}) {
      const value = props[key];
      if (value === false || value == null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const kid of kids) {
      if (kid) node.append(kid);
    }
    return node;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  async function withBusy(fn) {
    busy++;
    submitBtn.disabled = true;
    try {
      return await fn();
    } finally {
      busy--;
      if (busy === 0) submitBtn.disabled = false;
    }
  }

  function swap(list, i, j) {
    if (j < 0 || j >= list.length) return;
    const t = list[i];
    list[i] = list[j];
    list[j] = t;
  }

  function ytId(input) {
    const value = String(input).trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
      let id = null;
      if (host === 'youtu.be') {
        id = url.pathname.slice(1).split('/')[0];
      } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (url.pathname === '/watch') {
          id = url.searchParams.get('v');
        } else {
          const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
          if (m) id = m[2];
        }
      }
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    } catch (e) {
      return null;
    }
  }

  async function compress(file, maxSize) {
    if (file.type === 'image/gif') return file;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const hgt = Math.round(bitmap.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = hgt;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, hgt);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
      if (!blob) return file;
      return new File([blob], 'image.webp', { type: 'image/webp' });
    } catch (e) {
      return file;
    }
  }

  async function uploadImage(file) {
    const small = await compress(file, 1600);
    const data = new FormData();
    data.append('file', small);
    const res = await fetch('/api/admin/upload/', { method: 'POST', body: data });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Tải ảnh thất bại.');
    return result.url;
  }

  async function uploadVideo(file) {
    if (file.size > 50 * 1024 * 1024) throw new Error('Video quá lớn (tối đa 50 MB).');
    const res = await fetch('/api/admin/upload-video/', {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Tải video thất bại.');
    return result.url;
  }

  async function uploadMany(files, onUrl) {
    await withBusy(async () => {
      let done = 0;
      let failed = 0;
      let lastError = '';
      for (const file of files) {
        setStatus('Đang tải ảnh ' + (done + failed + 1) + '/' + files.length + '...');
        try {
          await onUrl(await uploadImage(file));
          done++;
        } catch (err) {
          failed++;
          lastError = err && err.message ? err.message : 'không tải được';
        }
      }
      setStatus(
        failed
          ? 'Đã tải ' + done + ' ảnh, lỗi ' + failed + ': ' + lastError
          : 'Đã tải xong ' + done + ' ảnh. Nhớ bấm Lưu bên dưới.',
      );
    });
  }

  /* ===== Thư viện ảnh sản phẩm ===== */
  function renderGallery() {
    galleryEl.textContent = '';
    if (state.images.length === 0) {
      galleryEl.append(h('p', { class: 'adm-hint', text: 'Chưa có ảnh nào.' }));
      return;
    }
    state.images.forEach((url, i) => {
      galleryEl.append(
        h(
          'div',
          { class: 'pf-thumb' },
          h('img', { src: url, alt: '' }),
          i === 0 ? h('span', { class: 'pf-badge', text: 'Ảnh đại diện' }) : null,
          h(
            'div',
            { class: 'pf-thumb-actions' },
            h('button', {
              type: 'button',
              title: 'Chuyển sang trái',
              disabled: i === 0,
              text: '‹',
              onclick: () => {
                swap(state.images, i, i - 1);
                renderGallery();
              },
            }),
            h('button', {
              type: 'button',
              title: 'Chuyển sang phải',
              disabled: i === state.images.length - 1,
              text: '›',
              onclick: () => {
                swap(state.images, i, i + 1);
                renderGallery();
              },
            }),
            h('button', {
              type: 'button',
              class: 'danger',
              title: 'Xoá ảnh',
              text: '✕',
              onclick: () => {
                state.images.splice(i, 1);
                renderGallery();
              },
            }),
          ),
        ),
      );
    });
  }

  document.getElementById('pf-image-files').addEventListener('change', async (e) => {
    const room = Math.max(0, MAX_IMAGES - state.images.length);
    const files = Array.from(e.target.files || []).slice(0, room);
    e.target.value = '';
    if (files.length === 0) {
      setStatus('Đã đủ ' + MAX_IMAGES + ' ảnh.');
      return;
    }
    await uploadMany(files, (url) => {
      state.images.push(url);
      renderGallery();
    });
  });

  /* ===== Thông số kỹ thuật ===== */
  function renderSpecs() {
    specsEl.textContent = '';
    state.specs.forEach((row, i) => {
      specsEl.append(
        h(
          'div',
          { class: 'pf-spec-row' },
          h('input', {
            type: 'text',
            placeholder: 'Tên thông số (vd: Tốc độ)',
            value: row.label,
            oninput: (e) => {
              row.label = e.target.value;
            },
          }),
          h('input', {
            type: 'text',
            placeholder: 'Giá trị (vd: 25km/h)',
            value: row.value,
            oninput: (e) => {
              row.value = e.target.value;
            },
          }),
          h('button', {
            type: 'button',
            class: 'adm-icon-btn danger',
            title: 'Xoá dòng',
            text: '✕',
            onclick: () => {
              state.specs.splice(i, 1);
              renderSpecs();
            },
          }),
        ),
      );
    });
  }

  document.getElementById('pf-add-spec').addEventListener('click', () => {
    state.specs.push({ label: '', value: '' });
    renderSpecs();
  });

  /* ===== Trình soạn mô tả ===== */
  const area = document.getElementById('ed-area');
  const toolbar = document.getElementById('ed-toolbar');
  const mediaBar = document.getElementById('ed-media-bar');
  const edImages = document.getElementById('ed-file-images');
  const edVideo = document.getElementById('ed-file-video');
  let savedRange = null;
  let selectedFig = null;

  area.innerHTML = initial.html && initial.html.trim() ? initial.html : '<p><br></p>';
  try {
    document.execCommand('defaultParagraphSeparator', false, 'p');
  } catch (e) {}

  function prepareMedia() {
    area.querySelectorAll('figure').forEach((fig) => {
      fig.setAttribute('contenteditable', 'false');
      const yt = fig.getAttribute('data-yt');
      if (yt && !fig.querySelector('img')) {
        const img = document.createElement('img');
        img.src = 'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg';
        img.alt = 'Video YouTube';
        fig.appendChild(img);
      }
      if (!fig.getAttribute('data-size')) fig.setAttribute('data-size', 'l');
    });
  }

  function saveRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (area.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
    }
  }

  function restoreRange() {
    area.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    if (savedRange) {
      sel.addRange(savedRange);
    } else {
      const r = document.createRange();
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
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      alert('Hãy bôi đen đoạn chữ cần đổi cỡ trước.');
      return;
    }
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontSize', false, '7');
    area.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach((el) => {
      let target = el;
      if (el.tagName === 'FONT') {
        target = document.createElement('span');
        while (el.firstChild) target.appendChild(el.firstChild);
        el.replaceWith(target);
      }
      target.style.fontSize = px + 'px';
      target.querySelectorAll('[style*="font-size"]').forEach((c) => c.style.removeProperty('font-size'));
    });
    saveRange();
  }

  toolbar.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
  });
  mediaBar.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
  });

  toolbar.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => exec(btn.getAttribute('data-cmd')));
  });

  const blockSel = document.getElementById('ed-block');
  blockSel.addEventListener('change', () => {
    if (blockSel.value) exec('formatBlock', blockSel.value);
    blockSel.value = '';
  });

  const fontSel = document.getElementById('ed-font');
  fontSel.addEventListener('change', () => {
    if (fontSel.value) exec('fontName', fontSel.value);
    fontSel.value = '';
  });

  const sizeSel = document.getElementById('ed-size');
  sizeSel.addEventListener('change', () => {
    if (sizeSel.value) applySize(Number(sizeSel.value));
    sizeSel.value = '';
  });

  const colorInput = document.getElementById('ed-color');
  colorInput.addEventListener('change', () => exec('foreColor', colorInput.value));

  document.getElementById('ed-link').addEventListener('click', () => {
    let url = window.prompt('Dán đường dẫn liên kết (ví dụ: https://...):');
    if (!url) return;
    url = url.trim();
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) url = 'https://' + url;
    restoreRange();
    const sel = window.getSelection();
    if (sel.isCollapsed) {
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.textContent = url;
      document.execCommand('insertHTML', false, a.outerHTML);
    } else {
      document.execCommand('createLink', false, url);
    }
    saveRange();
  });

  document.getElementById('ed-img').addEventListener('click', () => edImages.click());
  document.getElementById('ed-video').addEventListener('click', () => edVideo.click());

  document.getElementById('ed-yt').addEventListener('click', () => {
    const input = window.prompt('Dán đường dẫn video YouTube (ví dụ: https://www.youtube.com/watch?v=...):');
    if (!input) return;
    const id = ytId(input);
    if (!id) {
      alert('Đường dẫn YouTube không hợp lệ.');
      return;
    }
    insertHtml('<figure data-size="l" data-yt="' + id + '"></figure><p><br></p>');
  });

  edImages.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    await uploadMany(files, (url) => {
      insertHtml('<figure data-size="l"><img src="' + url + '" alt=""></figure><p><br></p>');
    });
  });

  edVideo.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    await withBusy(async () => {
      setStatus('Đang tải video lên, có thể mất vài phút...');
      try {
        const url = await uploadVideo(file);
        insertHtml('<figure data-size="l"><video src="' + url + '" controls></video></figure><p><br></p>');
        setStatus('Đã tải video xong. Nhớ bấm Lưu bên dưới.');
      } catch (err) {
        setStatus('Lỗi: ' + (err && err.message ? err.message : 'không tải được video.'));
      }
    });
  });

  function selectFigure(fig) {
    area.querySelectorAll('figure.selected').forEach((f) => {
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

  area.addEventListener('click', (e) => {
    const fig = e.target.closest ? e.target.closest('figure') : null;
    selectFigure(fig && area.contains(fig) ? fig : null);
  });

  mediaBar.querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
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

  document.getElementById('ed-media-del').addEventListener('click', removeSelected);

  area.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFig) {
      e.preventDefault();
      removeSelected();
    }
  });

  area.addEventListener('dragover', (e) => {
    if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
    }
  });
  area.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      e.preventDefault();
    }
  });

  prepareMedia();

  /* ===== Định dạng số tiền, lưu form ===== */
  document.querySelectorAll('[data-money]').forEach((el) => {
    el.addEventListener('input', () => {
      const digits = el.value.replace(/\D/g, '');
      el.value = digits ? Number(digits).toLocaleString('vi-VN') : '';
    });
  });

  form.addEventListener('submit', (e) => {
    if (busy > 0) {
      e.preventDefault();
      alert('Đang tải file lên, vui lòng đợi xong rồi bấm Lưu.');
      return;
    }
    area.querySelectorAll('figure.selected').forEach((f) => f.classList.remove('selected'));
    const specs = state.specs.filter((s) => s.label.trim() || s.value.trim());
    document.getElementById('pf-images-input').value = JSON.stringify(state.images);
    document.getElementById('pf-specs-input').value = JSON.stringify(specs);
    document.getElementById('pf-desc-input').value = area.innerHTML;
  });

  renderGallery();
  renderSpecs();
})();