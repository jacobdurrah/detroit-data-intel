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

const SALES = [
  {
    amt_sale_price: 7500,
    neighborhood: 'Bagley',
    grantee: 'HANTZ WOODLANDS LLC',
    grantor: "O'NEILL, DANIEL & KATHLEEN",
    sale_date: '2014-03-14',
    sale_instrument: 'QC',
  },
  {
    amt_sale_price: 600000,
    neighborhood: 'Downtown',
    grantee: "NEMO'S REALTY CO, LLC",
    grantor: 'REALTY EQUITY COMPANY, INC.',
    sale_date: '2024-06-01',
    sale_instrument: 'WD',
  },
  {
    amt_sale_price: 120000,
    neighborhood: 'Corktown',
    grantee: 'ARTESIAN HOMES',
    grantor: 'PAM\'S PROPETY CORPORATION',
    sale_date: '2020-01-15',
    sale_instrument: 'CD',
  },
];

test('min_price filter drops cheap sales that static JSON rewrites still return unfiltered', () => {
  const context = runScript('filters.js', {
    document: { getElementById() { return null; } },
  });
  const filtered = context.applyClientFilters(SALES, { minPrice: '500000' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].neighborhood, 'Downtown');
  assert.equal(filtered[0].amt_sale_price, 600000);
});

test('grantee filter matches buyer names including apostrophes', () => {
  const context = runScript('filters.js', {
    document: { getElementById() { return null; } },
  });
  const filtered = context.applyClientFilters(SALES, { grantee: 'nemo' });
  assert.equal(filtered.length, 1);
  assert.match(filtered[0].grantee, /NEMO'S/);
});

test('price filters do not wipe blight-shaped records when the layer is blight', () => {
  const context = runScript('filters.js', {
    document: { getElementById() { return null; } },
  });
  const blight = [{
    address: '100 MAIN',
    ordinance_description: 'weeds',
    ticket_issued_date: '2024-01-01',
    fine_amount: 250,
  }];
  const asSales = context.applyClientFilters(blight, { minPrice: '500000' }, 'sales');
  const asBlight = context.applyClientFilters(blight, { minPrice: '500000' }, 'blight');
  assert.equal(asSales.length, 0);
  assert.equal(asBlight.length, 1);
});

test('deed type WARRANTY matches WD instruments, not QC', () => {
  const context = runScript('filters.js', {
    document: { getElementById() { return null; } },
  });
  const filtered = context.applyClientFilters(SALES, { deedType: 'WARRANTY' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].sale_instrument, 'WD');
});

test('investor autocomplete uses canonical_name from static investor records', () => {
  const context = runScript('filters.js', {
    document: { getElementById() { return null; } },
  });
  assert.equal(
    context.investorDisplayName({ canonical_name: 'detroit edison public school' }),
    'detroit edison public school'
  );
  assert.equal(context.investorDisplayName({ name: null, investor_name: null }), '');
});

test('pipeline min_score 45 keeps score-only records at 47 and drops 38', () => {
  const elements = {
    'pipeline-min-score': { value: '45' },
    'pipeline-neighborhood-filter': { value: '' },
  };
  const context = runScript('pipeline.js', {
    APP: { pipeline: [] },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
    },
  });
  const out = context.applyPipelineClientFilters([
    { score: 38, neighborhood: 'Bagley' },
    { score: 47, neighborhood: 'Downtown' },
    { motivation_score: 41, neighborhood: 'Corktown' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].score, 47);
});

test('chat map button does not embed apostrophe JSON in HTML attributes', () => {
  const created = [];
  const messages = {
    child: null,
    scrollTop: 0,
    scrollHeight: 0,
    appendChild(node) {
      this.child = node;
      this.scrollHeight = 1;
    },
  };
  const context = runScript('chat.js', {
    console,
    APP: {},
    document: {
      addEventListener() {},
      createElement(tag) {
        const el = {
          tag,
          className: '',
          type: '',
          textContent: '',
          innerHTML: '',
          listeners: {},
          children: [],
          appendChild(child) {
            this.children.push(child);
          },
          addEventListener(type, fn) {
            this.listeners[type] = fn;
          },
        };
        created.push(el);
        return el;
      },
      getElementById(id) {
        return id === 'chat-messages' ? messages : null;
      },
    },
  });

  const points = [{
    lat: 42.33,
    lng: -83.04,
    buyer: "NEMO'S REALTY CO, LLC",
    address: '422 E LAFAYETTE',
  }];
  context.addMapButton(points, 'Show purchases on map');

  const btn = created.find(el => el.tag === 'button');
  assert.ok(btn, 'expected a real button element');
  assert.equal(btn.innerHTML, '');
  assert.doesNotMatch(btn.textContent, /onclick/);
  assert.doesNotMatch(btn.textContent, /NEMO\\'/);
  assert.match(btn.textContent, /Show purchases on map \(1 properties\)/);
  assert.equal(typeof btn.listeners.click, 'function');
  assert.equal(messages.child.innerHTML, '');
});
