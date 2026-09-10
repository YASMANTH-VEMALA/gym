const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calendarToday,
  normalizeMemberPhone,
  isCalendarDate,
  parseWeightGrams,
} = require('../dist/member-profile.js');
test('calendar dates respect business timezone without altering date-only values', () => {
  const now = new Date('2026-09-08T00:30:00Z');
  assert.equal(calendarToday('Asia/Kolkata', now), '2026-09-08');
  assert.equal(calendarToday('America/Los_Angeles', now), '2026-09-07');
  assert.equal(isCalendarDate('2024-02-29'), true);
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('2026-02-30'), false);
});
test('phone normalization preserves prefixes and weight conversion is exact', () => {
  assert.equal(normalizeMemberPhone('+91 (98765) 43210'), '+919876543210');
  assert.equal(normalizeMemberPhone('0091-98765-43210'), '00919876543210');
  assert.equal(parseWeightGrams('70.001'), 70001);
  for (const value of ['0', '-2', '70.0001', '1e2', '1000.001'])
    assert.throws(() => parseWeightGrams(value));
});
