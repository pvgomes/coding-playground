const SUPPORTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/x-icon'
]);

function detectMimeType(bytes) {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 6 &&
      (String.fromCharCode(...bytes.slice(0, 6)) === 'GIF87a' ||
       String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a')) {
    return 'image/gif';
  }
  if (bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' &&
      String.fromCharCode(...bytes.slice(8, 12)).startsWith('avif')) {
    return 'image/avif';
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 &&
      bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }
  return null;
}

function decodeBase64(value) {
  const normalized = value.replace(/[\s\r\n]+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) ||
      normalized.indexOf('=') !== -1 && !/=+$/.test(normalized)) {
    throw new Error('Enter valid Base64 image data.');
  }

  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch (_) {
    throw new Error('Enter valid Base64 image data.');
  }

  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export function decodeBase64Image(input) {
  const value = input.trim();
  const dataUrlMatch = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(value);
  const declaredMimeType = dataUrlMatch ? dataUrlMatch[1].toLowerCase() : null;

  if (declaredMimeType && !SUPPORTED_MIME_TYPES.has(declaredMimeType)) {
    throw new Error('Only PNG, JPEG, GIF, WebP, AVIF, BMP, and ICO images are supported.');
  }

  const bytes = decodeBase64(dataUrlMatch ? dataUrlMatch[2] : value);
  const detectedMimeType = detectMimeType(bytes);
  if (!detectedMimeType) {
    throw new Error('The decoded data is not a supported image.');
  }
  if (declaredMimeType && declaredMimeType !== detectedMimeType) {
    throw new Error('The data URL image type does not match the decoded image.');
  }

  return { bytes, mimeType: detectedMimeType };
}

export function createBase64ImageRunner({ onStdout, onStderr, onSystem }) {
  async function load() {
    onSystem('Base64 image decoder ready.');
  }

  async function run(code) {
    try {
      const { bytes, mimeType } = decodeBase64Image(code);
      const image = document.createElement('img');
      const preview = document.createElement('div');
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));

      preview.className = 'image-preview';
      image.src = url;
      image.alt = 'Decoded Base64 image';
      image.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      image.addEventListener('error', () => URL.revokeObjectURL(url), { once: true });
      preview.appendChild(image);
      document.getElementById('console-output').appendChild(preview);
      onStdout(`Rendered ${mimeType} image (${bytes.length.toLocaleString()} bytes).`);
    } catch (err) {
      onStderr(err.message);
    }
  }

  return {
    load,
    run,
    isReady: () => true
  };
}
