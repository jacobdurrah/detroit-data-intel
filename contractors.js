// ============================================================
// Detroit Data Intelligence Platform - Contractor Intelligence
// ============================================================

let contractorSearchText = '';
let contractorSpecialtyFilter = '';

async function loadContractors() {
  const tbody = document.getElementById('contractor-tbody');
  const cards = document.getElementById('contractor-cards');
  if (!tbody && !cards) return;

  // Avoid reloading if already populated
  if (APP.contractors.length > 0 && ((tbody && tbody.children.length > 0) || (cards && cards.children.length > 0))) return;

  if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="loading">Loading contractors...</td></tr>';
  if (cards) cards.innerHTML = '<div class="loading">Loading contractors...</div>';

  let url = '/api/contractors?top=500';
  const data = await fetchAPI(url);
  APP.contractors = data || [];

  renderContractorStats();
  renderContractorTable();
  renderContractorCards();
  wireContractorControls();
}

function renderContractorStats() {
  const bar = document.getElementById('contractor-stats-bar');
  if (!bar || APP.contractors.length === 0) return;

  const total = APP.contractors.length;
  const totalPermits = APP.contractors.reduce((s, c) => s + (c.total_permits || 0), 0);
  const totalProps = APP.contractors.reduce((s, c) => s + (c.properties_served || 0), 0);

  // Count specialties
  const specs = {};
  APP.contractors.forEach(c => {
    Object.keys(c.specialties || {}).forEach(s => {
      specs[s] = (specs[s] || 0) + c.specialties[s];
    });
  });
  const topSpec = Object.entries(specs).sort((a, b) => b[1] - a[1])[0];

  bar.innerHTML =
    '<div class="stats-row">' +
      '<span class="stat-pill">' + total + ' Contractors</span>' +
      '<span class="stat-pill">' + totalPermits.toLocaleString() + ' Total Permits</span>' +
      '<span class="stat-pill">' + totalProps.toLocaleString() + ' Properties Served</span>' +
      (topSpec ? '<span class="stat-pill">Top: ' + escapeHtmlGlobal(topSpec[0]) + ' (' + topSpec[1].toLocaleString() + ')</span>' : '') +
    '</div>';
}

function getFilteredContractors() {
  let filtered = APP.contractors;

  if (contractorSearchText) {
    const q = contractorSearchText.toLowerCase();
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.contact_name || '').toLowerCase().includes(q) ||
      (c.top_neighborhood || '').toLowerCase().includes(q)
    );
  }

  if (contractorSpecialtyFilter) {
    const q = contractorSpecialtyFilter.toLowerCase();
    filtered = filtered.filter(c =>
      Object.keys(c.specialties || {}).some(s => s.toLowerCase().includes(q))
    );
  }

  return filtered;
}

function renderContractorTable() {
  const tbody = document.getElementById('contractor-tbody');
  if (!tbody) return;

  let filtered = getFilteredContractors();

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No contractors found.</td></tr>';
    return;
  }

  let html = '';
  filtered.slice(0, 200).forEach((c, idx) => {
    html += '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td class="contractor-name-cell">' + escapeHtmlGlobal(c.name || 'N/A') + '</td>' +
      '<td>' + escapeHtmlGlobal(c.contact_name || '-') + '</td>' +
      '<td>' + (c.total_permits || 0).toLocaleString() + '</td>' +
      '<td>' + (c.properties_served || 0).toLocaleString() + '</td>' +
      '<td>' + (c.neighborhoods_served || 0) + '</td>' +
      '<td>' + escapeHtmlGlobal(c.top_specialty || 'N/A') + '</td>' +
      '<td>' + escapeHtmlGlobal(c.top_neighborhood || 'N/A') + '</td>' +
      '<td><button class="btn-view" onclick="showContractorDetail(' + idx + ')">View</button></td>' +
    '</tr>';
  });
  tbody.innerHTML = html;
}

function renderContractorCards() {
  const cards = document.getElementById('contractor-cards');
  if (!cards) return;

  let filtered = getFilteredContractors();

  if (filtered.length === 0) {
    cards.innerHTML = '<div class="empty-state">No contractors found.</div>';
    return;
  }

  let html = '';
  filtered.slice(0, 200).forEach((c, idx) => {
    html += '<div class="data-card">' +
      '<div class="data-card-header">' +
        '<div class="data-card-title">' + escapeHtmlGlobal(c.name || 'N/A') + '</div>' +
        '<span class="data-card-rank">#' + (idx + 1) + '</span>' +
      '</div>' +
      '<div class="data-card-grid">' +
        '<div class="data-card-stat"><span class="data-card-label">Permits</span><span class="data-card-value">' + (c.total_permits || 0).toLocaleString() + '</span></div>' +
        '<div class="data-card-stat"><span class="data-card-label">Properties</span><span class="data-card-value">' + (c.properties_served || 0).toLocaleString() + '</span></div>' +
        '<div class="data-card-stat"><span class="data-card-label">Specialty</span><span class="data-card-value">' + escapeHtmlGlobal(c.top_specialty || 'N/A') + '</span></div>' +
        '<div class="data-card-stat"><span class="data-card-label">Top Area</span><span class="data-card-value">' + escapeHtmlGlobal(c.top_neighborhood || 'N/A') + '</span></div>' +
      '</div>' +
      (c.contact_name ? '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Contact: ' + escapeHtmlGlobal(c.contact_name) + '</div>' : '') +
      '<div class="data-card-actions">' +
        '<button class="btn-view" onclick="showContractorDetail(' + idx + ')">View Details</button>' +
      '</div>' +
    '</div>';
  });
  cards.innerHTML = html;
}

function wireContractorControls() {
  const search = document.getElementById('contractor-search');
  if (search && !search._wired) {
    search._wired = true;
    search.addEventListener('input', (e) => {
      contractorSearchText = e.target.value;
      renderContractorTable();
      renderContractorCards();
    });
  }

  const specialty = document.getElementById('contractor-specialty-filter');
  if (specialty && !specialty._wired) {
    specialty._wired = true;
    specialty.addEventListener('change', (e) => {
      contractorSpecialtyFilter = e.target.value;
      renderContractorTable();
      renderContractorCards();
    });
  }
}

function showContractorDetail(idx) {
  const c = APP.contractors[idx];
  if (!c) return;

  const detail = document.getElementById('contractor-detail');
  const tableWrap = document.getElementById('contractor-table-wrap');
  const cardsWrap = document.getElementById('contractor-cards');
  const statsBar = document.getElementById('contractor-stats-bar');
  if (!detail) return;

  detail.classList.remove('hidden');
  if (tableWrap) tableWrap.classList.add('hidden');
  if (cardsWrap) cardsWrap.classList.add('hidden');
  if (statsBar) statsBar.classList.add('hidden');

  let html = '<button class="btn btn-secondary" onclick="closeContractorDetail()">Back to List</button>';
  html += '<h2 style="font-size:18px;font-weight:700;margin:12px 0 16px">' + escapeHtmlGlobal(c.name) + '</h2>';

  // Stats
  html += '<div class="detail-stats-grid">';
  html += '<div class="stat-card"><div class="stat-label">Total Permits</div><div class="stat-num">' + (c.total_permits || 0) + '</div></div>';
  html += '<div class="stat-card"><div class="stat-label">Properties Served</div><div class="stat-num">' + (c.properties_served || 0) + '</div></div>';
  html += '<div class="stat-card"><div class="stat-label">Neighborhoods</div><div class="stat-num">' + (c.neighborhoods_served || 0) + '</div></div>';
  if (c.contact_name) html += '<div class="stat-card"><div class="stat-label">Contact</div><div class="stat-num" style="font-size:14px">' + escapeHtmlGlobal(c.contact_name) + '</div></div>';
  if (c.address) html += '<div class="stat-card"><div class="stat-label">Address</div><div class="stat-num" style="font-size:14px">' + escapeHtmlGlobal(c.address) + '</div></div>';
  html += '</div>';

  // Specialties
  const specEntries = Object.entries(c.specialties || {}).sort((a, b) => b[1] - a[1]);
  if (specEntries.length > 0) {
    html += '<h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-secondary);margin-bottom:8px">Specialties</h3><div class="hood-breakdown">';
    specEntries.forEach(([name, count]) => {
      html += '<div class="hood-row"><span class="hood-name">' + escapeHtmlGlobal(name) + '</span><span class="hood-count">' + count + ' permits</span></div>';
    });
    html += '</div>';
  }

  // Neighborhoods
  const hoodEntries = Object.entries(c.neighborhoods || {}).sort((a, b) => b[1] - a[1]);
  if (hoodEntries.length > 0) {
    html += '<h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-secondary);margin:12px 0 8px">Neighborhoods</h3><div class="hood-breakdown">';
    hoodEntries.slice(0, 20).forEach(([name, count]) => {
      html += '<div class="hood-row"><span class="hood-name">' + escapeHtmlGlobal(name) + '</span><span class="hood-count">' + count + ' permits</span></div>';
    });
    html += '</div>';
  }

  // Recent permits
  const permits = c.recent_permits || [];
  if (permits.length > 0) {
    html += '<h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-secondary);margin:12px 0 8px">Recent Permits (' + permits.length + ')</h3>';
    html += '<div class="table-scroll"><table class="inner-table"><thead><tr><th>ID</th><th>Address</th><th>Type</th><th>Date</th><th>Work</th></tr></thead><tbody>';
    permits.forEach(p => {
      html += '<tr>' +
        '<td>' + escapeHtmlGlobal(p.record_id || '') + '</td>' +
        '<td>' + escapeHtmlGlobal(p.address || '') + '</td>' +
        '<td>' + escapeHtmlGlobal(p.permit_type || '') + '</td>' +
        '<td>' + formatDate(p.issued_date) + '</td>' +
        '<td>' + escapeHtmlGlobal((p.work_description || '').substring(0, 80)) + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
  }

  detail.innerHTML = html;
}

function closeContractorDetail() {
  const detail = document.getElementById('contractor-detail');
  const tableWrap = document.getElementById('contractor-table-wrap');
  const cardsWrap = document.getElementById('contractor-cards');
  const statsBar = document.getElementById('contractor-stats-bar');
  if (detail) detail.classList.add('hidden');
  if (tableWrap) tableWrap.classList.remove('hidden');
  if (cardsWrap) cardsWrap.classList.remove('hidden');
  if (statsBar) statsBar.classList.remove('hidden');
}
