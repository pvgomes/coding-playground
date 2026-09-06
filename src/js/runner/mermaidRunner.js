const MERMAID_SCRIPT = 'vendor/mermaid/mermaid.min.js';
let mermaidLoadPromise = null;
let renderCount = 0;

function loadMermaid() {
  if (window.mermaid) return Promise.resolve(window.mermaid);
  if (mermaidLoadPromise) return mermaidLoadPromise;

  mermaidLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MERMAID_SCRIPT;
    script.onload = () => {
      if (!window.mermaid) {
        reject(new Error('Mermaid.js loaded without exposing its renderer.'));
        return;
      }
      window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      resolve(window.mermaid);
    };
    script.onerror = () => reject(new Error('Failed to load Mermaid.js.'));
    document.head.appendChild(script);
  });

  return mermaidLoadPromise;
}

export function createMermaidRunner({ onStdout, onStderr, onSystem }) {
  let mermaid;

  async function load() {
    mermaid = await loadMermaid();
    onSystem('Mermaid renderer ready.');
  }

  async function run(code) {
    try {
      mermaid ||= await loadMermaid();
      const preview = document.createElement('div');
      preview.className = 'mermaid-preview';
      const id = `mermaid-preview-${renderCount++}`;
      const { svg, bindFunctions } = await mermaid.render(id, code);

      preview.innerHTML = svg;
      bindFunctions?.(preview);
      document.getElementById('console-output').appendChild(preview);
      onStdout('Mermaid diagram rendered in console.');
    } catch (err) {
      onStderr(`Error rendering Mermaid diagram: ${err.message}`);
    }
  }

  return {
    load,
    run,
    isReady: () => Boolean(mermaid)
  };
}
