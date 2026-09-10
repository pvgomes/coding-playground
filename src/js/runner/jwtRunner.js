function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeBase64UrlJson(value, sectionName) {
  let text;
  try {
    text = new TextDecoder().decode(base64UrlToBytes(value));
  } catch (_) {
    throw new Error(`Invalid ${sectionName}: unable to decode Base64URL data.`);
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`Invalid ${sectionName}: expected JSON.`);
  }
}

function parseJwtInput(input) {
  const lines = input.split(/\r?\n/).map(line => line.trim());
  const nonComment = lines.filter(line => line && !line.startsWith('//'));
  const tokenLine = nonComment.find(line => line.includes('.'));

  if (!tokenLine) {
    throw new Error('Enter a JWT (header.payload.signature).');
  }

  const parts = tokenLine.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    throw new Error('JWT must contain 3 dot-separated parts.');
  }

  const fields = {};
  for (const line of nonComment) {
    if (line === tokenLine) continue;
    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) continue;
    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    if (value) fields[key] = value;
  }

  return { token: tokenLine, parts, secret: fields.secret || '' };
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function verifyJwtSignature({ algorithm, signingInput, signature, secret }) {
  if (!secret) {
    return { status: 'Not verified (optional): provide "secret: your-key" to verify HS256/HS384/HS512.' };
  }

  const map = {
    HS256: 'SHA-256',
    HS384: 'SHA-384',
    HS512: 'SHA-512'
  };
  const hash = map[algorithm];
  if (!hash) {
    return { status: `Not verified: algorithm "${algorithm || 'unknown'}" is not supported for local verification.` };
  }

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return { status: 'Not verified: Web Crypto is unavailable in this environment.' };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: { name: hash } },
    false,
    ['sign']
  );
  const expectedBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput)));
  const expected = toBase64Url(expectedBytes);
  const valid = constantTimeEqual(expected, signature);

  return {
    status: valid ? 'Verified ✅ (HMAC signature matches provided secret).' : 'Invalid signature ❌ (does not match provided secret).'
  };
}

export function decodeJwt(input) {
  const { token, parts, secret } = parseJwtInput(input);
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson(encodedHeader, 'header');
  const payload = decodeBase64UrlJson(encodedPayload, 'payload');
  return {
    token,
    encodedHeader,
    encodedPayload,
    encodedSignature,
    header,
    payload,
    secret
  };
}

function renderJwtResult({ token, header, payload, encodedSignature, verification }) {
  const prettyHeader = JSON.stringify(header, null, 2);
  const prettyPayload = JSON.stringify(payload, null, 2);
  const signature = encodedSignature || '(empty)';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>JWT Decoder</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #222; margin: 0; padding: 20px; background: #fff; }
    h3 { margin: 0 0 8px; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
    .section { border: 1px solid #e1e1e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .status { font-weight: 600; }
  </style>
</head>
<body>
  <div class="section"><h3>Token</h3><pre>${escapeHtml(token)}</pre></div>
  <div class="section"><h3>Decoded Header</h3><pre>${escapeHtml(prettyHeader)}</pre></div>
  <div class="section"><h3>Decoded Payload</h3><pre>${escapeHtml(prettyPayload)}</pre></div>
  <div class="section"><h3>JWT Signature</h3><pre>${escapeHtml(signature)}</pre></div>
  <div class="section"><h3>JWT Signature Verification (Optional)</h3><div class="status">${escapeHtml(verification.status)}</div></div>
</body>
</html>`;
}

export function createJwtRunner({ onStdout, onStderr, onSystem }) {
  async function load() {
    onSystem('JWT decoder ready.');
  }

  async function run(code) {
    try {
      const decoded = decodeJwt(code);
      const verification = await verifyJwtSignature({
        algorithm: decoded.header && decoded.header.alg,
        signingInput: `${decoded.encodedHeader}.${decoded.encodedPayload}`,
        signature: decoded.encodedSignature,
        secret: decoded.secret
      });

      const consoleOutput = document.getElementById('console-output');
      const existingIframe = consoleOutput.querySelector('iframe');
      if (existingIframe) existingIframe.remove();
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '420px';
      iframe.style.border = '1px solid #3c3c3c';
      iframe.style.borderRadius = '4px';
      iframe.style.marginTop = '8px';
      iframe.style.marginBottom = '8px';
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(renderJwtResult({ ...decoded, verification }));
      consoleOutput.appendChild(iframe);

      onStdout('JWT decoded.');
      onSystem(verification.status);
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
