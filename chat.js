// ============================================================
// Detroit Data Intel - Chat with the Data Engine
// Natural language → structured queries → formatted results
// ============================================================

const CHAT = {
  history: [],
  isOpen: false,
  data: {} // cached references
};

// Initialize chat UI
function initChat() {
  const chatBtn = document.createElement('div');
  chatBtn.id = 'chat-fab';
  chatBtn.innerHTML = '💬';
  chatBtn.title = 'Chat with the data';
  chatBtn.onclick = toggleChat;
  document.body.appendChild(chatBtn);

  const chatPanel = document.createElement('div');
  chatPanel.id = 'chat-panel';
  chatPanel.classList.add('chat-hidden');
  chatPanel.innerHTML = `
    <div class="chat-header">
      <span>🔍 Ask the Data</span>
      <button onclick="toggleChat()" class="chat-close">✕</button>
    </div>
    <div id="chat-messages" class="chat-messages">
      <div class="chat-msg bot">
        <div class="chat-bubble">Ask me anything about Detroit real estate. Try:
        <ul>
          <li>"Who is Hantz Woodlands?"</li>
          <li>"What neighborhood has the most infills?"</li>
          <li>"Who lends under $60K?"</li>
          <li>"Show me properties sold under $50K in Corktown"</li>
          <li>"What contractors work in Warrendale?"</li>
          <li>"Compare Bagley vs Warrendale"</li>
        </ul></div>
      </div>
    </div>
    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="Ask about investors, neighborhoods, lenders..." 
             onkeydown="if(event.key==='Enter')sendChat()">
      <button onclick="sendChat()" class="chat-send">→</button>
    </div>
  `;
  document.body.appendChild(chatPanel);
}

function toggleChat() {
  const panel = document.getElementById('chat-panel');
  CHAT.isOpen = !CHAT.isOpen;
  panel.classList.toggle('chat-hidden');
  if (CHAT.isOpen) document.getElementById('chat-input').focus();
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';

  addChatMsg('user', q);
  addChatMsg('bot', '<div class="chat-loading">Searching data...</div>');

  try {
    const result = await processQuery(q);
    // Replace loading message
    const msgs = document.getElementById('chat-messages');
    msgs.removeChild(msgs.lastChild);
    addChatMsg('bot', result.html);
    if (result.mapData) {
      addMapButton(result.mapData, result.mapLabel || 'Show on map');
    }
  } catch(e) {
    const msgs = document.getElementById('chat-messages');
    msgs.removeChild(msgs.lastChild);
    addChatMsg('bot', 'Sorry, I couldn\'t process that query. Try rephrasing.');
    console.error('Chat error:', e);
  }
}

function addChatMsg(role, html) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.innerHTML = '<div class="chat-bubble">' + html + '</div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addMapButton(data, label) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.innerHTML = '<div class="chat-bubble"><button class="chat-map-btn" onclick=\'showOnMap(' + 
    JSON.stringify(data).replace(/'/g, "\\'") + ')\'> 🗺️ ' + label + ' (' + data.length + ' properties)</button></div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showOnMap(points) {
  // Switch to map tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="map"]').classList.add('active');
  document.getElementById('tab-map').classList.add('active');
  if (APP.map) APP.map.invalidateSize();

  // Clear existing chat markers
  if (APP.chatLayer) APP.map.removeLayer(APP.chatLayer);
  APP.chatLayer = L.layerGroup().addTo(APP.map);

  const bounds = [];
  points.forEach(p => {
    if (!p.lat || !p.lng) return;
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 8, fillColor: '#f59e0b', color: '#fff', weight: 2, fillOpacity: 0.9
    });
    let popup = '<div class="map-popup"><h4>' + (p.address || 'Property') + '</h4>';
    if (p.price) popup += '<p><strong>Price:</strong> $' + Number(p.price).toLocaleString() + '</p>';
    if (p.buyer) popup += '<p><strong>Buyer:</strong> ' + p.buyer + '</p>';
    if (p.seller) popup += '<p><strong>Seller:</strong> ' + p.seller + '</p>';
    if (p.date) popup += '<p><strong>Date:</strong> ' + p.date + '</p>';
    if (p.neighborhood) popup += '<p><strong>Neighborhood:</strong> ' + p.neighborhood + '</p>';
    if (p.info) popup += '<p>' + p.info + '</p>';
    popup += '</div>';
    marker.bindPopup(popup);
    marker.addTo(APP.chatLayer);
    bounds.push([p.lat, p.lng]);
  });

  if (bounds.length > 0) {
    APP.map.fitBounds(bounds, {padding: [30, 30], maxZoom: 15});
  }
}

// ============================================================
// Query Processing Engine
// ============================================================

async function processQuery(q) {
  const lower = q.toLowerCase();
  
  // Ensure data is loaded
  if (!CHAT.data.sales) {
    CHAT.data.sales = await fetchAPI('/api/sales');
    CHAT.data.investors = await fetchAPI('/api/investors');
    CHAT.data.contractors = await fetchAPI('/api/contractors');
    CHAT.data.neighborhoods = await fetchAPI('/api/neighborhoods');
    CHAT.data.lending = await fetchAPI('/api/lending');
    CHAT.data.sellers = await fetchAPI('/api/motivated-sellers');
  }

  // Classify query
  if (matchPattern(lower, ['who is', 'tell me about', 'look up', 'info on', 'what about'])) {
    return queryEntityLookup(lower, q);
  }
  if (matchPattern(lower, ['sold to', 'bought from', 'sell to', 'who did .* sell', 'who did .* buy'])) {
    return queryEntityRelationships(lower, q);
  }
  if (matchPattern(lower, ['lend', 'financ', 'mortgage', 'loan', 'rate', 'refi'])) {
    return queryLending(lower, q);
  }
  if (matchPattern(lower, ['contractor', 'who built', 'who does work', 'hvac', 'plumb', 'electric'])) {
    return queryContractors(lower, q);
  }
  if (matchPattern(lower, ['compare', ' vs ', 'versus', 'better'])) {
    return queryCompare(lower, q);
  }
  if (matchPattern(lower, ['infill', 'new construction', 'new house', 'new building', 'newest', 'being built'])) {
    return queryNewConstruction(lower, q);
  }
  if (matchPattern(lower, ['most', 'top', 'best', 'worst', 'highest', 'lowest', 'fastest'])) {
    return queryNeighborhoodRanking(lower, q);
  }
  if (matchPattern(lower, ['sold', 'bought', 'properties', 'sales', 'under \\$', 'over \\$', 'between'])) {
    return querySalesFilter(lower, q);
  }
  if (matchPattern(lower, ['motivated', 'distress', 'foreclos', 'tax lien', 'vacant', 'abandon'])) {
    return queryMotivatedSellers(lower, q);
  }
  
  // Default: try entity lookup, then sales search
  return queryEntityLookup(lower, q);
}

function matchPattern(text, patterns) {
  return patterns.some(p => new RegExp(p, 'i').test(text));
}

function extractName(lower, q) {
  // Remove common prefixes
  let name = q;
  ['who is', 'tell me about', 'look up', 'info on', 'what about', 'what does', 'where does', 'show me'].forEach(p => {
    name = name.replace(new RegExp('^' + p + '\\s*', 'i'), '');
  });
  // Remove trailing ? and trim
  name = name.replace(/[?!.]+$/, '').trim();
  return name;
}

function extractNeighborhood(lower) {
  if (!CHAT.data.neighborhoods) return null;
  const hoods = Array.isArray(CHAT.data.neighborhoods) ? CHAT.data.neighborhoods : [];
  for (const h of hoods) {
    const hName = (h.name || h.neighborhood || '').toLowerCase();
    if (hName && lower.includes(hName)) return h;
  }
  return null;
}

function extractPrice(lower) {
  const m = lower.match(/(?:under|below|less than|<)\s*\$?([\d,]+k?)/i);
  if (m) {
    let val = m[1].replace(/,/g, '');
    if (val.endsWith('k')) val = parseFloat(val) * 1000;
    return {max: parseFloat(val)};
  }
  const m2 = lower.match(/(?:over|above|more than|>)\s*\$?([\d,]+k?)/i);
  if (m2) {
    let val = m2[1].replace(/,/g, '');
    if (val.endsWith('k')) val = parseFloat(val) * 1000;
    return {min: parseFloat(val)};
  }
  return null;
}

function formatDollars(n) {
  if (!n && n !== 0) return 'N/A';
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + (n/1000).toFixed(0) + 'K';
  return '$' + Number(n).toLocaleString();
}

// ============================================================
// Query Handlers
// ============================================================

function queryEntityLookup(lower, q) {
  const name = extractName(lower, q).toLowerCase();
  const investors = CHAT.data.investors || [];
  
  // Search by canonical name, aliases
  let match = investors.find(i => 
    (i.canonical_name || '').toLowerCase().includes(name) ||
    (i.name || '').toLowerCase().includes(name) ||
    (i.aliases || []).some(a => a.toLowerCase().includes(name))
  );
  
  if (!match) {
    // Fuzzy: check sales data for any grantee match
    const sales = CHAT.data.sales || [];
    const matched = sales.filter(s => (s.grantee || '').toLowerCase().includes(name));
    if (matched.length > 0) {
      const totalSpend = matched.reduce((s, r) => s + (r.amt_sale_price || 0), 0);
      const hoods = {};
      matched.forEach(s => { if(s.neighborhood) hoods[s.neighborhood] = (hoods[s.neighborhood]||0) + 1; });
      const topHood = Object.entries(hoods).sort((a,b) => b[1] - a[1])[0];
      return {
        html: `<strong>${q}</strong><br>Found <strong>${matched.length}</strong> property purchases<br>
          Total spend: <strong>${formatDollars(totalSpend)}</strong><br>
          Top neighborhood: <strong>${topHood ? topHood[0] + ' (' + topHood[1] + ')' : 'N/A'}</strong>`,
        mapData: matched.slice(0, 200).map(s => ({
          lat: s.latitude, lng: s.longitude, address: s.address,
          price: s.amt_sale_price, buyer: s.grantee, seller: s.grantor,
          date: s.sale_date, neighborhood: s.neighborhood
        })),
        mapLabel: 'Show purchases on map'
      };
    }
    return {html: 'No investor or entity found matching "' + escapeHtml(name) + '". Try a company name like "Hantz" or "Artesian".'};
  }

  // Build profile card
  const inv = match;
  const topHoods = Object.entries(inv.neighborhoods || {}).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const aliases = (inv.aliases || []).slice(0, 5).join(', ');
  
  let html = `<div class="chat-profile">
    <h3>${escapeHtml(inv.canonical_name || inv.name || 'Unknown')}</h3>
    ${aliases ? '<p class="chat-aliases">Also: ' + escapeHtml(aliases) + '</p>' : ''}
    <div class="chat-stats-grid">
      <div><strong>${inv.total_purchases || 0}</strong><br>Purchases</div>
      <div><strong>${formatDollars(inv.total_spend)}</strong><br>Total Spend</div>
      <div><strong>${inv.investment_tier || 'N/A'}</strong><br>Tier</div>
      <div><strong>${inv.is_accelerating ? '🚀 Yes' : 'No'}</strong><br>Accelerating</div>
    </div>
    <p><strong>Price Range:</strong> ${formatDollars(inv.price_range?.min)} – ${formatDollars(inv.price_range?.max)}</p>
    <p><strong>Active:</strong> ${inv.first_purchase?.split('T')[0] || '?'} → ${inv.last_purchase?.split('T')[0] || '?'}</p>
    <p><strong>Top Neighborhoods:</strong></p>
    <ul>${topHoods.map(([h,c]) => '<li>' + escapeHtml(h) + ': ' + c + ' purchases</li>').join('')}</ul>
  </div>`;

  // Get map data from sales
  const sales = CHAT.data.sales || [];
  const entitySales = sales.filter(s => {
    const g = (s.grantee || '').toLowerCase();
    return (inv.aliases || []).some(a => g === a.toLowerCase()) || g.includes(name);
  });

  return {
    html,
    mapData: entitySales.slice(0, 500).map(s => ({
      lat: s.latitude, lng: s.longitude, address: s.address,
      price: s.amt_sale_price, buyer: s.grantee, date: s.sale_date, neighborhood: s.neighborhood
    })),
    mapLabel: 'Show ' + (inv.canonical_name || 'their') + ' properties'
  };
}

function queryEntityRelationships(lower, q) {
  const name = extractName(lower, q).toLowerCase();
  const sales = CHAT.data.sales || [];
  
  // Find sales where entity is the SELLER (grantor)
  const soldBy = sales.filter(s => (s.grantor || '').toLowerCase().includes(name));
  
  if (soldBy.length === 0) {
    return {html: 'No sales found where "' + escapeHtml(name) + '" is the seller.'};
  }

  // Who did they sell to?
  const buyers = {};
  soldBy.forEach(s => {
    const buyer = s.grantee || 'Unknown';
    if (!buyers[buyer]) buyers[buyer] = {count: 0, total: 0, props: []};
    buyers[buyer].count++;
    buyers[buyer].total += s.amt_sale_price || 0;
    buyers[buyer].props.push(s);
  });

  const topBuyers = Object.entries(buyers).sort((a,b) => b[1].count - a[1].count).slice(0, 15);
  
  let html = `<strong>${escapeHtml(q)}</strong><br>
    Found <strong>${soldBy.length}</strong> sales as seller.<br><br>
    <strong>Top buyers from them:</strong>
    <table class="chat-table">
    <tr><th>Buyer</th><th>Purchases</th><th>Total Paid</th></tr>
    ${topBuyers.map(([name, d]) => 
      '<tr><td>' + escapeHtml(name) + '</td><td>' + d.count + '</td><td>' + formatDollars(d.total) + '</td></tr>'
    ).join('')}
    </table>`;

  return {
    html,
    mapData: soldBy.slice(0, 200).map(s => ({
      lat: s.latitude, lng: s.longitude, address: s.address,
      price: s.amt_sale_price, buyer: s.grantee, seller: s.grantor,
      date: s.sale_date, neighborhood: s.neighborhood
    })),
    mapLabel: 'Show properties they sold'
  };
}

function queryLending(lower, q) {
  const lenders = CHAT.data.lending || [];
  let filtered = [...lenders];
  let description = '';

  if (matchPattern(lower, ['under \\$60', 'below \\$60', 'sub.?60', 'small loan', 'under 60'])) {
    filtered = filtered.filter(l => l.sub_60k_loans > 0).sort((a,b) => b.sub_60k_loans - a.sub_60k_loans);
    description = 'Lenders that originate loans under $60K in Detroit:';
  } else if (matchPattern(lower, ['invest', 'rental', 'non.?owner'])) {
    filtered = filtered.filter(l => l.investment_loans > 0).sort((a,b) => b.investment_loans - a.investment_loans);
    description = 'Lenders that finance investment/rental properties:';
  } else if (matchPattern(lower, ['multi.?family', '5.?unit', 'apartment', '2-4', 'duplex', 'triplex'])) {
    filtered = filtered.filter(l => l.does_multifamily).sort((a,b) => b.total_loans - a.total_loans);
    description = 'Lenders that do multifamily (2+ unit) lending:';
  } else if (matchPattern(lower, ['fha'])) {
    filtered = filtered.filter(l => (l.loan_types?.FHA || 0) > 0).sort((a,b) => (b.loan_types?.FHA || 0) - (a.loan_types?.FHA || 0));
    description = 'FHA lenders in Detroit:';
  } else if (matchPattern(lower, ['rate', 'lowest rate', 'best rate', 'cheap'])) {
    filtered = filtered.filter(l => l.avg_rate > 0 && l.total_loans >= 10).sort((a,b) => a.avg_rate - b.avg_rate);
    description = 'Lenders by lowest average rate (10+ loans):';
  } else if (matchPattern(lower, ['refi', 'refinanc', 'cash.?out'])) {
    filtered = filtered.filter(l => (l.purposes?.Refinance || 0) + (l.purposes?.['Cash-out Refi'] || 0) > 0)
      .sort((a,b) => ((b.purposes?.Refinance || 0) + (b.purposes?.['Cash-out Refi'] || 0)) - 
                      ((a.purposes?.Refinance || 0) + (a.purposes?.['Cash-out Refi'] || 0)));
    description = 'Lenders doing refinances/cash-out refis:';
  } else {
    filtered.sort((a,b) => b.total_loans - a.total_loans);
    description = 'Top lenders in Detroit by volume:';
  }

  const top = filtered.slice(0, 15);
  let html = `<strong>${description}</strong><br><br>
    <table class="chat-table">
    <tr><th>Lender</th><th>Loans</th><th>Avg Rate</th><th>Avg Amount</th><th>Sub-$60K</th><th>Investment</th></tr>
    ${top.map(l => 
      '<tr><td>' + escapeHtml(l.name || l.lei) + '</td>' +
      '<td>' + l.total_loans + '</td>' +
      '<td>' + (l.avg_rate ? l.avg_rate.toFixed(2) + '%' : 'N/A') + '</td>' +
      '<td>' + formatDollars(l.avg_amount) + '</td>' +
      '<td>' + (l.sub_60k_loans || 0) + '</td>' +
      '<td>' + (l.investment_loans || 0) + '</td></tr>'
    ).join('')}
    </table>
    <p><small>Source: HMDA 2023 data (${filtered.length} matching lenders)</small></p>`;

  return {html};
}

function queryContractors(lower, q) {
  const contractors = CHAT.data.contractors || [];
  let filtered = [...contractors];
  
  const hood = extractNeighborhood(lower);
  if (hood) {
    const hoodName = (hood.name || hood.neighborhood || '').toLowerCase();
    filtered = filtered.filter(c => {
      const hoods = c.neighborhoods || {};
      return Object.keys(hoods).some(h => h.toLowerCase().includes(hoodName));
    });
  }

  if (matchPattern(lower, ['hvac', 'heat', 'furnace', 'ac ', 'cooling'])) {
    filtered = filtered.filter(c => (c.top_specialty || '').toLowerCase().includes('mechanical'));
  } else if (matchPattern(lower, ['plumb'])) {
    filtered = filtered.filter(c => (c.top_specialty || '').toLowerCase().includes('plumbing'));
  } else if (matchPattern(lower, ['electric'])) {
    filtered = filtered.filter(c => (c.top_specialty || '').toLowerCase().includes('electric'));
  }

  filtered.sort((a,b) => b.total_permits - a.total_permits);
  const top = filtered.slice(0, 15);

  let html = `<strong>Contractors${hood ? ' in ' + (hood.name || hood.neighborhood) : ''}:</strong><br><br>
    <table class="chat-table">
    <tr><th>Company</th><th>Contact</th><th>Permits</th><th>Specialty</th><th>Top Area</th></tr>
    ${top.map(c => 
      '<tr><td>' + escapeHtml(c.name || 'Unknown') + '</td>' +
      '<td>' + escapeHtml(c.contact_name || '—') + '</td>' +
      '<td>' + c.total_permits + '</td>' +
      '<td>' + escapeHtml(c.top_specialty || 'General') + '</td>' +
      '<td>' + escapeHtml(c.top_neighborhood || 'N/A') + '</td></tr>'
    ).join('')}
    </table>`;

  return {html};
}

function queryCompare(lower, q) {
  const hoods = CHAT.data.neighborhoods || [];
  // Extract two neighborhood names from query
  const parts = lower.split(/\bvs\.?\b|\bversus\b|\bcompare\b|\band\b|\bto\b/).map(s => s.trim()).filter(Boolean);
  
  if (parts.length < 2) return {html: 'Please name two neighborhoods to compare, e.g. "Compare Bagley vs Warrendale"'};
  
  const find = (name) => hoods.find(h => (h.name || h.neighborhood || '').toLowerCase().includes(name));
  const h1 = find(parts[0]);
  const h2 = find(parts[1]);

  if (!h1 || !h2) return {html: 'Could not find both neighborhoods. Try exact names.'};

  const n1 = h1.name || h1.neighborhood;
  const n2 = h2.name || h2.neighborhood;

  let html = `<strong>${escapeHtml(n1)} vs ${escapeHtml(n2)}</strong><br><br>
    <table class="chat-table">
    <tr><th>Metric</th><th>${escapeHtml(n1)}</th><th>${escapeHtml(n2)}</th></tr>
    <tr><td>Momentum Score</td><td><strong>${h1.score || h1.momentum_score || 'N/A'}</strong></td><td><strong>${h2.score || h2.momentum_score || 'N/A'}</strong></td></tr>
    <tr><td>Total Sales</td><td>${h1.total_sales || 'N/A'}</td><td>${h2.total_sales || 'N/A'}</td></tr>
    <tr><td>Median Price</td><td>${formatDollars(h1.median_price)}</td><td>${formatDollars(h2.median_price)}</td></tr>
    <tr><td>Permits</td><td>${h1.total_permits || 'N/A'}</td><td>${h2.total_permits || 'N/A'}</td></tr>
    <tr><td>Blight Tickets</td><td>${h1.total_blight || 'N/A'}</td><td>${h2.total_blight || 'N/A'}</td></tr>
    <tr><td>Rentals</td><td>${h1.total_rentals || 'N/A'}</td><td>${h2.total_rentals || 'N/A'}</td></tr>
    </table>`;

  return {html};
}

function queryNewConstruction(lower, q) {
  const permits = CHAT.data.permits || [];
  // Note: we don't have permits in CHAT.data yet - fetch if needed
  // For now search sales for property_class_description containing "NEW"
  const sales = CHAT.data.sales || [];
  
  // Look for permit_type containing 'new' or construction keywords
  // We'll filter on what we have
  let html = `<strong>New Construction / Infill Activity</strong><br><br>
    <p>Checking permit data for new construction...</p>`;
  
  // Search investors who buy then permit (buy-and-build pattern)
  const investors = CHAT.data.investors || [];
  const builders = investors.filter(i => (i.permits_filed || 0) > 5)
    .sort((a,b) => (b.permits_filed || 0) - (a.permits_filed || 0))
    .slice(0, 10);

  if (builders.length > 0) {
    html += `<br><strong>Top Buy-and-Build Investors (purchases + permits):</strong>
    <table class="chat-table">
    <tr><th>Investor</th><th>Purchases</th><th>Permits Filed</th><th>Top Area</th></tr>
    ${builders.map(b => {
      const topHood = Object.entries(b.neighborhoods || {}).sort((a,b) => b[1] - a[1])[0];
      return '<tr><td>' + escapeHtml(b.canonical_name || b.name || '?') + '</td>' +
        '<td>' + b.total_purchases + '</td>' +
        '<td>' + (b.permits_filed || 0) + '</td>' +
        '<td>' + (topHood ? escapeHtml(topHood[0]) : 'N/A') + '</td></tr>';
    }).join('')}
    </table>`;
  }

  return {html};
}

function queryNeighborhoodRanking(lower, q) {
  const hoods = CHAT.data.neighborhoods || [];
  if (!Array.isArray(hoods) || hoods.length === 0) return {html: 'No neighborhood data loaded.'};

  let sorted = [...hoods];
  let metric = 'momentum score';

  if (matchPattern(lower, ['most sales', 'most sold', 'most active'])) {
    sorted.sort((a,b) => (b.total_sales || 0) - (a.total_sales || 0));
    metric = 'sales volume';
  } else if (matchPattern(lower, ['most expensive', 'highest price', 'priciest'])) {
    sorted.sort((a,b) => (b.median_price || 0) - (a.median_price || 0));
    metric = 'median price';
  } else if (matchPattern(lower, ['cheapest', 'lowest price', 'affordable'])) {
    sorted = sorted.filter(h => (h.median_price || 0) > 0);
    sorted.sort((a,b) => (a.median_price || 0) - (b.median_price || 0));
    metric = 'lowest median price';
  } else if (matchPattern(lower, ['most permits', 'most construction', 'most development'])) {
    sorted.sort((a,b) => (b.total_permits || 0) - (a.total_permits || 0));
    metric = 'permit activity';
  } else if (matchPattern(lower, ['most blight', 'worst blight'])) {
    sorted.sort((a,b) => (b.total_blight || 0) - (a.total_blight || 0));
    metric = 'blight volume';
  } else {
    sorted.sort((a,b) => (b.score || b.momentum_score || 0) - (a.score || a.momentum_score || 0));
  }

  const top = sorted.slice(0, 15);
  let html = `<strong>Top neighborhoods by ${metric}:</strong><br><br>
    <table class="chat-table">
    <tr><th>#</th><th>Neighborhood</th><th>Score</th><th>Sales</th><th>Med Price</th><th>Permits</th></tr>
    ${top.map((h, i) => 
      '<tr><td>' + (i+1) + '</td>' +
      '<td>' + escapeHtml(h.name || h.neighborhood || '?') + '</td>' +
      '<td>' + (h.score || h.momentum_score || 'N/A') + '</td>' +
      '<td>' + (h.total_sales || 'N/A') + '</td>' +
      '<td>' + formatDollars(h.median_price) + '</td>' +
      '<td>' + (h.total_permits || 'N/A') + '</td></tr>'
    ).join('')}
    </table>`;

  return {html};
}

function querySalesFilter(lower, q) {
  const sales = CHAT.data.sales || [];
  let filtered = [...sales];
  let desc = [];

  // Price filter
  const price = extractPrice(lower);
  if (price) {
    if (price.max) { filtered = filtered.filter(s => s.amt_sale_price > 0 && s.amt_sale_price <= price.max); desc.push('under ' + formatDollars(price.max)); }
    if (price.min) { filtered = filtered.filter(s => s.amt_sale_price >= price.min); desc.push('over ' + formatDollars(price.min)); }
  }

  // Neighborhood filter
  const hood = extractNeighborhood(lower);
  if (hood) {
    const hoodName = (hood.name || hood.neighborhood || '').toLowerCase();
    filtered = filtered.filter(s => (s.neighborhood || '').toLowerCase().includes(hoodName) || 
                                     (s.ecf_neighborhood || '').toLowerCase().includes(hoodName));
    desc.push('in ' + (hood.name || hood.neighborhood));
  }

  // Name filter
  const namePatterns = ['by ', 'from ', 'to '];
  for (const p of namePatterns) {
    const idx = lower.indexOf(p);
    if (idx > -1) {
      const name = lower.substring(idx + p.length).replace(/[?!.]+$/, '').trim();
      if (name.length > 2) {
        filtered = filtered.filter(s => 
          (s.grantee || '').toLowerCase().includes(name) || 
          (s.grantor || '').toLowerCase().includes(name));
        desc.push('involving "' + name + '"');
      }
    }
  }

  // Sort by date desc
  filtered.sort((a,b) => (b.sale_date || '').localeCompare(a.sale_date || ''));
  
  const showing = filtered.slice(0, 50);
  const totalSpend = filtered.reduce((s, r) => s + (r.amt_sale_price || 0), 0);
  
  let html = `<strong>${filtered.length} sales found${desc.length ? ' ' + desc.join(', ') : ''}</strong><br>
    Total value: <strong>${formatDollars(totalSpend)}</strong><br><br>
    <table class="chat-table">
    <tr><th>Address</th><th>Price</th><th>Buyer</th><th>Date</th><th>Area</th></tr>
    ${showing.slice(0, 20).map(s => 
      '<tr><td>' + escapeHtml(s.address || '?') + '</td>' +
      '<td>' + formatDollars(s.amt_sale_price) + '</td>' +
      '<td>' + escapeHtml(s.grantee || '?') + '</td>' +
      '<td>' + (s.sale_date || '?').split('T')[0] + '</td>' +
      '<td>' + escapeHtml(s.neighborhood || s.ecf_neighborhood || '?') + '</td></tr>'
    ).join('')}
    </table>
    ${filtered.length > 20 ? '<p><small>Showing 20 of ' + filtered.length + ' results</small></p>' : ''}`;

  return {
    html,
    mapData: showing.map(s => ({
      lat: s.latitude, lng: s.longitude, address: s.address,
      price: s.amt_sale_price, buyer: s.grantee, seller: s.grantor,
      date: s.sale_date, neighborhood: s.neighborhood
    })),
    mapLabel: 'Show these sales on map'
  };
}

function queryMotivatedSellers(lower, q) {
  const sellers = CHAT.data.sellers || [];
  let filtered = [...sellers];
  
  const hood = extractNeighborhood(lower);
  if (hood) {
    const hoodName = (hood.name || hood.neighborhood || '').toLowerCase();
    filtered = filtered.filter(s => (s.neighborhood || '').toLowerCase().includes(hoodName));
  }

  filtered.sort((a,b) => (b.score || 0) - (a.score || 0));
  const top = filtered.slice(0, 20);

  let html = `<strong>Top Motivated Seller Targets${hood ? ' in ' + (hood.name || hood.neighborhood) : ''}:</strong><br>
    <p>${filtered.length} properties scored</p><br>
    <table class="chat-table">
    <tr><th>Address</th><th>Score</th><th>Owner</th><th>Signals</th></tr>
    ${top.map(s => 
      '<tr><td>' + escapeHtml(s.address || '?') + '</td>' +
      '<td><strong>' + (s.score || 0) + '</strong></td>' +
      '<td>' + escapeHtml(s.owner || s.grantor || '?') + '</td>' +
      '<td>' + escapeHtml(s.signal_summary || '?') + '</td></tr>'
    ).join('')}
    </table>`;

  return {
    html,
    mapData: top.map(s => ({
      lat: s.latitude || s._lat, lng: s.longitude || s._lng, address: s.address,
      info: 'Score: ' + s.score + ' — ' + (s.signal_summary || ''), neighborhood: s.neighborhood
    })),
    mapLabel: 'Show motivated sellers on map'
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Auto-init
document.addEventListener('DOMContentLoaded', initChat);
