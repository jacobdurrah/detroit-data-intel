const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function createDocumentMock(elements) {
  return {
    querySelectorAll() { return []; },
    addEventListener() {},
    getElementById(id) { return elements[id] || null; },
    createElement() {
      return {
        set textContent(value) {
          this.innerHTML = String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        },
        innerHTML: '',
      };
    },
  };
}

function runScript(file, extraContext = {}) {
  const context = {
    console,
    window: { innerWidth: 1024 },
    document: createDocumentMock({}),
    ...extraContext,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return context;
}

test('fetchAPI converts neighborhood map payloads into arrays', async () => {
  const neighborhoods = {
    data: {
      Bagley: { neighborhood: 'Bagley', momentum_score: 62.1 },
      Warrendale: { neighborhood: 'Warrendale', momentum_score: 30.8 },
    },
  };
  const context = runScript('app.js', {
    fetch: async () => ({ ok: true, json: async () => neighborhoods }),
  });

  const result = await context.fetchAPI('/api/neighborhoods');

  assert.equal(Array.isArray(result), true);
  assert.equal(JSON.stringify(result.map(n => n.name)), JSON.stringify(['Bagley', 'Warrendale']));
  assert.equal(result[0].momentum_score, 62.1);
});

test('opportunity normalization keeps motivated seller payload renderable', () => {
  const context = runScript('app.js');

  const result = context.normalizeOpportunity({
    address: '203 ERSKINE',
    neighborhood: 'Brush Park',
    score: 47,
    signal_summary: 'Tax/Foreclosure, Estate/Probate',
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    type: 'motivated_seller',
    score: 47,
    neighborhood: 'Brush Park',
    reasoning: 'Tax/Foreclosure, Estate/Probate',
  });
});

test('pipeline table renders score fallback without truncating the row', () => {
  const tbody = { innerHTML: '' };
  const context = runScript('pipeline.js', {
    APP: {
      pipeline: [{
        score: 47,
        address: '203 ERSKINE',
        owner: 'ALMASS DOWNTOWN REAL ESTATE LLC',
        neighborhood: 'Brush Park',
        sale_price: 10100,
        sale_date: '2012-11-16',
        signal_summary: 'Tax/Foreclosure',
      }],
    },
    document: createDocumentMock({ 'pipeline-tbody': tbody }),
    escapeHtmlGlobal: value => String(value || ''),
    formatMoney: value => '$' + Number(value).toLocaleString(),
    formatDate: value => String(value || ''),
  });

  context.renderPipelineTable();

  assert.match(tbody.innerHTML, /score-badge score-mid">47<\/span>/);
  assert.match(tbody.innerHTML, /203 ERSKINE/);
  assert.doesNotMatch(tbody.innerHTML, /undefined/);
});

test('investor detail lookup resolves records from the full static investor list', () => {
  const context = runScript('players.js');
  const investors = [{
    canonical_name: 'detroit edison public school',
    aliases: ['DETROIT EDISON PUBLIC SCHOOL'],
    total_purchases: 24,
  }];

  const found = context.findInvestorByName(investors, 'DETROIT EDISON PUBLIC SCHOOL');

  assert.equal(found.total_purchases, 24);
});

test('vercel rewrites expose lending and motivated-seller opportunities', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const rewrites = new Map(vercel.rewrites.map(route => [route.source, route.destination]));

  assert.equal(rewrites.get('/api/lending'), '/api/lending.json');
  assert.equal(rewrites.get('/api/opportunities'), '/api/motivated-sellers.json');
});
