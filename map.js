// ============================================================
// Detroit Data Intelligence Platform - Leaflet Map Logic
// ============================================================

// Layer color configuration
const LAYER_COLORS = {
  sales:     '#e94560',
  permits:   '#00d2ff',
  dlba:      '#ffd700',
  blight:    '#ff6b35',
  demos:     '#ff00ff',
  rentals:   '#00ff88',
  crime:     '#ff3333',
  vacant:    '#888888',
  presale:   '#66ccff',
  trades:    '#aa66ff',
  investors: '#ffd700'
};

// Layer marker radius configuration
const LAYER_RADIUS = {
  sales:     6,
  permits:   5,
  dlba:      5,
  blight:    6,
  demos:     6,
  rentals:   5,
  crime:     5,
  vacant:    5,
  presale:   5,
  trades:    5,
  investors: 8
};

// Heatmap state
let heatmapLayer = null;
let heatmapEnabled = false;

// Highlighted investor properties layer
let investorHighlightLayer = null;

// Initialize the Leaflet map
function initMap() {
  // Create the map centered on Detroit
  APP.map = L.map('map', {
    center: [42.3314, -83.0458],
    zoom: 12,
    zoomControl: true,
    preferCanvas: true
  });

  // Dark tile layer - CartoDB dark_all
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(APP.map);

  // Initialize layer groups
  Object.keys(LAYER_COLORS).forEach(name => {
    APP.layers[name] = null; // will hold MarkerClusterGroup when loaded
  });

  // Wire up layer toggle checkboxes
  document.querySelectorAll('#layer-toggles input[data-layer]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const layerName = e.target.dataset.layer;
      if (e.target.checked) {
        loadLayer(layerName);
      } else {
        removeLayer(layerName);
      }
    });
  });

  // Wire up heatmap toggle
  const heatmapToggle = document.getElementById('heatmap-toggle');
  if (heatmapToggle) {
    heatmapToggle.addEventListener('change', (e) => {
      heatmapEnabled = e.target.checked;
      if (heatmapEnabled) {
        updateHeatmap();
      } else {
        removeHeatmap();
      }
    });
  }

  // Update heatmap when map moves (if enabled)
  APP.map.on('moveend', () => {
    if (heatmapEnabled) {
      updateHeatmap();
    }
  });

  // Load the default checked layer (sales)
  document.querySelectorAll('#layer-toggles input[data-layer]:checked').forEach(cb => {
    loadLayer(cb.dataset.layer);
  });
}

// Load a data layer from the API and display it on the map
async function loadLayer(name) {
  // Show loading state on the checkbox label
  const checkbox = document.querySelector(`#layer-toggles input[data-layer="${name}"]`);
  const label = checkbox ? checkbox.parentElement : null;
  if (label) label.classList.add('loading');

  // Build endpoint with any active filters
  // Use dedicated endpoint for investor properties (with coordinates)
  let endpoint = name === 'investors' ? '/api/investor-properties' : '/api/' + name;
  const filterParams = getActiveFilterParams();
  if (filterParams) {
    endpoint += '?' + filterParams;
  }

  // Fetch data
  const data = await fetchAPI(endpoint);
  APP.data[name] = data || [];

  // Remove existing layer if present
  if (APP.layers[name]) {
    APP.map.removeLayer(APP.layers[name]);
  }

  if (!data || data.length === 0) {
    if (label) label.classList.remove('loading');
    return;
  }

  // Create MarkerClusterGroup
  const clusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      let size = 'small';
      if (count > 100) size = 'large';
      else if (count > 10) size = 'medium';
      return L.divIcon({
        html: '<div><span>' + count + '</span></div>',
        className: 'marker-cluster marker-cluster-' + size + ' cluster-' + name,
        iconSize: L.point(40, 40)
      });
    }
  });

  // Create markers for each data point
  data.forEach(item => {
    const lat = parseFloat(item._lat || item.latitude || item.lat);
    const lng = parseFloat(item._lng || item.longitude || item.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    let color = LAYER_COLORS[name];
    let radius = LAYER_RADIUS[name] || 6;

    // For sales, color by price range
    const salePrice = item.amt_sale_price || item.price;
    if (name === 'sales' && salePrice != null) {
      color = getSalesPriceColor(salePrice);
    }

    // For investors, use larger markers
    if (name === 'investors') {
      radius = 10;
    }

    const marker = L.circleMarker([lat, lng], {
      radius: radius,
      fillColor: color,
      color: name === 'investors' ? '#fff' : color,
      weight: name === 'investors' ? 2 : 1,
      opacity: 0.9,
      fillOpacity: 0.7
    });

    // Bind popup with property details
    marker.bindPopup(() => buildPopupContent(name, item));

    clusterGroup.addLayer(marker);
  });

  APP.layers[name] = clusterGroup;
  APP.map.addLayer(clusterGroup);

  if (label) label.classList.remove('loading');

  // Update heatmap if enabled
  if (heatmapEnabled) {
    updateHeatmap();
  }
}

// Remove a layer from the map
function removeLayer(name) {
  if (APP.layers[name]) {
    APP.map.removeLayer(APP.layers[name]);
    APP.layers[name] = null;
  }
  // Clear cached data for this layer
  delete APP.data[name];

  // Update heatmap if enabled
  if (heatmapEnabled) {
    updateHeatmap();
  }
}

// Get color for sales based on price range
function getSalesPriceColor(price) {
  const p = Number(price);
  if (p < 50000) return '#00ff88';       // green
  if (p < 150000) return '#ffd700';      // yellow
  if (p < 500000) return '#ff6b35';      // orange
  return '#e94560';                       // red
}

// Build popup HTML content for a data point
function buildPopupContent(layerName, item) {
  let html = '<div class="map-popup">';

  switch (layerName) {
    case 'sales':
      html += '<h4>Property Sale</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Price:</strong> ' + formatMoney(item.amt_sale_price) + '</p>';
      html += '<p><strong>Date:</strong> ' + formatDate(item.sale_date) + '</p>';
      html += '<p><strong>Seller:</strong> ' + (item.grantor || 'N/A') + '</p>';
      html += '<p><strong>Buyer:</strong> ' + (item.grantee || 'N/A') + '</p>';
      html += '<p><strong>Deed:</strong> ' + (item.term_of_sale || 'N/A') + '</p>';
      html += '<p><strong>Neighborhood:</strong> ' + (item.neighborhood || item.ecf_neighborhood || 'N/A') + '</p>';
      if (item.parcel_id) html += '<p><strong>Parcel:</strong> ' + item.parcel_id + '</p>';
      break;

    case 'permits':
      html += '<h4>Building Permit</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Type:</strong> ' + (item.permit_type || 'N/A') + '</p>';
      html += '<p><strong>Issued:</strong> ' + formatDate(item.issued_date) + '</p>';
      html += '<p><strong>Work:</strong> ' + (item.work_description || 'N/A') + '</p>';
      if (item.amt_estimated_contractor_cost) html += '<p><strong>Est. Cost:</strong> ' + formatMoney(item.amt_estimated_contractor_cost) + '</p>';
      if (item.neighborhood) html += '<p><strong>Neighborhood:</strong> ' + item.neighborhood + '</p>';
      break;

    case 'dlba':
      html += '<h4>DLBA Property</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Status:</strong> ' + (item.status || 'N/A') + '</p>';
      html += '<p><strong>Program:</strong> ' + (item.program || 'N/A') + '</p>';
      if (item.price) html += '<p><strong>Price:</strong> ' + formatMoney(item.price) + '</p>';
      break;

    case 'blight':
      html += '<h4>Blight Ticket</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Ordinance:</strong> ' + (item.ordinance_description || item.ordinance_law || 'N/A') + '</p>';
      html += '<p><strong>Disposition:</strong> ' + (item.disposition || 'N/A') + '</p>';
      html += '<p><strong>Date:</strong> ' + formatDate(item.ticket_issued_date) + '</p>';
      if (item.fine_amount) html += '<p><strong>Fine:</strong> ' + formatMoney(item.fine_amount) + '</p>';
      if (item.judgment_amount) html += '<p><strong>Judgment:</strong> ' + formatMoney(item.judgment_amount) + '</p>';
      break;

    case 'demos':
      html += '<h4>Demolition Permit</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Issued:</strong> ' + formatDate(item.issued_date) + '</p>';
      html += '<p><strong>Work:</strong> ' + (item.work_description || 'N/A') + '</p>';
      html += '<p><strong>Contractor:</strong> ' + (item.demolition_contractor || 'N/A') + '</p>';
      if (item.neighborhood) html += '<p><strong>Neighborhood:</strong> ' + item.neighborhood + '</p>';
      break;

    case 'rentals':
      html += '<h4>Rental Registration</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Type:</strong> ' + (item.registration_type || 'N/A') + '</p>';
      html += '<p><strong>Issued:</strong> ' + formatDate(item.issued_date) + '</p>';
      if (item.neighborhood) html += '<p><strong>Neighborhood:</strong> ' + item.neighborhood + '</p>';
      break;

    case 'crime':
      html += '<h4>911 Call</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || item.block_address || 'N/A') + '</p>';
      html += '<p><strong>Call Type:</strong> ' + (item.call_description || item.category || 'N/A') + '</p>';
      html += '<p><strong>Date:</strong> ' + formatDate(item.called_at || item.call_date_time) + '</p>';
      if (item.priority) html += '<p><strong>Priority:</strong> ' + item.priority + '</p>';
      break;

    case 'vacant':
      html += '<h4>Vacant Property</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Registered:</strong> ' + formatDate(item.issued_date) + '</p>';
      if (item.neighborhood) html += '<p><strong>Neighborhood:</strong> ' + item.neighborhood + '</p>';
      break;

    case 'presale':
      html += '<h4>Presale Inspection</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Date:</strong> ' + formatDate(item.issued_date || item.submitted_date) + '</p>';
      if (item.neighborhood) html += '<p><strong>Neighborhood:</strong> ' + item.neighborhood + '</p>';
      break;

    case 'trades':
      html += '<h4>Trades Permit</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Type:</strong> ' + (item.permit_type || 'N/A') + '</p>';
      html += '<p><strong>Issued:</strong> ' + formatDate(item.issued_date) + '</p>';
      html += '<p><strong>Work:</strong> ' + (item.work_description || 'N/A') + '</p>';
      if (item.contact_business_name) html += '<p><strong>Contractor:</strong> ' + item.contact_business_name + '</p>';
      if (item.owner_name) html += '<p><strong>Owner:</strong> ' + item.owner_name + '</p>';
      if (item.neighborhood) html += '<p><strong>Neighborhood:</strong> ' + item.neighborhood + '</p>';
      break;

    case 'investors':
      html += '<h4>Investor Property</h4>';
      html += '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>';
      html += '<p><strong>Investor:</strong> ' + (item.investor_name || item.grantee || 'N/A') + '</p>';
      html += '<p><strong>Price:</strong> ' + formatMoney(item.amt_sale_price || item.price) + '</p>';
      html += '<p><strong>Date:</strong> ' + formatDate(item.sale_date) + '</p>';
      html += '<p><strong>Neighborhood:</strong> ' + (item.neighborhood || item.ecf_neighborhood || 'N/A') + '</p>';
      break;

    default:
      html += '<h4>Property Data</h4>';
      // Show all available fields
      Object.keys(item).forEach(key => {
        if (key !== 'lat' && key !== 'lng' && key !== 'latitude' &&
            key !== 'longitude' && key !== 'lon') {
          html += '<p><strong>' + key + ':</strong> ' + (item[key] || 'N/A') + '</p>';
        }
      });
  }

  html += '</div>';
  return html;
}

// Update the heatmap using all currently visible points
function updateHeatmap() {
  removeHeatmap();

  const heatPoints = [];

  // Gather all visible layer data points
  Object.keys(APP.data).forEach(name => {
    if (!APP.layers[name] || !APP.data[name]) return;
    APP.data[name].forEach(item => {
      const lat = parseFloat(item._lat || item.latitude || item.lat);
      const lng = parseFloat(item._lng || item.longitude || item.lng || item.lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        // Intensity: use price for sales, default 1 for others
        let intensity = 0.5;
        const heatPrice = item.amt_sale_price || item.price;
        if (heatPrice) {
          intensity = Math.min(Number(heatPrice) / 500000, 1);
        }
        heatPoints.push([lat, lng, intensity]);
      }
    });
  });

  if (heatPoints.length === 0) return;

  // Create Leaflet.heat layer if the plugin is available
  if (typeof L.heatLayer === 'function') {
    heatmapLayer = L.heatLayer(heatPoints, {
      radius: 20,
      blur: 15,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: '#000080',
        0.25: '#0000ff',
        0.5: '#00ff00',
        0.75: '#ffff00',
        1.0: '#ff0000'
      }
    }).addTo(APP.map);
  } else {
    console.warn('Leaflet.heat plugin not loaded. Heatmap unavailable.');
  }
}

// Remove the heatmap layer
function removeHeatmap() {
  if (heatmapLayer) {
    APP.map.removeLayer(heatmapLayer);
    heatmapLayer = null;
  }
}

// Highlight specific investor properties on the map
// Called from players.js when "Show on Map" is clicked
function highlightInvestorProperties(investorName, properties) {
  // Remove previous highlights
  if (investorHighlightLayer) {
    APP.map.removeLayer(investorHighlightLayer);
  }

  investorHighlightLayer = L.layerGroup();
  const bounds = [];

  if (!properties || properties.length === 0) return;

  properties.forEach(item => {
    const lat = parseFloat(item._lat || item.latitude || item.lat);
    const lng = parseFloat(item._lng || item.longitude || item.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    bounds.push([lat, lng]);

    // Create a larger, pulsing-style highlight marker
    const marker = L.circleMarker([lat, lng], {
      radius: 12,
      fillColor: '#ffd700',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.8
    });

    marker.bindPopup(() => {
      return '<div class="map-popup">' +
        '<h4>' + (investorName || 'Investor') + '</h4>' +
        '<p><strong>Address:</strong> ' + (item.address || 'N/A') + '</p>' +
        '<p><strong>Price:</strong> ' + formatMoney(item.amt_sale_price || item.price) + '</p>' +
        '<p><strong>Date:</strong> ' + formatDate(item.sale_date) + '</p>' +
        '<p><strong>Neighborhood:</strong> ' + (item.neighborhood || item.ecf_neighborhood || 'N/A') + '</p>' +
        '</div>';
    });

    investorHighlightLayer.addLayer(marker);
  });

  investorHighlightLayer.addTo(APP.map);

  // Fit map to show all highlighted properties
  if (bounds.length > 0) {
    APP.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }
}

// Remove investor highlights
function clearInvestorHighlights() {
  if (investorHighlightLayer) {
    APP.map.removeLayer(investorHighlightLayer);
    investorHighlightLayer = null;
  }
}

// Reload all currently active layers (e.g., after filter change)
function reloadActiveLayers() {
  Object.keys(APP.layers).forEach(name => {
    if (APP.layers[name]) {
      loadLayer(name);
    }
  });
}
