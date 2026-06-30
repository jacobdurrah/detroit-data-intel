const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function browserContext(fetchImpl) {
  return {
    console,
    fetch: fetchImpl,
    window: { innerWidth: 1024 },
    document: {
      querySelectorAll: () => [],
      addEventListener: () => {},
      getElementById: () => null,
      createElement: () => ({
        appendChild: () => {},
        innerHTML: '',
      }),
      createTextNode: (value) => value,
    },
  };
}

function loadScripts(context, files) {
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInNewContext(source, context, { filename: file });
  }
}

test('fetchAPI normalizes neighborhood maps to arrays with legacy aliases', async () => {
  const context = browserContext(async () => ({
    ok: true,
    json: async () => ({
      data: {
        Bagley: {
          neighborhood: 'Bagley',
          momentum_score: 62.1,
          sales_volume_12mo: 14,
          median_price_recent: 194000,
          permit_count: 17,
        },
      },
    }),
  }));

  loadScripts(context, ['app.js']);
  const data = await context.fetchAPI('/api/neighborhoods');

  assert.equal(Array.isArray(data), true);
  assert.equal(data[0].name, 'Bagley');
  assert.equal(data[0].score, 62.1);
  assert.equal(data[0].total_sales, 14);
  assert.equal(data[0].median_price, 194000);
  assert.equal(data[0].total_permits, 17);
});

test('investor detail lookup resolves aliases from the static investor list', async () => {
  const context = browserContext(async () => ({
    ok: true,
    json: async () => ({ data: [] }),
  }));

  loadScripts(context, ['app.js', 'players.js']);
  vm.runInNewContext(
    "APP.investors = [{ canonical_name: 'detroit edison public school', aliases: ['DETROIT EDISON PUBLIC SCHOOL'] }];",
    context
  );

  const investor = await vm.runInNewContext(
    "resolveInvestorByName('DETROIT EDISON PUBLIC SCHOOL')",
    context
  );
  assert.equal(investor.canonical_name, 'detroit edison public school');
});

test('critical static API rewrites point to real datasets', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const rewrites = new Map(vercel.rewrites.map((r) => [r.source, r.destination]));

  assert.equal(rewrites.get('/api/lending'), '/api/lending.json');
  assert.notEqual(rewrites.get('/api/opportunities'), '/api/neighborhoods.json');
});
