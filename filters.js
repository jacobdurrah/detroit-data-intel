// ============================================================
// Detroit Data Intelligence Platform - Filter and Search Logic
// ============================================================

// Initialize all filter controls
function initFilters() {
  populateNeighborhoodDropdown();
  populateInvestorAutocomplete();
  wireFilterEvents();
  wireExportButtons();
}

// Populate the neighborhood dropdown from API
async function populateNeighborhoodDropdown() {
  const select = document.getElementById('filter-neighborhood');
  if (!select) return;

  // Add loading option
  select.innerHTML = '<option value="">Loading neighborhoods...</option>';

  const data = await fetchAPI('/api/neighborhoods');
  const neighborhoods = data || [];

  // Build options
  let options = '<option value="">All Neighborhoods</option>';
  neighborhoods.forEach(n => {
    const name = typeof n === 'string' ? n : (n.name || '');
    if (name) {
      options += '<option value="' + escapeAttr(name) + '">' + escapeAttr(name) + '</option>';
    }
  });

  select.innerHTML = options;
}

// Populate the grantee/investor autocomplete from API
async function populateInvestorAutocomplete() {
  const input = document.getElementById('filter-grantee');
  const datalist = document.getElementById('grantee-list');
  if (!input) return;

  const data = await fetchAPI('/api/investors');
  const investors = data || [];

  // If there is a datalist element, populate it
  if (datalist) {
    let optionsHtml = '';
    investors.forEach(inv => {
      const name = inv.name || inv.investor_name || '';
      if (name) {
        optionsHtml += '<option value="' + escapeAttr(name) + '">';
      }
    });
    datalist.innerHTML = optionsHtml;
  }

  // Also set up input-based autocomplete as fallback
  if (!datalist) {
    setupCustomAutocomplete(input, investors.map(inv => inv.name || inv.investor_name || '').filter(Boolean));
  }
}

// Set up a custom autocomplete dropdown for an input field
function setupCustomAutocomplete(input, suggestions) {
  if (!input || !suggestions || suggestions.length === 0) return;

  let dropdown = null;

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase();
    removeAutocompleteDropdown();

    if (val.length < 2) return;

    const matches = suggestions.filter(s => s.toLowerCase().includes(val)).slice(0, 20);
    if (matches.length === 0) return;

    dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.zIndex = '1000';

    matches.forEach(m => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = m;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = m;
        removeAutocompleteDropdown();
      });
      dropdown.appendChild(item);
    });

    // Position below the input
    const rect = input.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.width = rect.width + 'px';
    document.body.appendChild(dropdown);
  });

  input.addEventListener('blur', () => {
    // Delay removal so click event fires first
    setTimeout(removeAutocompleteDropdown, 200);
  });

  function removeAutocompleteDropdown() {
    if (dropdown && dropdown.parentNode) {
      dropdown.parentNode.removeChild(dropdown);
    }
    dropdown = null;
  }
}

// Wire up filter control events
function wireFilterEvents() {
  // Apply Filters button
  const applyBtn = document.getElementById('apply-filters');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      applyFilters();
    });
  }

  // Clear Filters button
  const clearBtn = document.getElementById('clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearFilters();
    });
  }

  // Enter key in filter inputs triggers apply
  document.querySelectorAll('.filter-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
  });

  // Date range change events for live feedback
  const dateFrom = document.getElementById('filter-date-from');
  const dateTo = document.getElementById('filter-date-to');
  if (dateFrom) {
    dateFrom.addEventListener('change', updateFilterSummary);
  }
  if (dateTo) {
    dateTo.addEventListener('change', updateFilterSummary);
  }

  // Price range change events
  const priceMin = document.getElementById('filter-price-min');
  const priceMax = document.getElementById('filter-price-max');
  if (priceMin) {
    priceMin.addEventListener('change', updateFilterSummary);
  }
  if (priceMax) {
    priceMax.addEventListener('change', updateFilterSummary);
  }

  // Neighborhood dropdown change
  const neighborhoodSelect = document.getElementById('filter-neighborhood');
  if (neighborhoodSelect) {
    neighborhoodSelect.addEventListener('change', updateFilterSummary);
  }
}

// Apply the current filter values and reload active map layers
function applyFilters() {
  // Show loading indication
  const applyBtn = document.getElementById('apply-filters');
  if (applyBtn) {
    applyBtn.textContent = 'Applying...';
    applyBtn.disabled = true;
  }

  // Reload all active layers with the new filter parameters
  if (typeof reloadActiveLayers === 'function') {
    reloadActiveLayers();
  }

  // Reset button state
  setTimeout(() => {
    if (applyBtn) {
      applyBtn.textContent = 'Apply Filters';
      applyBtn.disabled = false;
    }
  }, 500);

  updateFilterSummary();
}

// Clear all filter inputs and reload
function clearFilters() {
  // Reset all filter inputs
  const neighborhood = document.getElementById('filter-neighborhood');
  const grantee = document.getElementById('filter-grantee');
  const dateFrom = document.getElementById('filter-start-date');
  const dateTo = document.getElementById('filter-end-date');
  const priceMin = document.getElementById('filter-min-price');
  const priceMax = document.getElementById('filter-max-price');
  const deedType = document.getElementById('filter-deed-type');

  if (neighborhood) neighborhood.value = '';
  if (grantee) grantee.value = '';
  if (dateFrom) dateFrom.value = '';
  if (dateTo) dateTo.value = '';
  if (priceMin) priceMin.value = '';
  if (priceMax) priceMax.value = '';
  if (deedType) deedType.value = '';

  // Clear any custom filter inputs
  document.querySelectorAll('.filter-input').forEach(input => {
    if (input.type === 'checkbox') {
      input.checked = false;
    } else if (input.tagName === 'SELECT') {
      input.selectedIndex = 0;
    } else {
      input.value = '';
    }
  });

  // Reload active layers without filters
  if (typeof reloadActiveLayers === 'function') {
    reloadActiveLayers();
  }

  updateFilterSummary();
}

// Build query string from current filter values
function getActiveFilterParams() {
  const params = new URLSearchParams();

  const neighborhood = document.getElementById('filter-neighborhood');
  const grantee = document.getElementById('filter-grantee');
  const dateFrom = document.getElementById('filter-start-date');
  const dateTo = document.getElementById('filter-end-date');
  const priceMin = document.getElementById('filter-min-price');
  const priceMax = document.getElementById('filter-max-price');
  const deedType = document.getElementById('filter-deed-type');

  if (neighborhood && neighborhood.value) params.set('neighborhood', neighborhood.value);
  if (grantee && grantee.value) params.set('grantee', grantee.value);
  if (dateFrom && dateFrom.value) params.set('start_date', dateFrom.value);
  if (dateTo && dateTo.value) params.set('end_date', dateTo.value);
  if (priceMin && priceMin.value) params.set('min_price', priceMin.value);
  if (priceMax && priceMax.value) params.set('max_price', priceMax.value);
  if (deedType && deedType.value) params.set('deed_type', deedType.value);

  const str = params.toString();
  return str || '';
}

// Update the filter summary display
function updateFilterSummary() {
  const summary = document.getElementById('filter-summary');
  if (!summary) return;

  const parts = [];

  const neighborhood = document.getElementById('filter-neighborhood');
  const grantee = document.getElementById('filter-grantee');
  const dateFrom = document.getElementById('filter-start-date');
  const dateTo = document.getElementById('filter-end-date');
  const priceMin = document.getElementById('filter-min-price');
  const priceMax = document.getElementById('filter-max-price');

  if (neighborhood && neighborhood.value) parts.push('Neighborhood: ' + neighborhood.value);
  if (grantee && grantee.value) parts.push('Grantee: ' + grantee.value);
  if (dateFrom && dateFrom.value) parts.push('From: ' + dateFrom.value);
  if (dateTo && dateTo.value) parts.push('To: ' + dateTo.value);
  if (priceMin && priceMin.value) parts.push('Min: $' + Number(priceMin.value).toLocaleString());
  if (priceMax && priceMax.value) parts.push('Max: $' + Number(priceMax.value).toLocaleString());

  if (parts.length === 0) {
    summary.textContent = 'No filters active';
    summary.classList.remove('has-filters');
  } else {
    summary.textContent = parts.join(' | ');
    summary.classList.add('has-filters');
  }
}

// Wire up export buttons
function wireExportButtons() {
  document.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dataset = btn.dataset.export;
      if (dataset) {
        exportCSV(dataset);
      }
    });
  });

  // Also handle a generic export button
  const mainExportBtn = document.getElementById('export-csv');
  if (mainExportBtn) {
    mainExportBtn.addEventListener('click', () => {
      // Determine which dataset to export based on active tab
      let dataset = 'sales'; // default
      if (APP.activeTab === 'investors') dataset = 'investors';
      if (APP.activeTab === 'neighborhoods') dataset = 'neighborhoods';
      exportCSV(dataset);
    });
  }
}

// Export data as CSV
function exportCSV(dataset) {
  // Build export URL with current filters
  let url = '/api/export/' + encodeURIComponent(dataset);
  const filterParams = getActiveFilterParams();
  if (filterParams) {
    url += '?' + filterParams;
  }

  // Trigger download by creating a temporary link
  const link = document.createElement('a');
  link.href = url;
  link.download = dataset + '_export.csv';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Escape attribute values to prevent XSS in HTML attributes
function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}
