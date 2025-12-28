(function() {
  function loadPartial(id, url) {
    var el = document.getElementById(id);
    if (!el) return;
    fetch(url + '?v=' + new Date().toISOString().slice(0,10))
      .then(function(response) { return response.text(); })
      .then(function(html) {
        el.innerHTML = html;
        if (id === 'site-header') {
            highlightActiveNav();
        }
      })
      .catch(function(err) { console.error('Error loading partial:', url, err); });
  }

  function highlightActiveNav() {
      var path = window.location.pathname;
      // Normalize path for index pages (e.g. /sudoku/ -> /sudoku/index.html match)
      // or just simple matching.
      var links = document.querySelectorAll('.nav-link, .nav-action-link, .dropdown-item');
      links.forEach(function(link) {
          var href = link.getAttribute('href');
          if (href === path || (href.endsWith('/') && path === href + 'index.html')) {
              link.style.color = 'var(--color-accent)';
          }
      });
  }

  // Run if DOM is ready, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        loadPartial('site-header', '/partials/header.html');
        loadPartial('site-footer', '/partials/footer.html');
    });
  } else {
    loadPartial('site-header', '/partials/header.html');
    loadPartial('site-footer', '/partials/footer.html');
  }
})();
