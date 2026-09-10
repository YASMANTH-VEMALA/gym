require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { ConfigService } = require('@nestjs/config');
const {
  verifyAccessToken,
  AuthService,
} = require('../dist/modules/auth/auth.service');
const {
  newInvitationToken,
  hashToken,
} = require('../dist/modules/auth/invitation-token');
const subject = '11111111-1111-4111-8111-111111111111';

test('JWT claims, signature and asymmetric algorithm enforcement', async () => {
  const { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } =
    await import('jose');
  const pair = await generateKeyPair('ES256');
  const key = {
    ...(await exportJWK(pair.publicKey)),
    kid: 'first',
    alg: 'ES256',
  };
  const keys = createLocalJWKSet({ keys: [key] });
  const issuer = 'https://example.supabase.co/auth/v1';
  async function token(
    claims = {},
    signingKey = pair.privateKey,
    algorithm = 'ES256',
    kid = 'first',
  ) {
    return new SignJWT({
      sub: subject,
      iss: issuer,
      aud: 'authenticated',
      role: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      ...claims,
    })
      .setProtectedHeader({ alg: algorithm, kid })
      .sign(signingKey);
  }
  assert.equal(
    await verifyAccessToken(await token(), keys, issuer, 'ES256'),
    subject,
  );
  for (const claims of [
    { iss: 'https://attacker.test' },
    { aud: 'service_role' },
    { role: 'service_role' },
    { role: 'anon' },
    { is_anonymous: true },
    { exp: 1 },
    { sub: '' },
    { sub: 'not-a-uuid' },
    { exp: undefined },
    { nbf: Math.floor(Date.now() / 1000) + 300 },
  ]) {
    await assert.rejects(() =>
      token(claims).then((t) => verifyAccessToken(t, keys, issuer, 'ES256')),
    );
  }
  const forged = await generateKeyPair('ES256');
  await assert.rejects(() =>
    token({}, forged.privateKey).then((t) =>
      verifyAccessToken(t, keys, issuer, 'ES256'),
    ),
  );
  await assert.rejects(() =>
    token({}, pair.privateKey, 'ES256', 'unknown').then((t) =>
      verifyAccessToken(t, keys, issuer, 'ES256'),
    ),
  );
  await assert.rejects(() =>
    token({}, new Uint8Array(32), 'HS256').then((t) =>
      verifyAccessToken(t, keys, issuer, 'ES256'),
    ),
  );
  await assert.rejects(() =>
    verifyAccessToken('eyJhbGciOiJub25lIn0.e30.', keys, issuer, 'ES256'),
  );
  await assert.rejects(() =>
    verifyAccessToken('anything', keys, issuer, 'HS256'),
  );
});

test('remote JWKS caches keys and refreshes for rotation', async () => {
  const { generateKeyPair, exportJWK, createRemoteJWKSet, SignJWT } =
    await import('jose');
  const first = await generateKeyPair('ES256');
  const second = await generateKeyPair('ES256');
  let keys = [
    { ...(await exportJWK(first.publicKey)), kid: 'one', alg: 'ES256' },
  ];
  let calls = 0;
  const server = createServer((req, res) => {
    calls++;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const issuer = `http://127.0.0.1:${server.address().port}`;
  try {
    const remote = createRemoteJWKSet(new URL(issuer), {
      cooldownDuration: 0,
      timeoutDuration: 1000,
    });
    const mint = (pair, kid) =>
      new SignJWT({ role: 'authenticated' })
        .setProtectedHeader({ alg: 'ES256', kid })
        .setIssuer(issuer)
        .setAudience('authenticated')
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(pair.privateKey);
    const token = await mint(first, 'one');
    await verifyAccessToken(token, remote, issuer, 'ES256');
    await verifyAccessToken(token, remote, issuer, 'ES256');
    assert.equal(calls, 1);
    keys = [
      { ...(await exportJWK(second.publicKey)), kid: 'two', alg: 'ES256' },
    ];
    await verifyAccessToken(await mint(second, 'two'), remote, issuer, 'ES256');
    assert.equal(calls, 2);
    await assert.rejects(() =>
      mint(first, 'absent').then((t) =>
        verifyAccessToken(t, remote, issuer, 'ES256'),
      ),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('authentication fails closed without asymmetric configuration', async () => {
  const service = new AuthService(
    new ConfigService({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_JWT_ALGORITHM: 'HS256',
      SUPABASE_SERVICE_ROLE_KEY: 'secret',
    }),
  );
  await assert.rejects(() => service.authenticate('secret'), /Asymmetric/);
});

test('invitation token is random, 256 bits and only represented by SHA-256 hash', () => {
  const a = newInvitationToken();
  const b = newInvitationToken();
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(a.token, 'base64url').length, 32);
  assert.match(a.tokenHash, /^[0-9a-f]{64}$/);
  assert.notEqual(a.token, b.token);
  assert.equal(hashToken(a.token), a.tokenHash);
  assert.notEqual(a.token, a.tokenHash);
});
