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

test('pipeline renders score-only records without undefined or broken score cells', () => {
  const elements = {
    'pipeline-tbody': { innerHTML: '' },
    'pipeline-cards': { innerHTML: '' },
    'pipeline-stats-bar': { innerHTML: '' },
  };
  const context = {
    APP: {
      pipeline: [{
        score: 47,
        address: '123 Test St',
        owner: 'Detroit Owner',
        neighborhood: 'Bagley',
        sale_price: 45000,
        sale_date: '2024-01-01',
        signal_summary: 'Recent arms-length sale',
        match_count: 0,
      }],
    },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
    },
    formatMoney(n) {
      return '$' + Number(n).toLocaleString();
    },
    formatDate(val) {
      return String(val);
    },
    escapeHtmlGlobal(str) {
      return String(str);
    },
  };

  runScript('pipeline.js', context);
  context.renderPipelineStats();
  context.renderPipelineTable();
  context.renderPipelineCards();

  assert.match(elements['pipeline-stats-bar'].innerHTML, /Avg Score: 47\.0/);
  assert.match(elements['pipeline-tbody'].innerHTML, /score-badge score-mid">47<\/span><\/td>/);
  assert.doesNotMatch(elements['pipeline-tbody'].innerHTML, /undefined/);
  assert.match(elements['pipeline-cards'].innerHTML, /score-badge score-mid">47<\/span>/);
  assert.doesNotMatch(elements['pipeline-cards'].innerHTML, /undefined/);
});

test('chat escapes user-authored messages before inserting them as HTML', () => {
  const messages = {
    children: [],
    scrollTop: 0,
    scrollHeight: 0,
    appendChild(node) {
      this.children.push(node);
      this.scrollHeight = this.children.length;
    },
  };
  const context = {
    console,
    document: {
      addEventListener() {},
      createElement(tag) {
        return { tag, className: '', innerHTML: '' };
      },
      getElementById(id) {
        return id === 'chat-messages' ? messages : null;
      },
    },
  };

  runScript('chat.js', context);
  context.addChatMsg('user', '<img src=x onerror=alert(1)>');
  context.addChatMsg('bot', '<strong>safe bot html</strong>');

  assert.equal(messages.children.length, 2);
  assert.match(messages.children[0].innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(messages.children[0].innerHTML, /<img/);
  assert.match(messages.children[1].innerHTML, /<strong>safe bot html<\/strong>/);
});

test('vercel rewrites the chat lending endpoint to its static data file', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.ok(
    config.rewrites.some((rewrite) => (
      rewrite.source === '/api/lending' &&
      rewrite.destination === '/api/lending.json'
    )),
    'expected /api/lending rewrite to serve api/lending.json'
  );
});
