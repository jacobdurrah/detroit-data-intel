const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function makeDocument(elements = {}) {
  return {
    querySelectorAll: () => [],
    addEventListener: () => {},
    getElementById: (id) => elements[id] || null,
    createElement: () => ({
      textContent: '',
      appendChild(node) {
        this.textContent += node.textContent;
      },
      get innerHTML() {
        return this.textContent;
      }
    }),
    createTextNode: (text) => ({ textContent: String(text) })
  };
}

function runScript(filename, context) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  vm.runInNewContext(source, context, { filename });
}

test('normalizes neighborhood API maps into arrays with display names', () => {
  const context = {
    console,
    window: { innerWidth: 1200 },
    document: makeDocument()
  };

  runScript('app.js', context);

  const normalized = context.normalizeNeighborhoodRecords({
    Bagley: { neighborhood: 'Bagley', momentum_score: 62.1 },
    Midtown: { name: 'Midtown', momentum_score: 33.2 }
  });

  assert.deepEqual(normalized.map((n) => n.name), ['Bagley', 'Midtown']);
  assert.equal(normalized[0].momentum_score, 62.1);
});

test('renders score-only pipeline deals without undefined fallback output', () => {
  const elements = {
    'pipeline-stats-bar': { innerHTML: '' },
    'pipeline-tbody': { innerHTML: '', children: [] },
    'pipeline-cards': { innerHTML: '', children: [] }
  };
  const context = {
    console,
    APP: {
      pipeline: [
        {
          score: 47,
          address: '203 ERSKINE',
          owner: 'Detroit Owner LLC',
          neighborhood: 'Bagley',
          sale_price: 15000,
          sale_date: '2024-01-15',
          signal_summary: 'Recent sale',
          match_count: 0
        },
        {
          score: 65,
          address: '100 MAIN',
          owner: 'Buyer LLC',
          neighborhood: 'Midtown',
          sale_price: 50000,
          sale_date: '2024-02-01',
          signal_summary: '',
          match_count: 0
        }
      ]
    },
    document: makeDocument(elements),
    formatMoney: (n) => '$' + Number(n).toLocaleString(),
    formatDate: (val) => val,
    escapeHtmlGlobal: (str) => String(str || '')
  };

  runScript('pipeline.js', context);
  context.renderPipelineStats();
  context.renderPipelineTable();
  context.renderPipelineCards();

  assert.match(elements['pipeline-tbody'].innerHTML, /score-badge score-mid">47<\/span>/);
  assert.match(elements['pipeline-cards'].innerHTML, /score-badge score-high">65<\/span>/);
  assert.doesNotMatch(elements['pipeline-tbody'].innerHTML, /undefined/);
  assert.match(elements['pipeline-stats-bar'].innerHTML, /1 High \(50\+\)/);
});
