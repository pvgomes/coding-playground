import { decodeBase64Image } from '../src/js/runner/base64ImageRunner.js';

describe('decodeBase64Image', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  it('decodes a raw Base64 PNG and detects its MIME type', () => {
    const image = decodeBase64Image(png);

    expect(image.mimeType).to.equal('image/png');
    expect(image.bytes).to.be.instanceOf(Uint8Array);
    expect(image.bytes.length).to.be.greaterThan(8);
  });

  it('accepts a PNG data URL', () => {
    const image = decodeBase64Image(`data:image/png;base64,${png}`);

    expect(image.mimeType).to.equal('image/png');
  });

  it('ignores lines beginning with // as comments', () => {
    const image = decodeBase64Image(`// Paste an image below.
  // Example: a 1 x 1 PNG
data:image/png;base64,${png}
// This line is ignored too.`);

    expect(image.mimeType).to.equal('image/png');
  });

  it('rejects data URLs whose declared type does not match the image', () => {
    expect(() => decodeBase64Image(`data:image/jpeg;base64,${png}`))
      .to.throw('does not match');
  });

  it('rejects Base64 data that is not a supported image', () => {
    expect(() => decodeBase64Image(btoa('not an image')))
      .to.throw('not a supported image');
  });
});
