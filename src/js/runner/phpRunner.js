import { PhpWeb } from '../../../vendor/php-wasm/PhpWeb.mjs';

const VENDOR_BASE = new URL('../../../vendor/php-wasm/', import.meta.url);

let php = null;

function wrapPhpCode(code) {
  const trimmed = code.trim();
  if (trimmed.startsWith('<?php') || trimmed.startsWith('<?')) return code;
  return `<?php\n${code}`;
}

export function createPhpRunner({ onStdout, onStderr, onSystem }) {
  async function load() {
    onSystem('Loading PHP runtime...');
    php = new PhpWeb({
      version: '8.4',
      locateFile: path => new URL(path, VENDOR_BASE).href
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('PHP runtime load timeout')), 120000);
      php.onready = () => {
        clearTimeout(timeout);
        resolve();
      };
      php.onerror = event => {
        clearTimeout(timeout);
        const message = event?.detail?.[0] || 'PHP runtime failed to initialize';
        reject(new Error(message));
      };
    });

    onSystem('PHP runtime ready.');
  }

  async function run(code) {
    if (!php) throw new Error('PHP runtime not initialized');

    const result = await php.exec(wrapPhpCode(code));
    if (result) {
      onStdout(String(result).trimEnd());
    } else {
      onSystem('(no output)');
    }
  }

  return {
    load,
    run,
    isReady: () => !!php
  };
}
