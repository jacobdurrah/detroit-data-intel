const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPipelineModule(pipeline) {
  const elements = {
    'pipeline-tbody': { innerHTML: '' },
    'pipeline-cards': { innerHTML: '' },
    'pipeline-stats-bar': { innerHTML: '' },
  };
  const context = {
    APP: { pipeline },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
    },
    escapeHtmlGlobal(value) {
      return String(value).replace(/[&<>"']/g, '');
    },
    formatMoney(value) {
      return '$' + value;
    },
    formatDate(value) {
      return String(value);
    },
    module: { exports: {} },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'pipeline.js'), 'utf8');
  vm.runInNewContext(
    source + '\nmodule.exports = { getPipelineScore, renderPipelineStats, renderPipelineTable, renderPipelineCards };',
    context
  );
  return { pipeline: context.module.exports, elements };
}

test('renders score-field pipeline rows without truncating the table', () => {
  const { pipeline, elements } = loadPipelineModule([
    {
      score: 47,
      address: '123 Main St',
      owner: 'Demo Owner',
      neighborhood: 'Bagley',
      sale_price: 100000,
      sale_date: '2026-01-01',
      signal_summary: 'Recent sale',
      match_count: 0,
      top_matches: [],
    },
  ]);

  pipeline.renderPipelineTable();

  assert.match(elements['pipeline-tbody'].innerHTML, />47<\/span>/);
  assert.match(elements['pipeline-tbody'].innerHTML, /123 Main St/);
  assert.doesNotMatch(elements['pipeline-tbody'].innerHTML, /undefined/);
});

test('high score stats use the normalized score value', () => {
  const { pipeline, elements } = loadPipelineModule([
    { motivation_score: 20, match_count: 0 },
    { score: 55, match_count: 1 },
    { score: 49, match_count: 0 },
  ]);

  pipeline.renderPipelineStats();

  assert.match(elements['pipeline-stats-bar'].innerHTML, /1 High \(50\+\)/);
});
