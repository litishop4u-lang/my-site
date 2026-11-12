(function () {
  var form = document.querySelector('[data-filter-form]');
  if (!form) return;

  if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
    form.querySelectorAll('.filter-group').forEach(function (d) {
      if (!d.hasAttribute('data-active')) d.open = false;
    });
  }

  var timer = null;
  function submit() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      form.submit();
    }, 250);
  }

  var min = form.querySelector('input[name="min"]');
  var max = form.querySelector('input[name="max"]');
  var radios = form.querySelectorAll('input[name="price"]');

  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      if (min) min.value = '';
      if (max) max.value = '';
    });
  });

  [min, max].forEach(function (input) {
    if (!input) return;
    input.addEventListener('input', function () {
      radios.forEach(function (r) {
        r.checked = r.value === '';
      });
    });
  });

  form.addEventListener('change', submit);
})();