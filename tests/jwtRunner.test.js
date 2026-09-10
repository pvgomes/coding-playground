import { decodeJwt } from '../src/js/runner/jwtRunner.js';

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

  it('throws when token does not have 3 parts', () => {
    expect(() => decodeJwt('abc.def')).to.throw('3 dot-separated parts');
  });
});
