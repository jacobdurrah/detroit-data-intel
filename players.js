// ============================================================
// Detroit Data Intelligence Platform - Investor Dashboard Logic
// ============================================================

let investorSortField = 'rank_score';
let investorSortDir = 'desc';
let investorSearchText = '';

// Load investors into the investor table
async function loadInvestors() {
  const tbody = document.getElementById('investor-tbody');
  const cards = document.getElementById('investor-cards');
  if (!tbody && !cards) return;

  // Avoid reloading if already populated
  if (APP.investors.length > 0 && ((tbody && tbody.children.length > 0) || (cards && cards.children.length > 0))) return;

  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading investors...</td></tr>';
  if (cards) cards.innerHTML = '<div class="loading">Loading investors...</div>';

  const data = await fetchAPI('/api/investors?top=200');
  APP.investors = data || [];

  renderInvestorTable();
  renderInvestorCards();
  wireInvestorControls();
}

// Render the investor table (desktop)
function renderInvestorTable() {
  const tbody = document.getElementById('investor-tbody');
  if (!tbody) return;

  let filtered = getFilteredInvestors();

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No investors found.</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach((inv, idx) => {
    const name = inv.name || inv.canonical_name || (inv.aliases && inv.aliases[0]) || 'Unknown';
    const safeName = escapeHtml(name);
    const accel = inv.is_accelerating
      ? '<span class="badge-accelerating">Yes</span>'
      : '<span class="badge-steady">No</span>';

    html += '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td class="investor-name-cell">' + safeName + '</td>' +
      '<td>' + (inv.total_purchases || 0).toLocaleString() + '</td>' +
      '<td>' + formatMoney(inv.total_spend) + '</td>' +
      '<td>' + escapeHtml(inv.top_neighborhood || (inv.neighborhoods && Object.keys(inv.neighborhoods).sort((a,b) => inv.neighborhoods[b] - inv.neighborhoods[a])[0]) || 'N/A') + '</td>' +
      '<td>' + formatDate(inv.last_purchase) + '</td>' +
      '<td class="text-center">' + accel + '</td>' +
      '<td>' +
        '<button class="btn-view" onclick="showInvestorDetail(\'' + safeName.replace(/'/g, "\\'") + '\')">View</button> ' +
        '<button class="btn-view" onclick="showInvestorOnMap(\'' + safeName.replace(/'/g, "\\'") + '\')">Map</button>' +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = html;
}

// Render investor cards (mobile)
function renderInvestorCards() {
  const cards = document.getElementById('investor-cards');
  if (!cards) return;

  let filtered = getFilteredInvestors();

  if (filtered.length === 0) {
    cards.innerHTML = '<div class="empty-state">No investors found.</div>';
    return;
  }

  let html = '';
  filtered.forEach((inv, idx) => {
    const name = inv.name || inv.canonical_name || (inv.aliases && inv.aliases[0]) || 'Unknown';
    const safeName = escapeHtml(name);
    const accel = inv.is_accelerating
      ? '<span class="badge-accelerating">Accelerating</span>'
      : '<span class="badge-steady">Steady</span>';

    html += '<div class="data-card">' +
      '<div class="data-card-header">' +
        '<div class="data-card-title">' + safeName + '</div>' +
        '<span class="data-card-rank">#' + (idx + 1) + '</span>' +
      '</div>' +
      '<div class="data-card-grid">' +
        '<div class="data-card-stat"><span class="data-card-label">Purchases</span><span class="data-card-value">' + (inv.total_purchases || 0).toLocaleString() + '</span></div>' +
        '<div class="data-card-stat"><span class="data-card-label">Total Spend</span><span class="data-card-value">' + formatMoney(inv.total_spend) + '</span></div>' +
        '<div class="data-card-stat"><span class="data-card-label">Top Area</span><span class="data-card-value">' + escapeHtml(inv.top_neighborhood || (inv.neighborhoods && Object.keys(inv.neighborhoods).sort((a,b) => inv.neighborhoods[b] - inv.neighborhoods[a])[0]) || 'N/A') + '</span></div>' +
        '<div class="data-card-stat"><span class="data-card-label">Status</span><span class="data-card-value">' + accel + '</span></div>' +
      '</div>' +
      '<div class="data-card-actions">' +
        '<button class="btn-view" onclick="showInvestorDetail(\'' + safeName.replace(/'/g, "\\'") + '\')">View Details</button>' +
        '<button class="btn-view" onclick="showInvestorOnMap(\'' + safeName.replace(/'/g, "\\'") + '\')">Show on Map</button>' +
      '</div>' +
    '</div>';
  });
  cards.innerHTML = html;
}

// Get filtered and sorted investors
function getFilteredInvestors() {
  let filtered = APP.investors;

  if (investorSearchText) {
    const q = investorSearchText.toLowerCase();
    filtered = filtered.filter(inv => {
      const name = (inv.name || inv.canonical_name || '').toLowerCase();
      const hood = (inv.top_neighborhood || (inv.neighborhoods && Object.keys(inv.neighborhoods).sort((a,b) => inv.neighborhoods[b] - inv.neighborhoods[a])[0]) || '').toLowerCase();
      return name.includes(q) || hood.includes(q) ||
        (inv.aliases || []).some(a => String(a).toLowerCase().includes(q));
    });
  }

  filtered.sort((a, b) => {
    let va = a[investorSortField];
    let vb = b[investorSortField];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va == null) va = investorSortDir === 'desc' ? -Infinity : Infinity;
    if (vb == null) vb = investorSortDir === 'desc' ? -Infinity : Infinity;
    if (va < vb) return investorSortDir === 'asc' ? -1 : 1;
    if (va > vb) return investorSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return filtered;
}

// Wire up search and sort controls
function wireInvestorControls() {
  const searchInput = document.getElementById('investor-search');
  if (searchInput && !searchInput._wired) {
    searchInput._wired = true;
    searchInput.addEventListener('input', (e) => {
      investorSearchText = e.target.value;
      renderInvestorTable();
      renderInvestorCards();
    });
  }

  const sortSelect = document.getElementById('investor-sort');
  if (sortSelect && !sortSelect._wired) {
    sortSelect._wired = true;
    sortSelect.addEventListener('change', (e) => {
      investorSortField = e.target.value;
      renderInvestorTable();
      renderInvestorCards();
    });
  }

  // Sort by clicking table headers
  document.querySelectorAll('#investor-table th').forEach((th, idx) => {
    const fields = ['', 'name', 'total_purchases', 'total_spend', 'top_neighborhood', 'last_purchase', 'is_accelerating', ''];
    if (fields[idx] && !th._wired) {
      th._wired = true;
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        if (investorSortField === fields[idx]) {
          investorSortDir = investorSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          investorSortField = fields[idx];
          investorSortDir = 'desc';
        }
        renderInvestorTable();
        renderInvestorCards();
      });
    }
  });
}

// Show investor detail panel
async function showInvestorDetail(investorName) {
  const detail = document.getElementById('investor-detail');
  const tableWrap = document.getElementById('investor-table-wrap');
  const searchBar = document.getElementById('investor-search-bar');
  const cardsWrap = document.getElementById('investor-cards');
  if (!detail) return;

  detail.classList.remove('hidden');
  if (tableWrap) tableWrap.classList.add('hidden');
  if (searchBar) searchBar.classList.add('hidden');
  if (cardsWrap) cardsWrap.classList.add('hidden');

  detail.innerHTML = '<div class="loading">Loading investor details...</div>';

  const inv = await fetchAPI('/api/investors/' + encodeURIComponent(investorName));
  if (!inv || inv.error) {
    detail.innerHTML = '<button class="btn btn-secondary" onclick="closeInvestorDetail()">Back to List</button>' +
      '<p>Investor not found.</p>';
    return;
  }

  const aliases = inv.aliases || [];
  const neighborhoods = inv.neighborhoods || {};
  const timeline = inv.timeline || [];
  const priceRange = inv.price_range || {};

  let html = '<button class="btn btn-secondary" onclick="closeInvestorDetail()">Back to List</button>';
  html += '<h2>' + escapeHtml(inv.name || inv.canonical_name || investorName) + '</h2>';

  // Stats grid
  html += '<div id="investor-detail-stats">';
  html += '<div class="stat-card"><div class="stat-label">Total Purchases</div><div class="stat-num">' + (inv.total_purchases || 0) + '</div></div>';
  html += '<div class="stat-card"><div class="stat-label">Total Spend</div><div class="stat-num">' + formatMoney(inv.total_spend) + '</div></div>';
  html += '<div class="stat-card"><div class="stat-label">Rank Score</div><div class="stat-num">' + (inv.rank_score || 0).toFixed(1) + '</div></div>';
  html += '<div class="stat-card"><div class="stat-label">First Purchase</div><div class="stat-num">' + formatDate(inv.first_purchase) + '</div></div>';
  html += '<div class="stat-card"><div class="stat-label">Last Purchase</div><div class="stat-num">' + formatDate(inv.last_purchase) + '</div></div>';
  html += '<div class="stat-card"><div class="stat-label">Accelerating</div><div class="stat-num">' + (inv.is_accelerating ? 'Yes' : 'No') + '</div></div>';
  html += '<div class="stat-card"><div class="stat-label">Price Range</div><div class="stat-num">' + (priceRange.min != null ? formatMoney(priceRange.min) + ' - ' + formatMoney(priceRange.max) : 'N/A') + '</div></div>';
  html += '<div class="stat-card"><div class="stat-label">Permits Filed</div><div class="stat-num">' + (inv.permits_filed || 0) + '</div></div>';
  html += '</div>';

  // Aliases
  if (aliases.length > 0) {
    html += '<div id="investor-detail-aliases"><h3>Linked Entities / Aliases</h3><div>';
    aliases.forEach(a => {
      html += '<span class="alias-tag">' + escapeHtml(String(a)) + '</span>';
    });
    html += '</div></div>';
  }

  // Neighborhoods breakdown
  const hoodEntries = Object.entries(neighborhoods).sort((a, b) => b[1] - a[1]);
  if (hoodEntries.length > 0) {
    html += '<div id="investor-detail-neighborhoods"><h3>Neighborhoods</h3><div class="hood-breakdown">';
    hoodEntries.forEach(([name, count]) => {
      html += '<div class="hood-row"><span class="hood-name">' + escapeHtml(name) + '</span><span class="hood-count">' + count + ' purchases</span></div>';
    });
    html += '</div></div>';
  }

  // Timeline chart
  html += '<div style="height:250px;margin:20px 0"><canvas id="investor-timeline-chart"></canvas></div>';

  // Transaction list
  if (timeline.length > 0) {
    html += '<h3 style="font-size:14px;font-weight:700;margin-bottom:8px">Transactions (' + timeline.length + ')</h3>';
    html += '<div class="table-scroll"><table class="inner-table"><thead><tr><th>#</th><th>Address</th><th>Price</th><th>Date</th></tr></thead><tbody>';
    timeline.forEach((tx, i) => {
      html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(tx.address || 'N/A') + '</td><td>' + formatMoney(tx.price) + '</td><td>' + formatDate(tx.date) + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  detail.innerHTML = html;

  // Create timeline chart
  if (timeline.length > 0 && typeof createInvestorTimelineChart === 'function') {
    createInvestorTimelineChart(timeline);
  }
}

// Close investor detail
function closeInvestorDetail() {
  const detail = document.getElementById('investor-detail');
  const tableWrap = document.getElementById('investor-table-wrap');
  const searchBar = document.getElementById('investor-search-bar');
  const cardsWrap = document.getElementById('investor-cards');
  if (detail) detail.classList.add('hidden');
  if (tableWrap) tableWrap.classList.remove('hidden');
  if (searchBar) searchBar.classList.remove('hidden');
  if (cardsWrap) cardsWrap.classList.remove('hidden');
}

// Show investor properties on map
async function showInvestorOnMap(investorName) {
  // Switch to map tab
  const mapBtn = document.querySelector('.tab-btn[data-tab="map"]');
  if (mapBtn) mapBtn.click();

  const inv = await fetchAPI('/api/investors/' + encodeURIComponent(investorName));
  if (!inv || inv.error) return;

  // Build property list from timeline with coords from sales
  const salesData = APP.data['sales'] || await fetchAPI('/api/sales?grantee=' + encodeURIComponent(investorName) + '&limit=500');
  const properties = salesData.filter(s => {
    const lat = s.latitude || s._lat;
    const lng = s.longitude || s._lng;
    return lat && lng;
  });

  if (typeof highlightInvestorProperties === 'function') {
    highlightInvestorProperties(investorName, properties);
  }
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
