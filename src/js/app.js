import {
  loadFSFor,
  saveFSFor,
  loadOpenFileFor,
  saveOpenFileFor,
  defaultFSFor,
  resetFS
} from './fs.js';
import { consoleClear, consoleLog, consoleError, consoleSystem } from './console.js';
import {
  createEditor,
  getEditorValue,
  setEditorValue,
  setEditorVisible,
  onEditorChange,
  setEditorMode,
  refreshEditor,
  upgradeToCodeMirror
} from './editor.js';
import { buildTree } from './ui/fileTree.js';
import { initModal, showModal } from './ui/modal.js';
import { createPyodideRunner } from './runner/pyodideRunner.js';
import { createJsRunner } from './runner/jsRunner.js';
import { createClojureRunner } from './runner/clojureRunner.js';
import { createMarkdownRunner } from './runner/markdownRunner.js';
import { createHtmlRunner } from './runner/htmlRunner.js';
import { createPlaintextRunner } from './runner/plaintextRunner.js';
import { createLuaRunner } from './runner/luaRunner.js';
import { createCleanAiTextRunner } from './runner/cleanAiTextRunner.js';

const runnerCallbacks = {
  onStdout: consoleLog,
  onStderr: consoleError,
  onSystem: consoleSystem
};

const LS_FONT_SIZE = 'pyplay_fontsize';
const LS_LANGUAGE = 'pyplay_language';
const MIN_EDITOR_WIDTH = 300;

let fs = {};
let openFile = null;
let cmEditor = null;
let runner = null;
let currentLanguage = 'python';
let folderOpen = {};
const folderOpenByLang = {};
const runners = {};

const languageModeMap = {
  python: 'python',
  javascript: 'javascript',
  typescript: { name: 'javascript', typescript: true },
  clojure: 'clojure',
  markdown: 'markdown',
  html: 'text/html',
  php: 'php',
  lua: 'lua',
  plaintext: 'text',
  'clean-ai-text': 'text'
};

const languageExtMap = {
  python: '.py',
  javascript: '.js',
  typescript: '.ts',
  clojure: '.clj',
  markdown: '.md',
  html: '.html',
  php: '.php',
  lua: '.lua',
  plaintext: '.txt',
  'clean-ai-text': '.txt'
};

function detectLanguageFromPath(path) {
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.clj') || path.endsWith('.cljs')) return 'clojure';
  if (path.endsWith('.md') || path.endsWith('.markdown')) return 'markdown';
  if (path.endsWith('.html') || path.endsWith('.htm')) return 'html';
  if (path.endsWith('.php')) return 'php';
  if (path.endsWith('.lua')) return 'lua';
  if (path.endsWith('.txt')) return currentLanguage === 'clean-ai-text' ? 'clean-ai-text' : 'plaintext';
  return currentLanguage;
}

function setLanguage(lang) {
  const select = document.getElementById('language-select');
  if (select && select.value !== lang) select.value = lang;
  setEditorMode(cmEditor, languageModeMap[lang] || 'python');
}

function getDefaultFileName(lang) {
  return 'main' + (languageExtMap[lang] || '.py');
}

function ensureFolderOpen(lang) {
  folderOpen = folderOpenByLang[lang] || (folderOpenByLang[lang] = {});
}

function persistCurrentLanguageState() {
  if (openFile && fs[openFile]) {
    fs[openFile].content = getEditorValue(cmEditor);
  }
  saveFSFor(fs, currentLanguage);
  saveOpenFileFor(openFile, currentLanguage);
}

function loadLanguageState(lang) {
  ensureFolderOpen(lang);
  fs = loadFSFor(lang);
  openFile = loadOpenFileFor(lang);
  const defaultFile = getDefaultFileName(lang);
  if (!fs[defaultFile]) {
    const defaults = defaultFSFor(lang);
    fs[defaultFile] = defaults[defaultFile];
    saveFSFor(fs, lang);
  }
}

function switchLanguage(lang) {
  if (lang === currentLanguage) return;
  
  // SAVE current file's content BEFORE switching filesystems
  if (openFile && fs[openFile]) {
    fs[openFile].content = getEditorValue(cmEditor);
  }
  
  persistCurrentLanguageState();
  currentLanguage = lang;
  localStorage.setItem(LS_LANGUAGE, lang);
  setLanguage(lang);
  loadLanguageState(lang);
  void ensureRunner(currentLanguage).then(r => { runner = r; });

  const fileToOpen = (openFile && fs[openFile]) ? openFile : getDefaultFileName(lang);
  openFileInEditor(fileToOpen);
  refreshEditor(cmEditor);
}

async function ensureRunner(lang) {
  if (runners[lang]) return runners[lang];

  if (lang === 'python') {
    runners[lang] = createPyodideRunner(runnerCallbacks);
  } else if (lang === 'javascript') {
    runners[lang] = createJsRunner(runnerCallbacks);
  } else if (lang === 'clojure') {
    runners[lang] = createClojureRunner(runnerCallbacks);
  } else if (lang === 'markdown') {
    runners[lang] = createMarkdownRunner(runnerCallbacks);
  } else if (lang === 'html') {
    runners[lang] = createHtmlRunner(runnerCallbacks);
  } else if (lang === 'plaintext') {
    runners[lang] = createPlaintextRunner(runnerCallbacks);
  } else if (lang === 'typescript') {
    const { createTypeScriptRunner } = await import('./runner/typescriptRunner.js');
    runners[lang] = createTypeScriptRunner(runnerCallbacks);
  } else if (lang === 'php') {
    const { createPhpRunner } = await import('./runner/phpRunner.js');
    runners[lang] = createPhpRunner(runnerCallbacks);
  } else if (lang === 'lua') {
    runners[lang] = createLuaRunner(runnerCallbacks);
  } else if (lang === 'clean-ai-text') {
    runners[lang] = createCleanAiTextRunner(runnerCallbacks);
  }

  return runners[lang];
}

function openFileInEditor(path, opts = {}) {
  if (opts.rebuildOnly) {
    rebuildTree();
    return;
  }

  console.log(`[OPENFILE] Requested path:`, path);

  // Defensive: if the requested file doesn't exist, find a valid file to open
  let fileToOpen = path;
  if (!fs[path] || fs[path].type !== 'file') {
    console.log(`[OPENFILE] File ${path} not found in fs, looking for fallback`);
    // Try default file for the current language
    const defaultFile = getDefaultFileName(currentLanguage);
    if (fs[defaultFile] && fs[defaultFile].type === 'file') {
      console.log(`[OPENFILE] Using default file:`, defaultFile);
      fileToOpen = defaultFile;
    } else {
      // Find the first file in the filesystem
      fileToOpen = Object.keys(fs).find(key => fs[key] && fs[key].type === 'file');
      if (!fileToOpen) {
        console.log(`[OPENFILE] No files found in fs`);
        // No files exist, nothing to open
        return;
      }
      console.log(`[OPENFILE] Using first available file:`, fileToOpen);
    }
  }

  console.log(`[OPENFILE] Final file to open:`, fileToOpen);
  console.log(`[OPENFILE] File content length:`, fs[fileToOpen].content?.length || 0);

  openFile = fileToOpen;
  saveOpenFileFor(openFile, currentLanguage);

  const detected = detectLanguageFromPath(fileToOpen);
  setEditorMode(cmEditor, languageModeMap[detected] || languageModeMap[currentLanguage]);

  const noMsg = document.getElementById('no-file-msg');
  if (noMsg) noMsg.style.display = 'none';

  console.log(`[OPENFILE] Calling setEditorValue with content length:`, (fs[fileToOpen].content || '').length);
  setEditorValue(cmEditor, fs[fileToOpen].content || '', true);
  setEditorVisible(cmEditor, true);

  const bc = document.getElementById('breadcrumb');
  bc.innerHTML = fileToOpen.split('/').map((seg, i, arr) =>
    i === arr.length - 1 ? `<span>${seg}</span>` : seg
  ).join(' / ');

  rebuildTree();
}

function rebuildTree() {
  requestAnimationFrame(() => {
    const container = document.getElementById('file-tree');
    buildTree({
      fs,
      openFile,
      folderOpen,
      container,
      onOpenFile: openFileInEditor,
      onDeleteItem: deleteItem
    });
  });
}

function deleteItem(path) {
  const isFolder = fs[path] && fs[path].type === 'folder';
  const msg = isFolder
    ? `Delete folder "${path}" and all its contents?`
    : `Delete file "${path}"?`;
  if (!confirm(msg)) return;

  for (const key of Object.keys(fs)) {
    if (key === path || key.startsWith(path + '/')) {
      delete fs[key];
    }
  }

  if (openFile && (openFile === path || openFile.startsWith(path + '/'))) {
    openFile = null;
    saveOpenFileFor(openFile, currentLanguage);
    setEditorValue(cmEditor, '', true);
    setEditorVisible(cmEditor, false);
    document.getElementById('no-file-msg').style.display = '';
    document.getElementById('breadcrumb').textContent = 'No file open';
  }

  saveFSFor(fs, currentLanguage);
  rebuildTree();
}

function createItem({ name, type, parentPath }) {
  let finalName = name;
  if (type === 'file' && !finalName.split('/').pop().includes('.')) {
    finalName += languageExtMap[currentLanguage] || '.py';
  }

  const path = parentPath ? parentPath + '/' + finalName : finalName;

  if (fs[path]) {
    alert(`"${path}" already exists.`);
    return;
  }

  if (type === 'file') {
    fs[path] = { type: 'file', content: '' };
    saveFSFor(fs, currentLanguage);
    rebuildTree();
    openFileInEditor(path);
  } else {
    fs[path] = { type: 'folder', content: null };
    folderOpen[path] = true;
    saveFSFor(fs, currentLanguage);
    rebuildTree();
  }
}

async function runCode() {
  runner = await ensureRunner(currentLanguage);
  if (!runner) return;

  if (openFile && fs[openFile]) {
    fs[openFile].content = getEditorValue(cmEditor);
    saveFSFor(fs, currentLanguage);
  }

  const code = getEditorValue(cmEditor);
  consoleClear();

  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Running…';

  try {
    if (!runner.isReady()) {
      await runner.load();
    }
    await runner.run(code);
  } catch (err) {
    consoleError(String(err));
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Run';
  }
}

function applyFontSize(size) {
  const clamped = Math.max(10, Math.min(40, size));
  document.documentElement.style.setProperty('--font-size', clamped + 'px');
  document.getElementById('font-size-label').textContent = clamped + 'px';
  if (cmEditor && cmEditor.textarea) cmEditor.textarea.style.fontSize = 'var(--font-size)';
  if (cmEditor && cmEditor.cm) cmEditor.cm.setOption('fontSize', clamped + 'px');
  refreshEditor(cmEditor);
  localStorage.setItem(LS_FONT_SIZE, clamped);
  return clamped;
}

function initConsoleResizer() {
  const resizer = document.getElementById('console-resizer');
  const rightPane = document.getElementById('right-pane');
  const main = document.getElementById('main');
  let dragging = false;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = main.getBoundingClientRect();
    const newWidth = rect.right - e.clientX;
    const minWidth = 150;
    const maxWidth = rect.width - MIN_EDITOR_WIDTH;
    rightPane.style.width = Math.max(minWidth, Math.min(maxWidth, newWidth)) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

function updateBootStatus(msg) {
  const banner = document.getElementById('boot-banner');
  if (banner) banner.textContent = msg;
}

async function boot() {
  try {
    const banner = document.getElementById('boot-banner');
    if (banner) {
      banner.textContent = 'Loading...';
    }
    
    console.log('1. Boot starting');
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === '1') {
      localStorage.clear();
    }
    
    const storedLang = localStorage.getItem(LS_LANGUAGE);
    if (storedLang && languageModeMap[storedLang]) {
      currentLanguage = storedLang;
    }
    ensureFolderOpen(currentLanguage);

    console.log('2. Loading FS');
    loadLanguageState(currentLanguage);
    console.log('3. FS loaded:', Object.keys(fs).length);
    
    console.log('4. Creating editor');
    const editorWrapper = document.getElementById('editor-wrapper');
    cmEditor = createEditor(editorWrapper);
    console.log('5. Editor created');
    
    onEditorChange(cmEditor, () => {
      if (openFile && fs[openFile]) {
        fs[openFile].content = getEditorValue(cmEditor);
        saveFSFor(fs, currentLanguage);
      }
    });
    
    console.log('6. Setting up runner');
    runner = await ensureRunner(currentLanguage);
    console.log('7. Runner created');
    
    document.getElementById('run-btn').disabled = false;
    
    if (banner) banner.remove();
    console.log('9. Banner removed - BOOT COMPLETE');
    
    // UI setup happens immediately after boot
    setTimeout(() => {
      console.log('10. Post-boot setup starting');
      
      document.getElementById('run-btn').addEventListener('click', runCode);
      document.getElementById('language-select').addEventListener('change', e => {
        switchLanguage(e.target.value);
      });
      document.getElementById('add-btn').addEventListener('click', () => showModal(null));
      initModal({ onCreate: createItem });
      
      // Toggle Explorer
      document.getElementById('toggle-explorer').addEventListener('click', () => {
        const leftPane = document.getElementById('left-pane');
        leftPane.classList.toggle('hidden');
      });
      
      const savedSize = parseInt(localStorage.getItem(LS_FONT_SIZE), 10);
      let currentFontSize = applyFontSize(savedSize > 0 ? savedSize : 14);
      document.getElementById('font-increase')
        .addEventListener('click', () => { currentFontSize = applyFontSize(currentFontSize + 1); });
      document.getElementById('font-decrease')
        .addEventListener('click', () => { currentFontSize = applyFontSize(currentFontSize - 1); });
      
      initConsoleResizer();
      setLanguage(currentLanguage);
      
      if (openFile && fs[openFile]) {
        openFileInEditor(openFile);
      } else {
        openFileInEditor(getDefaultFileName(currentLanguage));
      }
      console.log('11. Post-boot setup complete');
    }, 10);
    
    // Load CodeMirror from local files (2 seconds after boot)
    setTimeout(async () => {
      try {
        console.log('12. Starting CodeMirror upgrade...');
        consoleSystem('Loading syntax highlighting...');

        await upgradeToCodeMirror(cmEditor, editorWrapper);

        console.log('13. CodeMirror created, setting mode...');
        if (openFile) {
          setEditorMode(cmEditor, languageModeMap[currentLanguage]);
        }

        console.log('14. CodeMirror upgrade complete');
        consoleSystem('Syntax highlighting ready.');
      } catch (err) {
        console.error('CodeMirror upgrade failed:', err);
        consoleSystem('Syntax highlighting unavailable (using plain text mode).');
      }
    }, 2000);
    
  } catch (err) {
    console.error('BOOT ERROR:', err);
    alert('Boot failed: ' + err.message);
  }
}

// Module scripts are deferred, so DOMContentLoaded may have already fired
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
