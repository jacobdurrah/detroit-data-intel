const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function runScript(file, context) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInNewContext(source, context, { filename: file });
  return context;
}

function classListStub() {
  return { add() {}, remove() {} };
}

test('contractor View after search opens the filtered row, not APP.contractors[idx]', () => {
  const detail = { classList: classListStub(), innerHTML: '' };
  const search = {
    value: '',
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
  };
  const context = runScript('contractors.js', {
    APP: {
      contractors: [
        {
          name: 'DWSD WATER MAIN REPLACEMENT CONTRACT',
          contact_name: 'Water Desk',
          total_permits: 9000,
          properties_served: 400,
          neighborhoods_served: 80,
          specialties: { Water: 9000 },
          neighborhoods: { Downtown: 10 },
          recent_permits: [],
        },
        {
          name: 'AIR COMFORT PRO LLC',
          contact_name: 'HVAC Desk',
          total_permits: 120,
          properties_served: 40,
          neighborhoods_served: 6,
          specialties: { HVAC: 120 },
          neighborhoods: { Warrendale: 8 },
          recent_permits: [],
        },
      ],
    },
    document: {
      getElementById(id) {
        if (id === 'contractor-detail') return detail;
        if (id === 'contractor-search') return search;
        if (id === 'contractor-specialty-filter') {
          return { addEventListener() {}, classList: classListStub() };
        }
        return { classList: classListStub(), children: [], innerHTML: '' };
      },
    },
    escapeHtmlGlobal: (s) => String(s || ''),
    formatDate: () => 'N/A',
  });

  context.wireContractorControls();
  search.value = 'air comfort';
  search.listeners.input({ target: search });

  const filtered = context.getFilteredContractors();
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'AIR COMFORT PRO LLC');

  context.showContractorDetail(0);
  assert.match(detail.innerHTML, /AIR COMFORT PRO LLC/);
  assert.match(detail.innerHTML, /HVAC Desk/);
  assert.doesNotMatch(detail.innerHTML, /DWSD WATER MAIN/);
  assert.doesNotMatch(detail.innerHTML, /Water Desk/);
});

test('contractor View without search still opens APP.contractors[0]', () => {
  const detail = { classList: classListStub(), innerHTML: '' };
  const context = runScript('contractors.js', {
    APP: {
      contractors: [
        { name: 'DWSD WATER MAIN REPLACEMENT CONTRACT', total_permits: 9000, specialties: {}, neighborhoods: {}, recent_permits: [] },
        { name: 'AIR COMFORT PRO LLC', total_permits: 120, specialties: {}, neighborhoods: {}, recent_permits: [] },
      ],
    },
    document: {
      getElementById(id) {
        if (id === 'contractor-detail') return detail;
        return { classList: classListStub() };
      },
    },
    escapeHtmlGlobal: (s) => String(s || ''),
    formatDate: () => 'N/A',
  });

  context.showContractorDetail(0);
  assert.match(detail.innerHTML, /DWSD WATER MAIN REPLACEMENT CONTRACT/);
});

test('investor map keeps only that grantee from a cached city-wide sales file', () => {
  const context = runScript('players.js', {
    APP: {
      data: {
        sales: [
          { latitude: 42.33, longitude: -83.04, grantee: 'RANDOLPH LAFAYETTE LOTS, LLC', address: '422 E LAFAYETTE' },
          { latitude: 42.41, longitude: -83.12, grantee: 'DETROIT EDISON PUBLIC SCHOOL', address: '1 SCHOOL ST' },
          { latitude: 42.35, longitude: -83.08, grantee: "NEMO'S REALTY CO, LLC", address: '100 MAIN' },
        ],
      },
      investors: [
        {
          canonical_name: 'detroit edison public school',
          aliases: ['DETROIT EDISON PUBLIC SCHOOL'],
        },
      ],
    },
    document: {
      querySelector() { return null; },
      createElement() { return { appendChild() {} }; },
    },
    escapeHtml: (s) => String(s || ''),
    formatMoney: () => '',
    formatDate: () => '',
  });

  const unfilteredWithCoords = context.APP.data.sales.filter(s => s.latitude && s.longitude);
  assert.equal(unfilteredWithCoords.length, 3, 'precondition: the cached sales file has every investor');

  const props = context.filterSalesForInvestor(
    context.APP.data.sales,
    'detroit edison public school'
  );
  assert.equal(props.length, 1);
  assert.equal(props[0].address, '1 SCHOOL ST');
  assert.equal(props[0].grantee, 'DETROIT EDISON PUBLIC SCHOOL');
});

test('investor map matches sales via aliases, not the lowercase canonical_name alone', () => {
  const context = runScript('players.js', {
    APP: {
      investors: [
        {
          canonical_name: 'hantz woodalnds',
          aliases: ['HANTZ WOODALNDS LLC', 'HANTZ WOODLAND'],
        },
      ],
    },
    document: {
      querySelector() { return null; },
      createElement() { return { appendChild() {} }; },
    },
  });

  const props = context.filterSalesForInvestor(
    [
      { latitude: 42.3, longitude: -83.0, grantee: 'HANTZ WOODALNDS LLC', address: '10 HANTZ' },
      { latitude: 42.3, longitude: -83.0, grantee: 'OTHER BUYER LLC', address: '99 OTHER' },
    ],
    'hantz woodalnds'
  );
  assert.equal(props.length, 1);
  assert.equal(props[0].address, '10 HANTZ');
});
