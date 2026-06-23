const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeContext(elements) {
  return vm.createContext({
    console,
    window: { innerWidth: 1024 },
    document: {
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
      getElementById(id) {
        return elements[id] || null;
      },
      createElement() {
        return {
          innerHTML: '',
          appendChild(node) {
            this.innerHTML = htmlEscape(node.textContent || '');
          },
        };
      },
      createTextNode(value) {
        return { textContent: String(value) };
      },
    },
  });
}

function runScript(context, filename) {
  const source = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  vm.runInContext(source, context, { filename });
}

test('normalizes static neighborhood object maps into array records', () => {
  const context = makeContext({});
  runScript(context, 'app.js');

  const result = JSON.parse(JSON.stringify(vm.runInContext(
    'normalizeNeighborhoodRecords({"Bagley":{"momentum_score":62.1,"permit_count":17}})',
    context
  )));

  assert.deepEqual(result, [
    {
      neighborhood: 'Bagley',
      name: 'Bagley',
      momentum_score: 62.1,
      permit_count: 17,
    },
  ]);
});

test('pipeline renderer keeps full row and card HTML when only score is present', () => {
  const elements = {
    'pipeline-tbody': { innerHTML: '' },
    'pipeline-cards': { innerHTML: '' },
    'pipeline-stats-bar': { innerHTML: '' },
  };
  const context = makeContext(elements);
  runScript(context, 'app.js');
  runScript(context, 'pipeline.js');

  vm.runInContext(`
    APP.pipeline = [{
      score: 72,
      address: '123 Main',
      owner: 'Test Owner',
      neighborhood: 'Bagley',
      sale_price: 85000,
      sale_date: '2026-06-01',
      signal_summary: 'Vacant and tax delinquent',
      top_matches: [],
      match_count: 0
    }];
    renderPipelineStats();
    renderPipelineTable();
    renderPipelineCards();
  `, context);

  assert.match(elements['pipeline-tbody'].innerHTML, /123 Main/);
  assert.match(elements['pipeline-tbody'].innerHTML, /Test Owner/);
  assert.match(elements['pipeline-tbody'].innerHTML, /Vacant and tax delinquent/);
  assert.match(elements['pipeline-cards'].innerHTML, /123 Main/);
  assert.match(elements['pipeline-stats-bar'].innerHTML, /1 High \(50\+\)/);
});
