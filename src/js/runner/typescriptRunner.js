import * as esbuild from '../../../vendor/esbuild-wasm/esm/browser.js';
import { createJsRunner } from './jsRunner.js';

const WASM_URL = new URL('../../../vendor/esbuild-wasm/esbuild.wasm', import.meta.url).href;

let esbuildReady = false;

async function ensureEsbuild() {
  if (esbuildReady) return;
  await esbuild.initialize({ wasmURL: WASM_URL });
  esbuildReady = true;
}

export function createTypeScriptRunner(callbacks) {
  const jsRunner = createJsRunner(callbacks);

  async function load() {
    callbacks.onSystem('Loading TypeScript compiler...');
    await ensureEsbuild();
    await jsRunner.load();
    callbacks.onSystem('TypeScript runtime ready.');
  }

  async function run(code) {
    await ensureEsbuild();
    const { code: js, warnings } = await esbuild.transform(code, {
      loader: 'ts',
      target: 'es2020'
    });
    for (const warning of warnings) {
      callbacks.onSystem(`Warning: ${warning.text}`);
    }
    await jsRunner.run(js);
  }

  return {
    load,
    run,
    isReady: () => esbuildReady
  };
}
