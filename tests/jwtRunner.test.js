import { decodeJwt, verifyJwtSignature } from '../src/js/runner/jwtRunner.js';

describe('decodeJwt', () => {
  const encode = value => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const validToken = [
    encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    encode(JSON.stringify({ name: 'John Doe', admin: true })),
    'signature'
  ].join('.');

  it('decodes header and payload', () => {
    const decoded = decodeJwt(validToken);
    expect(decoded.header.alg).to.equal('HS256');
    expect(decoded.payload.name).to.equal('John Doe');
    expect(decoded.encodedSignature.length).to.be.greaterThan(0);
  });

  it('reads optional secret from input lines', () => {
    const decoded = decodeJwt(`${validToken}\nsecret: my-secret`);
    expect(decoded.secret).to.equal('my-secret');
  });

  it('reads optional secret even before the token line', () => {
    const decoded = decodeJwt(`secret: my-secret\n${validToken}`);
    expect(decoded.secret).to.equal('my-secret');
  });

  it('throws when token does not have 3 parts', () => {
    expect(() => decodeJwt('abc.def')).to.throw('3 dot-separated parts');
  });
});

describe('verifyJwtSignature', () => {
  const encoder = new TextEncoder();
  const toBase64Url = bytes => btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  async function signHs256(signingInput, secret) {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput)));
    return toBase64Url(signature);
  }

  it('returns unsupported status for non-HMAC algorithms', async () => {
    const result = await verifyJwtSignature({
      algorithm: 'RS256',
      signingInput: 'a.b',
      signature: 'c',
      secret: 'test'
    });
    expect(result.status).to.include('not supported');
  });

  it('returns verified status when HS256 signature matches secret', async () => {
    const signingInput = 'a.b';
    const secret = 'my-secret';
    const signature = await signHs256(signingInput, secret);
    const result = await verifyJwtSignature({ algorithm: 'HS256', signingInput, signature, secret });
    expect(result.status).to.include('Verified');
  });

  it('returns invalid status when HS256 signature does not match secret', async () => {
    const result = await verifyJwtSignature({
      algorithm: 'HS256',
      signingInput: 'a.b',
      signature: 'wrong-signature',
      secret: 'my-secret'
    });
    expect(result.status).to.include('Invalid signature');
  });
});
