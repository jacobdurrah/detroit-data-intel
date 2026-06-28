const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPipelineContext() {
  const elements = {
    'pipeline-tbody': { innerHTML: '', children: [] },
    'pipeline-cards': { innerHTML: '', children: [] },
    'pipeline-stats-bar': { innerHTML: '' },
  };
  const context = {
    APP: {
      pipeline: [
        {
          score: 47,
          address: '123 Main St',
          owner: 'Owner LLC',
          neighborhood: 'Corktown',
          sale_price: 75000,
          sale_date: '2024-01-02',
          signal_summary: 'Recent sale',
          match_count: 0,
          top_matches: [],
        },
        {
          motivation_score: 55,
          address: '456 Second St',
          owner: 'Second Owner LLC',
          neighborhood: 'Bagley',
          sale_price: 90000,
          sale_date: '2024-02-03',
          match_count: 1,
          top_matches: [],
        },
      ],
    },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      createElement() {
        return {};
      },
    },
    escapeHtmlGlobal(value) {
      return String(value);
    },
    formatMoney(value) {
      return '$' + value;
    },
    formatDate(value) {
      return value;
    },
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'pipeline.js'), 'utf8'),
    context
  );
  return { context, elements };
}

test('pipeline renders score-only deals without corrupting badge HTML', () => {
  const { context, elements } = loadPipelineContext();

  context.renderPipelineTable();
  context.renderPipelineCards();
  context.renderPipelineStats();

  assert.match(elements['pipeline-tbody'].innerHTML, />47<\/span><\/td>/);
  assert.match(elements['pipeline-cards'].innerHTML, />47<\/span>/);
  assert.doesNotMatch(elements['pipeline-tbody'].innerHTML, /undefined/);
  assert.doesNotMatch(elements['pipeline-cards'].innerHTML, /undefined/);
  assert.match(elements['pipeline-stats-bar'].innerHTML, /1 High \(50\+\)/);
});

test('vercel rewrites include the lending dataset route', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.ok(
    config.rewrites.some(
      (rewrite) => rewrite.source === '/api/lending' && rewrite.destination === '/api/lending.json'
    )
  );
});
