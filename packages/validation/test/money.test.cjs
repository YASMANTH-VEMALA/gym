const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseMoneyMinor,
  moneyInputValue,
  formatMoneyMinor,
} = require('../dist/money.js');
test('decimal prices convert exactly to integer minor units and round-trip', () => {
  for (const [input, minor] of [
    ['0.29', 29],
    ['1200.01', 120001],
    [' 3200 ', 320000],
    ['1.2', 120],
    ['10000000.00', 1000000000],
  ]) {
    assert.equal(parseMoneyMinor(input), minor);
    assert.equal(parseMoneyMinor(moneyInputValue(minor)), minor);
  }
  assert.equal(moneyInputValue(29), '0.29');
  assert.match(formatMoneyMinor(120029, 'INR'), /1,200\.29/);
});
test('price parsing rejects lossy, exponent and non-decimal input', () => {
  for (const value of [
    '1e3',
    '1,200',
    '-1',
    'NaN',
    '1.001',
    '',
    '.29',
    'Infinity',
  ])
    assert.throws(() => parseMoneyMinor(value));
  assert.throws(() => moneyInputValue(1.5));
});
