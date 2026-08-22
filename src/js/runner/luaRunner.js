const FENGARI_URL = 'vendor/fengari/fengari-web.js';
let fengariScriptPromise = null;

function ensureFengariScript() {
  if (window.fengari?.load) return Promise.resolve();
  if (fengariScriptPromise) return fengariScriptPromise;

  fengariScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = FENGARI_URL + '?v=' + Date.now();
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Fengari'));
    document.head.appendChild(script);
  });

  return fengariScriptPromise;
}

export function createLuaRunner({ onStdout, onStderr, onSystem }) {
  async function load() {
    await ensureFengariScript();
    if (!window.fengari?.load) throw new Error('Lua runtime not available');
    onSystem('Lua runtime ready.');
  }

  async function run(code) {
    await ensureFengariScript();
    const { load } = window.fengari;
    if (!load) throw new Error('Lua runtime not available');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.map(arg => String(arg)).join('\t'));
    };

    try {
      const chunk = load(code, '@playground');
      const results = chunk();
      console.log = originalLog;

      if (logs.length) {
        logs.forEach(line => onStdout(line));
      } else if (results !== undefined && results !== null) {
        onStdout(String(results));
      } else {
        onSystem('(no output)');
      }
    } catch (err) {
      console.log = originalLog;
      onStderr(String(err));
    }
  }

  return {
    load,
    run,
    isReady: () => !!window.fengari?.load
  };
}
