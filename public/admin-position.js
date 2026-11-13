(() => {
  const inputs = document.querySelectorAll('.pos-input');
  if (inputs.length === 0) return;

  inputs.forEach((input) => {
    let last = input.value;

    function save() {
      const cleaned = input.value.replace(/\D/g, '').slice(0, 4);
      const value = cleaned === '' ? '0' : String(parseInt(cleaned, 10));
      input.value = value === '0' ? '' : value;
      if (value === last || (value === '0' && last === '')) return;

      const body = new FormData();
      body.set('action', 'position');
      body.set('id', input.getAttribute('data-id'));
      body.set('position', value);
      input.classList.remove('pos-ok', 'pos-err');
      input.classList.add('pos-busy');

      fetch(window.location.pathname, { method: 'POST', body: body, credentials: 'same-origin' })
        .then((res) => {
          if (!res.ok) throw new Error('http ' + res.status);
          last = input.value === '' ? '0' : input.value;
          input.classList.remove('pos-busy');
          input.classList.add('pos-ok');
          setTimeout(() => input.classList.remove('pos-ok'), 1500);
        })
        .catch(() => {
          input.classList.remove('pos-busy');
          input.classList.add('pos-err');
        });
    }

    input.addEventListener('change', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
  });
})();