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
      const name = investorDisplayName(inv);
      if (name) {
        optionsHtml += '<option value="' + escapeAttr(name) + '">';
      }
    });
    datalist.innerHTML = optionsHtml;
  }

  // Also set up input-based autocomplete as fallback
  if (!datalist) {
    setupCustomAutocomplete(input, investors.map(investorDisplayName).filter(Boolean));
  }
}

function investorDisplayName(inv) {
  return (inv && (inv.name || inv.canonical_name || inv.investor_name || (inv.aliases && inv.aliases[0]))) || '';
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
  const dateFrom = document.getElementById('filter-start-date');
  const dateTo = document.getElementById('filter-end-date');
  if (dateFrom) {
    dateFrom.addEventListener('change', updateFilterSummary);
  }
  if (dateTo) {
    dateTo.addEventListener('change', updateFilterSummary);
  }

  // Price range change events
  const priceMin = document.getElementById('filter-min-price');
  const priceMax = document.getElementById('filter-max-price');
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

// Static JSON rewrites ignore query strings. Apply the same filters client-side
// after fetch so Map Apply/Clear actually changes visible markers.
const DEED_TYPE_ALIASES = {
  'WARRANTY': ['warranty', 'wd'],
  'QUIT CLAIM': ['quit claim', 'quitclaim', 'qc'],
  'COVENANT': ['covenant', 'cd']
};

function getFilterState() {
  const valueOf = (id) => {
    const el = document.getElementById(id);
    return el && el.value ? el.value : '';
  };
  return {
    neighborhood: valueOf('filter-neighborhood'),
    grantee: valueOf('filter-grantee'),
    startDate: valueOf('filter-start-date'),
    endDate: valueOf('filter-end-date'),
    minPrice: valueOf('filter-min-price'),
    maxPrice: valueOf('filter-max-price'),
    deedType: valueOf('filter-deed-type')
  };
}

function recordFilterDate(item) {
  const raw = item.sale_date || item.issued_date || item.ticket_issued_date ||
    item.called_at || item.call_date_time || item.submitted_date || '';
  return String(raw).slice(0, 10);
}

function recordFilterPrice(item) {
  const p = item.amt_sale_price ?? item.price ?? item.sale_price;
  if (p == null || p === '') return null;
  const n = Number(p);
  return Number.isNaN(n) ? null : n;
}

function recordMatchesFilters(item, filters) {
  if (!item) return false;
  filters = filters || {};

  if (filters.neighborhood) {
    const q = filters.neighborhood.toLowerCase();
    const hood = (item.neighborhood || item.ecf_neighborhood || '').toLowerCase();
    if (!hood.includes(q)) return false;
  }

  if (filters.grantee) {
    const q = filters.grantee.toLowerCase();
    const names = [item.grantee, item.grantor, item.investor_name, item.owner_name, item.owner];
    if (!names.some(n => String(n || '').toLowerCase().includes(q))) return false;
  }

  if (filters.startDate) {
    const d = recordFilterDate(item);
    if (!d || d < filters.startDate) return false;
  }
  if (filters.endDate) {
    const d = recordFilterDate(item);
    if (!d || d > filters.endDate) return false;
  }

  if (filters.minPrice) {
    const p = recordFilterPrice(item);
    if (p == null || p < Number(filters.minPrice)) return false;
  }
  if (filters.maxPrice) {
    const p = recordFilterPrice(item);
    if (p == null || p > Number(filters.maxPrice)) return false;
  }

  if (filters.deedType) {
    const aliases = DEED_TYPE_ALIASES[filters.deedType] || [String(filters.deedType).toLowerCase()];
    const instrument = String(item.sale_instrument || '').toLowerCase();
    const term = String(item.term_of_sale || '').toLowerCase();
    if (!aliases.some(a => instrument === a || instrument.includes(a) || term.includes(a))) {
      return false;
    }
  }

  return true;
}

function applyClientFilters(records, filters, layerName) {
  if (!Array.isArray(records)) return [];
  // Price/deed/grantee filters are sales-shaped. Applying them to blight/permits
  // (no amt_sale_price / sale_instrument) would wipe those layers on Apply.
  if (layerName && layerName !== 'sales' && layerName !== 'investors') {
    return records;
  }
  const active = filters || (typeof document !== 'undefined' ? getFilterState() : {});
  const hasAny = !!(active.neighborhood || active.grantee || active.startDate ||
    active.endDate || active.minPrice || active.maxPrice || active.deedType);
  if (!hasAny) return records;
  return records.filter(item => recordMatchesFilters(item, active));
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
