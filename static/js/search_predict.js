// static/js/search_predict.js

let debounceTimer = null;
let currentFocus = -1;

function initPredictiveSearch() {
  const searchInput = document.getElementById('companySearchInput');
  const dropdown = document.getElementById('predictDropdown');

  if (!searchInput || !dropdown) return;

  searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    clearTimeout(debounceTimer);
    currentFocus = -1;

    if (query.length < 2) {
      dropdown.classList.remove('show');
      dropdown.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-company?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderPredictions(data.results, dropdown);
      } catch (err) {
        console.error('Lỗi tra cứu gợi ý:', err);
      }
    }, 250);
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', function(e) {
    const items = dropdown.getElementsByClassName('predict-item');
    if (!dropdown.classList.contains('show') || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      currentFocus++;
      addActive(items);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      currentFocus--;
      addActive(items);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentFocus > -1 && items[currentFocus]) {
        items[currentFocus].click();
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('show');
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

function renderPredictions(results, dropdown) {
  dropdown.innerHTML = '';
  if (!results || results.length === 0) {
    dropdown.classList.remove('show');
    return;
  }

  results.forEach((biz) => {
    const item = document.createElement('div');
    item.className = 'predict-item';
    item.innerHTML = `
      <div class="predict-company-name">${escapeHtml(biz.name)}</div>
      <div class="predict-company-meta">
        <span class="predict-tax-tag">MST: ${escapeHtml(biz.tax_code)}</span>
        <span class="predict-company-address">${escapeHtml(biz.address || '')}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      selectCompany(biz);
      dropdown.classList.remove('show');
    });

    dropdown.appendChild(item);
  });

  dropdown.classList.add('show');
}

function addActive(items) {
  if (!items) return;
  removeActive(items);
  if (currentFocus >= items.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = items.length - 1;
  items[currentFocus].classList.add('active');
  items[currentFocus].scrollIntoView({ block: 'nearest' });
}

function removeActive(items) {
  for (let i = 0; i < items.length; i++) {
    items[i].classList.remove('active');
  }
}

function selectCompany(biz) {
  document.getElementById('taxCode').value = biz.tax_code;
  document.getElementById('companyName').value = biz.name;
  document.getElementById('companySearchInput').value = `${biz.name} (${biz.tax_code})`;

  // Focus next field
  const contactInput = document.getElementById('contactPerson');
  if (contactInput) contactInput.focus();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
