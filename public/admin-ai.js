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

  async function callAi(payload) {
    var res = await fetch('/api/admin/ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error || 'AI không phản hồi.');
    return data;
  }

  function shell(title) {
    var closeBtn = h('button', { type: 'button', class: 'mp-close', title: 'Đóng', text: '✕' });
    var body = h('div', { class: 'ai-body' });
    var dialog = h(
      'div',
      { class: 'ai-dialog', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'mp-head' }, h('h3', { text: title }), closeBtn),
      body,
    );
    var overlay = h('div', { class: 'ai-overlay' }, dialog);

    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    function close() {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
    return { body: body, close: close };
  }

  function field(label, control) {
    return h('label', { class: 'ai-field' }, h('span', { text: label }), control);
  }

  function option(value, label, disabled) {
    return h('option', { value: value, text: label, disabled: !!disabled });
  }

  function open(opts) {
    opts = opts || {};
    var modes = opts.modes || [];
    var selectedText = opts.getSelectedText ? opts.getSelectedText() : '';
    var html = '';
    var busy = false;

    var ui = shell('✨ AI viết giúp');

    var modeSel = h('select', {});
    modes.forEach(function (m) {
      modeSel.append(option(m.value, m.label, m.value === 'rewrite' && !selectedText));
    });
    if (modes.length) modeSel.value = modes[0].value;

    var instruction = h('textarea', {
      rows: '3',
      placeholder:
        'Ghi chú thêm cho AI (không bắt buộc). Ví dụ: nhấn mạnh pin lithium, phù hợp học sinh đi học. Với bài tin tức hoặc giới thiệu, hãy ghi chủ đề và các ý chính.',
    });

    var lengthSel = h('select', {});
    lengthSel.append(option('short', 'Ngắn (khoảng 150 từ)'));
    lengthSel.append(option('medium', 'Vừa (khoảng 300 từ)'));
    lengthSel.append(option('long', 'Dài (khoảng 500 từ)'));
    lengthSel.value = 'medium';

    var toneSel = h('select', {});
    toneSel.append(option('friendly', 'Thân thiện, gần gũi'));
    toneSel.append(option('professional', 'Chuyên nghiệp, đáng tin cậy'));
    toneSel.append(option('concise', 'Ngắn gọn, đi thẳng vào lợi ích'));

    var statusEl = h('div', { class: 'ai-status' });
    var preview = h('div', { class: 'ai-preview rich rich-html' });
    preview.hidden = true;

    var runBtn = h('button', { type: 'button', class: 'adm-btn', text: 'Soạn bản nháp' });
    var insertBtn = h('button', { type: 'button', class: 'adm-btn', text: 'Chèn vào vị trí con trỏ' });
    var replaceBtn = h('button', { type: 'button', class: 'adm-icon-btn', text: 'Thay toàn bộ nội dung' });
    insertBtn.hidden = true;
    replaceBtn.hidden = true;

    function refreshButtons() {
      var rewrite = modeSel.value === 'rewrite';
      insertBtn.textContent = rewrite ? 'Thay đoạn đang chọn' : 'Chèn vào vị trí con trỏ';
      replaceBtn.style.display = rewrite ? 'none' : '';
    }
    modeSel.addEventListener('change', refreshButtons);
    refreshButtons();

    async function run() {
      if (busy) return;
      busy = true;
      runBtn.disabled = true;
      insertBtn.hidden = true;
      replaceBtn.hidden = true;
      preview.hidden = true;
      statusEl.textContent = 'AI đang viết, vui lòng đợi vài giây...';
      try {
        var mode = modeSel.value;
        var data = await callAi({
          mode: mode,
          context: opts.getContext ? opts.getContext() : {},
          instruction: instruction.value,
          length: lengthSel.value,
          tone: toneSel.value,
          selected: mode === 'rewrite' ? selectedText : '',
        });
        html = data.html || '';
        preview.innerHTML = html;
        preview.hidden = false;
        insertBtn.hidden = false;
        replaceBtn.hidden = false;
        runBtn.textContent = 'Tạo lại';
        statusEl.textContent =
          'Xong. Hãy đọc kỹ và kiểm tra lại số liệu trước khi chèn vào bài.' +
          (data.model ? ' (Mô hình: ' + data.model + ')' : '');
      } catch (err) {
        statusEl.textContent = 'Lỗi: ' + (err && err.message ? err.message : 'không gọi được AI.');
      } finally {
        busy = false;
        runBtn.disabled = false;
      }
    }

    runBtn.addEventListener('click', run);
    insertBtn.addEventListener('click', function () {
      if (!html) return;
      ui.close();
      if (opts.onInsert) opts.onInsert(html);
    });
    replaceBtn.addEventListener('click', function () {
      if (!html) return;
      if (!window.confirm('Thay toàn bộ nội dung hiện tại (kể cả ảnh, video đã chèn) bằng bản nháp này?')) return;
      ui.close();
      if (opts.onReplace) opts.onReplace(html);
    });

    ui.body.append(
      h('p', {
        class: 'ai-hint',
        text:
          (opts.hint || 'AI chỉ dùng thông tin bạn đã nhập.') +
          ' AI có thể sai sót, hãy đọc lại trước khi lưu, nhất là thông số, bảo hành và giá.',
      }),
      field('Việc cần làm', modeSel),
      field('Ghi chú thêm cho AI', instruction),
      h('div', { class: 'ai-row' }, field('Độ dài', lengthSel), field('Giọng văn', toneSel)),
      h('div', { class: 'ai-actions' }, runBtn, statusEl),
      preview,
      h('div', { class: 'ai-actions' }, insertBtn, replaceBtn),
    );
  }

  function pickFromList(title, items, onPick) {
    var ui = shell(title);
    ui.body.append(h('p', { class: 'ai-hint', text: 'Bấm vào tiêu đề bạn thích, bạn vẫn sửa lại được sau.' }));
    items.forEach(function (text) {
      ui.body.append(
        h('button', {
          type: 'button',
          class: 'ai-pick',
          text: text,
          onclick: function () {
            ui.close();
            onPick(text);
          },
        }),
      );
    });
  }

  function plainFromEditor() {
    var area = document.querySelector('[data-rich-area]');
    return area ? area.innerText.replace(/\s+/g, ' ').trim() : '';
  }

  document.addEventListener('click', async function (e) {
    var btn = e.target.closest ? e.target.closest('[data-ai-meta], [data-ai-titles]') : null;
    if (!btn) return;
    var statusEl = document.querySelector('[data-ai-status]');
    function say(text) {
      if (statusEl) statusEl.textContent = text;
    }

    var titleField = document.getElementById('title');
    var title = titleField ? titleField.value.trim() : '';
    var text = plainFromEditor();

    if (btn.hasAttribute('data-ai-meta')) {
      if (!title && !text) {
        alert('Hãy nhập tiêu đề hoặc nội dung bài viết trước.');
        return;
      }
      btn.disabled = true;
      say('AI đang viết mô tả ngắn...');
      try {
        var data = await callAi({ mode: 'meta', context: { title: title, text: text.slice(0, 3000) } });
        var desc = document.getElementById('description');
        if (desc && data.text) desc.value = data.text;
        say('Đã điền mô tả ngắn, hãy đọc lại và sửa nếu cần.');
      } catch (err) {
        say('Lỗi: ' + (err && err.message ? err.message : 'không gọi được AI.'));
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (!title && !text) {
      alert('Hãy nhập tiêu đề tạm hoặc nội dung bài trước để AI có cái mà gợi ý.');
      return;
    }
    btn.disabled = true;
    say('AI đang nghĩ tiêu đề...');
    try {
      var res = await callAi({ mode: 'titles', context: { title: title, text: text.slice(0, 3000) } });
      say('');
      pickFromList('✨ Gợi ý tiêu đề', res.titles || [], function (picked) {
        if (titleField) titleField.value = picked;
      });
    } catch (err) {
      say('Lỗi: ' + (err && err.message ? err.message : 'không gọi được AI.'));
    } finally {
      btn.disabled = false;
    }
  });

  window.AiAssist = { open: open };
})();