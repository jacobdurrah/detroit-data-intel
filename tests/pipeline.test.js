const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getPipelineScore,
  getPipelineScoreClass,
  renderPipelineStats,
  renderPipelineTable,
  renderPipelineCards,
} = require('../pipeline');

function setupDom() {
  const elements = {
    'pipeline-stats-bar': { innerHTML: '' },
    'pipeline-tbody': { innerHTML: '' },
    'pipeline-cards': { innerHTML: '' },
  };

  global.document = {
    getElementById(id) {
      return elements[id] || null;
    },
  };
  global.APP = { pipeline: [] };
  global.escapeHtmlGlobal = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  global.formatMoney = function (value) {
    return '$' + (Number(value) || 0);
  };
  global.formatDate = function (value) {
    return value || '';
  };

  return elements;
}

test('normalizes score-only and motivation_score pipeline records', () => {
  assert.equal(getPipelineScore({ score: 0 }), 0);
  assert.equal(getPipelineScore({ score: 62 }), 62);
  assert.equal(getPipelineScore({ motivation_score: 41, score: 62 }), 41);
  assert.equal(getPipelineScore({ motivation_score: null, score: 35 }), 35);

  assert.equal(getPipelineScoreClass({ score: 62 }), 'score-high');
  assert.equal(getPipelineScoreClass({ motivation_score: 41, score: 62 }), 'score-mid');
  assert.equal(getPipelineScoreClass({ score: 12 }), 'score-low');
});

test('renders score-only pipeline rows without corrupting score badge markup', () => {
  const elements = setupDom();
  global.APP.pipeline = [{
    score: 62,
    address: '123 Main',
    owner: 'Detroit Owner',
    neighborhood: 'Corktown',
    sale_price: 25000,
    sale_date: '2026-06-01',
    signal_summary: 'Tax delinquency',
    match_count: 0,
    top_matches: [],
  }];

  renderPipelineTable();
  renderPipelineCards();

  assert.match(elements['pipeline-tbody'].innerHTML, /<span class="score-badge score-high">62<\/span>/);
  assert.match(elements['pipeline-cards'].innerHTML, /<span class="score-badge score-high">62<\/span>/);
  assert.doesNotMatch(elements['pipeline-tbody'].innerHTML, /undefined/);
  assert.doesNotMatch(elements['pipeline-cards'].innerHTML, /undefined/);
});

test('counts high-score pipeline stats with normalized numeric scores', () => {
  const elements = setupDom();
  global.APP.pipeline = [
    { score: 62, match_count: 1 },
    { score: 35, match_count: 0 },
    { motivation_score: 45, score: 80, match_count: 0 },
    { motivation_score: 51, score: 12, match_count: 2 },
  ];

  renderPipelineStats();

  assert.match(elements['pipeline-stats-bar'].innerHTML, /2 High \(50\+\)/);
  assert.match(elements['pipeline-stats-bar'].innerHTML, /Avg Score: 48\.3/);
});
