// ============================================================
// Detroit Data Intelligence Platform - Deal Pipeline
// ============================================================

let pipelineLoaded = false;

async function loadPipeline() {
  const tbody = document.getElementById('pipeline-tbody');
  const cards = document.getElementById('pipeline-cards');
  if (!tbody && !cards) return;

  if (pipelineLoaded && APP.pipeline.length > 0 && ((tbody && tbody.children.length > 0) || (cards && cards.children.length > 0))) return;

  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading deal pipeline...</td></tr>';
  if (cards) cards.innerHTML = '<div class="loading">Loading deal pipeline...</div>';

  const minScore = document.getElementById('pipeline-min-score');
  const hoodFilter = document.getElementById('pipeline-neighborhood-filter');

  let url = '/api/pipeline?limit=500';
  if (minScore && minScore.value) url += '&min_score=' + minScore.value;
  if (hoodFilter && hoodFilter.value) url += '&neighborhood=' + encodeURIComponent(hoodFilter.value);

  const data = await fetchAPI(url);
  APP.pipeline = data || [];
  pipelineLoaded = true;

  renderPipelineStats();
  renderPipelineTable();
  renderPipelineCards();
  populatePipelineNeighborhoods();
  wirePipelineControls();
}

function renderPipelineStats() {
  const bar = document.getElementById('pipeline-stats-bar');
  if (!bar) return;

  const total = APP.pipeline.length;
  const avgScore = total > 0 ? (APP.pipeline.reduce((s, d) => s + (d.motivation_score || d.score || 0), 0) / total).toFixed(1) : 0;
  const withMatches = APP.pipeline.filter(d => d.match_count > 0).length;
  const highScore = APP.pipeline.filter(d => d.motivation_score || d.score >= 50).length;

  bar.innerHTML =
    '<div class="stats-row">' +
      '<span class="stat-pill">' + total + ' Properties</span>' +
      '<span class="stat-pill">Avg Score: ' + avgScore + '</span>' +
      '<span class="stat-pill">' + withMatches + ' With Matches</span>' +
      '<span class="stat-pill">' + highScore + ' High (50+)</span>' +
    '</div>';
}

function renderPipelineTable() {
  const tbody = document.getElementById('pipeline-tbody');
  if (!tbody) return;

  if (APP.pipeline.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No deals in pipeline. Adjust filters or wait for more data.</td></tr>';
    return;
  }

  let html = '';
  APP.pipeline.forEach(deal => {
    const scoreClass = deal.motivation_score || deal.score >= 50 ? 'score-high' :
                       deal.motivation_score || deal.score >= 30 ? 'score-mid' : 'score-low';

    let matchHtml = '';
    if (deal.top_matches && deal.top_matches.length > 0) {
      deal.top_matches.slice(0, 3).forEach(m => {
        matchHtml += '<span class="match-badge" title="Fit: ' + m.fit_score + '">' +
          escapeHtmlGlobal((m.investor_name || '').substring(0, 20)) +
          ' <small>(' + m.fit_score.toFixed(0) + ')</small></span>';
      });
      if (deal.match_count > 3) {
        matchHtml += '<span class="match-more">+' + (deal.match_count - 3) + ' more</span>';
      }
    } else {
      matchHtml = '<span class="no-match">No matches</span>';
    }

    html += '<tr>' +
      '<td><span class="score-badge ' + scoreClass + '">' + deal.motivation_score || deal.score + '</span></td>' +
      '<td>' + escapeHtmlGlobal(deal.address || 'N/A') + '</td>' +
      '<td>' + escapeHtmlGlobal(deal.owner || 'N/A') + '</td>' +
      '<td>' + escapeHtmlGlobal(deal.neighborhood || 'N/A') + '</td>' +
      '<td>' + formatMoney(deal.sale_price) + '<br><small>' + formatDate(deal.sale_date) + '</small></td>' +
      '<td><small>' + escapeHtmlGlobal(deal.signal_summary || '') + '</small></td>' +
      '<td class="match-cell">' + matchHtml + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = html;
}

function renderPipelineCards() {
  const cards = document.getElementById('pipeline-cards');
  if (!cards) return;

  if (APP.pipeline.length === 0) {
    cards.innerHTML = '<div class="empty-state">No deals in pipeline.</div>';
    return;
  }

  let html = '';
  APP.pipeline.forEach(deal => {
    const scoreClass = deal.motivation_score || deal.score >= 50 ? 'score-high' :
                       deal.motivation_score || deal.score >= 30 ? 'score-mid' : 'score-low';

    // Build match badges
    let matchHtml = '';
    if (deal.top_matches && deal.top_matches.length > 0) {
      deal.top_matches.slice(0, 3).forEach(m => {
        matchHtml += '<span class="match-badge">' +
          escapeHtmlGlobal((m.investor_name || '').substring(0, 18)) +
          ' <small>(' + m.fit_score.toFixed(0) + ')</small></span>';
      });
      if (deal.match_count > 3) {
        matchHtml += '<span class="match-more">+' + (deal.match_count - 3) + '</span>';
      }
    } else {
      matchHtml = '<span class="no-match">No matches</span>';
    }

    html += '<div class="data-card">' +
      '<div class="data-card-header">' +
        '<div class="data-card-title">' + escapeHtmlGlobal(deal.address || 'N/A') + '</div>' +
        '<span class="score-badge ' + scoreClass + '">' + deal.motivation_score || deal.score + '</span>' +
      '</div>' +
      '<div class="data-card-grid">' +
        '<div class="data-card-stat"><span class="data-card-label">Owner</span><span class="data-card-value">' + escapeHtmlGlobal(deal.owner || 'N/A') + '</span></div>' +
        '<div class="data-card-stat"><span class="data-card-label">Neighborhood</span><span class="data-card-value">' + escapeHtmlGlobal(deal.neighborhood || 'N/A') + '</span></div>' +
        '<div class="data-card-stat"><span class="data-card-label">Last Sale</span><span class="data-card-value">' + formatMoney(deal.sale_price) + '</span></div>' +
        '<div class="data-card-stat"><span class="data-card-label">Sale Date</span><span class="data-card-value">' + formatDate(deal.sale_date) + '</span></div>' +
      '</div>' +
      (deal.signal_summary ? '<div class="pipeline-card-signals">' + escapeHtmlGlobal(deal.signal_summary) + '</div>' : '') +
      '<div class="pipeline-card-matches">' + matchHtml + '</div>' +
    '</div>';
  });
  cards.innerHTML = html;
}

function populatePipelineNeighborhoods() {
  const select = document.getElementById('pipeline-neighborhood-filter');
  if (!select || select.children.length > 1) return;

  const hoods = new Set();
  APP.pipeline.forEach(d => {
    if (d.neighborhood) hoods.add(d.neighborhood);
  });

  const sorted = [...hoods].sort();
  sorted.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    select.appendChild(opt);
  });
}

function wirePipelineControls() {
  const applyBtn = document.getElementById('pipeline-apply');
  if (applyBtn && !applyBtn._wired) {
    applyBtn._wired = true;
    applyBtn.addEventListener('click', () => {
      pipelineLoaded = false;
      loadPipeline();
    });
  }

  const exportBtn = document.getElementById('pipeline-export');
  if (exportBtn && !exportBtn._wired) {
    exportBtn._wired = true;
    exportBtn.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = '/api/export/pipeline';
      link.download = 'deal_pipeline.csv';
      link.click();
    });
  }
}
