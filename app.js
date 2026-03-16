// ============================================================
// Detroit Data Intelligence Platform - Main Application Controller
// ============================================================

// Global state
const APP = {
  data: {},        // cached API data
  map: null,       // Leaflet map instance
  layers: {},      // layer groups
  activeTab: 'map',
  investors: [],
  neighborhoods: [],
  opportunities: [],
  contractors: [],
  pipeline: []
};

// Detect mobile
function isMobile() {
  return window.innerWidth < 768;
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    APP.activeTab = btn.dataset.tab;
    if (btn.dataset.tab === 'map' && APP.map) APP.map.invalidateSize();
    if (btn.dataset.tab === 'investors') loadInvestors();
    if (btn.dataset.tab === 'neighborhoods') loadNeighborhoods();
    if (btn.dataset.tab === 'contractors') loadContractors();
    if (btn.dataset.tab === 'pipeline') loadPipeline();
  });
});

// Accordion toggle logic
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = 'accordion-' + header.dataset.accordion;
      const body = document.getElementById(targetId);
      if (!body) return;

      const isOpen = header.classList.contains('open');
      if (isOpen) {
        header.classList.remove('open');
        body.classList.remove('open');
      } else {
        header.classList.add('open');
        body.classList.add('open');
      }
    });
  });
}

// Fetch helper with loading state management
async function fetchAPI(endpoint) {
  try {
    const resp = await fetch(endpoint);
    if (!resp.ok) {
      console.error('API response not OK:', resp.status, endpoint);
      return [];
    }
    const json = await resp.json();
    // Unwrap {data: [...]} wrapper from static JSON files
    if (json && json.data && !Array.isArray(json) && typeof json.data === 'object') {
      return json.data;
    }
    return json;
  } catch (e) {
    console.error('API error:', endpoint, e);
    return [];
  }
}

// Format currency
function formatMoney(n) {
  if (!n && n !== 0) return 'N/A';
  return '$' + Number(n).toLocaleString();
}

// Format date from epoch ms or string
function formatDate(val) {
  if (!val) return 'N/A';
  const d = typeof val === 'number' ? new Date(val) : new Date(val);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString();
}

// Show loading indicator in a container element
function showLoading(container) {
  if (!container) return;
  container.innerHTML = '<div class="loading">Loading...</div>';
}

// Show empty state in a container element
function showEmpty(container, message) {
  if (!container) return;
  container.innerHTML = '<div class="empty-state">' + (message || 'No data available.') + '</div>';
}

// Load stats on init
async function loadStats() {
  const stats = await fetchAPI('/api/stats');
  const bar = document.getElementById('stats-bar');
  if (stats && bar) {
    bar.innerHTML =
      '<span>Sales: ' + (stats.total_sales || 0).toLocaleString() + '</span>' +
      '<span>Permits: ' + (stats.total_permits || 0).toLocaleString() + '</span>' +
      '<span>Investors: ' + (stats.total_investors || 0).toLocaleString() + '</span>' +
      '<span>Neighborhoods: ' + (stats.total_neighborhoods || 0).toLocaleString() + '</span>' +
      '<span>Contractors: ' + (stats.total_contractors || 0).toLocaleString() + '</span>' +
      '<span>Sellers: ' + (stats.total_motivated_sellers || 0).toLocaleString() + '</span>';
  }
}

// Load neighborhoods for the neighborhoods tab
async function loadNeighborhoods() {
  const grid = document.getElementById('neighborhood-grid');
  if (!grid) return;

  // Avoid reloading if already populated
  if (APP.neighborhoods.length > 0 && grid.children.length > 1) return;

  showLoading(grid);

  const data = await fetchAPI('/api/neighborhoods');
  APP.neighborhoods = data || [];

  if (APP.neighborhoods.length === 0) {
    showEmpty(grid, 'No neighborhood data available.');
    return;
  }

  // Build neighborhood momentum chart
  const chartCanvas = document.getElementById('neighborhood-momentum-chart');
  if (chartCanvas && typeof createNeighborhoodMomentumChart === 'function') {
    createNeighborhoodMomentumChart(APP.neighborhoods);
  }

  // Apply search filter if present
  let filtered = APP.neighborhoods;
  const searchInput = document.getElementById('neighborhood-search');
  if (searchInput && searchInput.value) {
    const q = searchInput.value.toLowerCase();
    filtered = filtered.filter(n => (n.name || '').toLowerCase().includes(q));
  }

  renderNeighborhoodGrid(filtered);

  // Load opportunities
  loadOpportunities();
}

// Render neighborhood grid
function renderNeighborhoodGrid(filtered) {
  const grid = document.getElementById('neighborhood-grid');
  if (!grid) return;

  let html = '';
  filtered.forEach(n => {
    const momentum = n.momentum_score != null ? n.momentum_score.toFixed(1) : 'N/A';
    const momentumClass = n.momentum_score > 50 ? 'momentum-high' :
                          n.momentum_score > 30 ? 'momentum-mid' : 'momentum-low';
    html += '<div class="neighborhood-card">' +
      '<div class="card-header">' +
        '<div class="card-name">' + escapeHtmlGlobal(n.name || 'Unknown') + '</div>' +
        '<span class="card-badge ' + momentumClass + '">' + momentum + '</span>' +
      '</div>' +
      '<div class="card-stats">' +
        '<div class="card-stat"><span class="card-stat-label">Sales (12mo)</span><span class="card-stat-value">' + (n.sales_volume_12mo || 0) + '</span></div>' +
        '<div class="card-stat"><span class="card-stat-label">Median Price</span><span class="card-stat-value">' + formatMoney(n.median_price_recent) + '</span></div>' +
        '<div class="card-stat"><span class="card-stat-label">Permits</span><span class="card-stat-value">' + (n.permit_count || 0) + '</span></div>' +
        '<div class="card-stat"><span class="card-stat-label">Price Trend</span><span class="card-stat-value">' + (n.median_price_trend != null ? (n.median_price_trend > 0 ? '+' : '') + n.median_price_trend.toFixed(1) + '%' : 'N/A') + '</span></div>' +
        '<div class="card-stat"><span class="card-stat-label">Blight Trend</span><span class="card-stat-value">' + (n.blight_declining ? 'Declining' : 'Steady/Up') + '</span></div>' +
        '<div class="card-stat"><span class="card-stat-label">Rentals</span><span class="card-stat-value">' + (n.rental_registrations || 0) + '</span></div>' +
      '</div>' +
    '</div>';
  });
  grid.innerHTML = html;
}

// Wire up neighborhood search
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('neighborhood-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (APP.neighborhoods.length > 0) {
        const q = searchInput.value.toLowerCase();
        const filtered = APP.neighborhoods.filter(n =>
          (n.name || '').toLowerCase().includes(q)
        );
        renderNeighborhoodGrid(filtered);
      }
    });
  }
});

// Load opportunities for the neighborhoods tab
async function loadOpportunities() {
  const list = document.getElementById('opportunities-list');
  if (!list) return;

  const data = await fetchAPI('/api/opportunities');
  APP.opportunities = data || [];

  if (APP.opportunities.length === 0) {
    list.innerHTML = '<div class="empty-state">No opportunities detected yet.</div>';
    return;
  }

  let html = '';
  APP.opportunities.slice(0, 30).forEach(opp => {
    const typeLabel = (opp.type || '').replace(/_/g, ' ').toUpperCase();
    const typeClass = opp.type === 'high_momentum_low_price' ? 'opp-type-value' :
                      opp.type === 'investor_cluster' ? 'opp-type-cluster' : 'opp-type-emerging';
    html += '<div class="opportunity-card">' +
      '<div class="opp-score">' + (opp.score || 0).toFixed(0) + '</div>' +
      '<div class="opp-type ' + typeClass + '">' + typeLabel + '</div>' +
      '<div class="opp-address">' + escapeHtmlGlobal(opp.neighborhood || 'Unknown') + '</div>' +
      '<div class="opp-detail">' + escapeHtmlGlobal((opp.reasoning || '').substring(0, 200)) + '</div>' +
    '</div>';
  });
  list.innerHTML = html;
}

// Escape HTML to prevent XSS (global version)
function escapeHtmlGlobal(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initAccordions();
  loadStats();
  initMap();
  initFilters();
});
