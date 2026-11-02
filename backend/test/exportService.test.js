const { test } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers/mockDb');
const { escapeCsv } = require('../src/services/exportService');

test('escapeCsv quotes commas, quotes, and newlines', () => {
  assert.equal(escapeCsv('hello'), 'hello');
  assert.equal(escapeCsv('hello,world'), '"hello,world"');
  assert.equal(escapeCsv('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsv('line1\nline2'), '"line1\nline2"');
  assert.equal(escapeCsv(null), '');
  assert.equal(escapeCsv(undefined), '');
});

test('escapeCsv neutralizes spreadsheet formula injection', () => {
  assert.equal(escapeCsv('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(escapeCsv('+1+1'), "'+1+1");
  assert.equal(escapeCsv('-1+1'), "'-1+1");
  assert.equal(escapeCsv('@cmd'), "'@cmd");
  assert.equal(escapeCsv('\t=1+1').startsWith("'"), true);
  assert.equal(escapeCsv('\r=1+1').startsWith("\"'"), true);
});

test('escapeCsv neutralizes formulas before applying CSV quoting', () => {
  assert.equal(escapeCsv('=1,2'), '"\'=1,2"');
  assert.equal(escapeCsv('@a,b'), '"\'@a,b"');
});
