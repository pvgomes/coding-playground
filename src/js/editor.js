const CM_CSS = [
  'vendor/codemirror/codemirror.min.css',
  'vendor/codemirror/theme/dracula.min.css'
];

const CM_SCRIPTS = [
  'vendor/codemirror/codemirror.min.js',
  'vendor/codemirror/mode/python/python.min.js',
  'vendor/codemirror/mode/javascript/javascript.min.js',
  'vendor/codemirror/mode/clojure/clojure.min.js',
  'vendor/codemirror/mode/markdown/markdown.min.js'
];

let cmLoadPromise = null;

function loadCssOnce(href) {
  if ([...document.styleSheets].some(sheet => sheet.href === href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src + '?v=' + Date.now();
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadCodeMirror() {
  if (window.CodeMirror) return;
  if (cmLoadPromise) return cmLoadPromise;

  cmLoadPromise = (async () => {
    CM_CSS.forEach(loadCssOnce);
    for (const src of CM_SCRIPTS) {
      await loadScriptOnce(src);
    }
  })();

  return cmLoadPromise;
}

export function createEditor(wrapper) {
  const textarea = document.createElement('textarea');
  textarea.spellcheck = false;
  textarea.wrap = 'off';
  textarea.style.width = '100%';
  textarea.style.height = '100%';
  textarea.style.background = 'transparent';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.color = 'inherit';
  textarea.style.font = 'inherit';
  textarea.style.fontSize = 'var(--font-size)';
  textarea.style.lineHeight = '1.6';
  textarea.style.padding = '12px';
  wrapper.appendChild(textarea);

  return { kind: 'textarea', textarea, _handlers: [] };
}

export function setEditorValue(editor, value, clearHistory = true) {
  if (editor.kind === 'codemirror') {
    editor.cm.setValue(value || '');
    if (clearHistory) editor.cm.clearHistory();
    editor.cm.refresh();
    return;
  }

  editor.textarea.value = value || '';
  if (clearHistory) editor.textarea.scrollTop = 0;
}

export function setEditorVisible(editor, visible) {
  if (editor.kind === 'codemirror') {
    editor.cm.getWrapperElement().style.display = visible ? '' : 'none';
    return;
  }
  editor.textarea.style.display = visible ? '' : 'none';
}

export function getEditorValue(editor) {
  if (editor.kind === 'codemirror') return editor.cm.getValue();
  return editor.textarea.value;
}

export function onEditorChange(editor, handler) {
  editor._handlers = editor._handlers || [];
  editor._handlers.push(handler);
  if (editor.kind === 'codemirror') {
    editor.cm.on('change', handler);
    return;
  }
  editor.textarea.addEventListener('input', handler);
}

export function setEditorMode(editor, mode) {
  if (editor.kind !== 'codemirror') return;
  requestAnimationFrame(() => {
    editor.cm.setOption('mode', mode);
    editor.cm.refresh();
  });
}

export function refreshEditor(editor) {
  if (editor.kind === 'codemirror') editor.cm.refresh();
}

export async function upgradeToCodeMirror(editor, wrapper) {
  if (editor.kind === 'codemirror') return;
  
  try {
    await loadCodeMirror();
  } catch (err) {
    console.error('Failed to load CodeMirror:', err);
    return;
  }

  // Yield to browser before heavy DOM work
  await new Promise(resolve => setTimeout(resolve, 0));

  const currentValue = editor.textarea.value;
  const textarea = editor.textarea;
  
  // Do CodeMirror creation in next frame to avoid blocking
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      try {
        const cm = CodeMirror.fromTextArea(textarea, {
          mode: 'python',
          theme: 'dracula',
          lineNumbers: true,
          indentUnit: 4,
          tabSize: 4,
          indentWithTabs: false,
          autofocus: false,
          lineWrapping: false,
          extraKeys: {
            Tab: cmInstance => cmInstance.execCommand('insertSoftTab')
          }
        });

        cm.setValue(currentValue || '');
        editor.kind = 'codemirror';
        editor.cm = cm;

        if (editor._handlers) {
          for (const handler of editor._handlers) {
            cm.on('change', handler);
          }
        }
        
        // Give CodeMirror another frame to settle
        requestAnimationFrame(() => {
          cm.refresh();
          resolve();
        });
      } catch (err) {
        console.error('CodeMirror creation failed:', err);
        resolve();
      }
    });
  });
}
