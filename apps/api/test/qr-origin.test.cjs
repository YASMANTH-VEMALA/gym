require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveQrWebOrigin } = require('../dist/modules/qr/qr.service');

test('QR links prefer the deployed browser origin over a localhost fallback', () => {
  assert.equal(
    resolveQrWebOrigin('http://localhost:3000', 'https://gym-web.vercel.app'),
    'https://gym-web.vercel.app',
  );
});

test('QR links retain configured and local-development fallbacks', () => {
  assert.equal(
    resolveQrWebOrigin('https://gym.example.com'),
    'https://gym.example.com',
  );
  assert.equal(resolveQrWebOrigin(), 'http://localhost:3000');
  assert.throws(() => resolveQrWebOrigin('http://gym.example.com'));
});
