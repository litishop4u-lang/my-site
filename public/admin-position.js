(() => {
  const cells = document.querySelectorAll('[data-pos-cell]');
  if (cells.length === 0) return;

  cells.forEach((cell) => {
    const input = cell.querySelector('.pos-input');
    const btn = cell.querySelector('.pos-btn');
    if (!input || !btn) return;

    function lock(hasValue) {
      cell.classList.add('locked');
      input.disabled = true;
      btn.textContent = 'Chỉnh sửa';
      btn.disabled = false;
      if (!hasValue) input.value = '';
    }

    function unlock() {
      cell.classList.remove('locked', 'pos-err');
      input.disabled = false;
      btn.textContent = 'Lưu';
      input.focus();
      input.select();
    }

    function save() {
      const digits = input.value.replace(/\D/g, '').slice(0, 4);
      const number = digits === '' ? 0 : parseInt(digits, 10);
      input.value = number > 0 ? String(number) : '';

      const body = new FormData();
      body.set('action', 'position');
      body.set('id', input.getAttribute('data-id'));
      body.set('position', String(number));

      btn.disabled = true;
      btn.textContent = 'Đang lưu...';
      cell.classList.remove('pos-err');

      fetch(window.location.pathname, { method: 'POST', body: body, credentials: 'same-origin' })
        .then((res) => {
          if (!res.ok) throw new Error('http ' + res.status);
          lock(number > 0);
        })
        .catch(() => {
          btn.disabled = false;
          btn.textContent = 'Lưu';
          cell.classList.add('pos-err');
        });
    }

    btn.addEventListener('click', () => {
      if (cell.classList.contains('locked')) unlock();
      else save();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!cell.classList.contains('locked')) save();
      }
    });
  });
})();