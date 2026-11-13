(() => {
  const box = document.querySelector('[data-variants]');
  if (!box) return;
  const priceBox = document.querySelector('[data-price-box]');
  const priceNow = document.querySelector('[data-price-now]');
  const priceOld = document.querySelector('[data-price-old]');
  const basePrice = priceNow ? priceNow.textContent : '';
  const baseOld = priceOld ? priceOld.style.display : '';

  function fmt(n) {
    return Number(n).toLocaleString('vi-VN') + ' đ';
  }

  function refresh() {
    let price = 0;
    box.querySelectorAll('.variant-chip.active').forEach((b) => {
      const p = parseInt(b.getAttribute('data-price') || '0', 10);
      if (p > 0) price = p;
    });
    if (!priceNow) return;
    if (price > 0) {
      priceNow.textContent = fmt(price);
      if (priceOld) priceOld.style.display = 'none';
    } else {
      priceNow.textContent = basePrice;
      if (priceOld) priceOld.style.display = baseOld;
    }
    if (priceBox) priceBox.classList.toggle('is-variant', price > 0);
  }

  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.variant-chip');
    if (!btn) return;
    const group = btn.closest('[data-variant-group]');
    const selected = group.querySelector('[data-variant-selected]');
    if (btn.classList.contains('active')) {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
      if (selected) selected.textContent = '';
    } else {
      group.querySelectorAll('.variant-chip').forEach((c) => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      if (selected) selected.textContent = btn.getAttribute('data-label') || '';
    }
    refresh();
  });
})();