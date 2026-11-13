(() => {
  const root = document.getElementById('pf-variants');
  const input = document.getElementById('pf-variants-input');
  const dataEl = document.getElementById('pf-variants-data');
  if (!root || !input) return;

  const MAX_GROUPS = 5;
  const MAX_OPTIONS = 30;

  let groups = [];
  try {
    const raw = JSON.parse(dataEl ? dataEl.textContent || '[]' : '[]');
    if (Array.isArray(raw)) {
      groups = raw.map((g) => ({
        name: String(g.name || ''),
        options: (Array.isArray(g.options) ? g.options : []).map((o) => ({
          label: String(o.label || ''),
          price: Number(o.price) > 0 ? Number(o.price) : 0,
        })),
      }));
    }
  } catch (e) {
    groups = [];
  }

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el[k] = v;
      else el.setAttribute(k, v);
    });
    children.forEach((c) => {
      if (c) el.append(c);
    });
    return el;
  }

  function fmt(n) {
    return n > 0 ? Number(n).toLocaleString('vi-VN') : '';
  }

  function sync() {
    const clean = groups
      .map((g) => ({
        name: g.name.trim(),
        options: g.options
          .map((o) => ({ label: o.label.trim(), price: o.price > 0 ? o.price : 0 }))
          .filter((o) => o.label),
      }))
      .filter((g) => g.name && g.options.length > 0);
    input.value = JSON.stringify(clean);
  }

  function render() {
    root.textContent = '';
    groups.forEach((g, gi) => {
      const optsEl = h('div', { class: 'pv-options' });
      g.options.forEach((o, oi) => {
        optsEl.append(
          h(
            'div',
            { class: 'pv-option-row' },
            h('input', {
              type: 'text',
              placeholder: 'Lựa chọn (vd: Đỏ, 48V)',
              value: o.label,
              oninput: (e) => {
                o.label = e.target.value;
                sync();
              },
            }),
            h('input', {
              type: 'text',
              inputmode: 'numeric',
              placeholder: 'Giá riêng (đ), bỏ trống = giá chung',
              value: fmt(o.price),
              oninput: (e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                o.price = Number.isFinite(n) ? n : 0;
                sync();
              },
              onblur: (e) => {
                e.target.value = fmt(o.price);
              },
            }),
            h('button', {
              type: 'button',
              class: 'adm-icon-btn danger',
              title: 'Xoá lựa chọn',
              text: '✕',
              onclick: () => {
                g.options.splice(oi, 1);
                render();
                sync();
              },
            }),
          ),
        );
      });

      root.append(
        h(
          'div',
          { class: 'pv-group' },
          h(
            'div',
            { class: 'pv-group-head' },
            h('input', {
              type: 'text',
              class: 'pv-group-name',
              placeholder: 'Tên nhóm (vd: Màu sắc, Phiên bản)',
              value: g.name,
              oninput: (e) => {
                g.name = e.target.value;
                sync();
              },
            }),
            h('button', {
              type: 'button',
              class: 'adm-icon-btn danger',
              text: 'Xoá nhóm',
              onclick: () => {
                groups.splice(gi, 1);
                render();
                sync();
              },
            }),
          ),
          optsEl,
          h('button', {
            type: 'button',
            class: 'adm-icon-btn',
            text: '+ Thêm lựa chọn',
            onclick: () => {
              if (g.options.length >= MAX_OPTIONS) return;
              g.options.push({ label: '', price: 0 });
              render();
              const rows = root.querySelectorAll('.pv-group')[gi].querySelectorAll('.pv-option-row');
              const last = rows[rows.length - 1];
              if (last) last.querySelector('input').focus();
            },
          }),
        ),
      );
    });
    sync();
  }

  function addGroup(name) {
    if (groups.length >= MAX_GROUPS) return;
    groups.push({ name: name, options: [{ label: '', price: 0 }] });
    render();
  }

  const addBtn = document.getElementById('pv-add-group');
  const addColor = document.getElementById('pv-add-color');
  const addVersion = document.getElementById('pv-add-version');
  if (addBtn) addBtn.addEventListener('click', () => addGroup(''));
  if (addColor) addColor.addEventListener('click', () => addGroup('Màu sắc'));
  if (addVersion) addVersion.addEventListener('click', () => addGroup('Phiên bản'));

  const form = document.getElementById('product-form');
  if (form) form.addEventListener('submit', sync, true);

  render();
})();