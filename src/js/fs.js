import { getStorage } from './storage.js';

export const LS_FS = 'pyplay_fs';
export const LS_OPEN = 'pyplay_open';
const LS_FS_PREFIX = 'pyplay_fs_';
const LS_OPEN_PREFIX = 'pyplay_open_';
const MAX_FS_BYTES = 500000;

export function defaultFS() {
  return defaultFSFor('python');
}

const defaultExtByLang = {
  python: '.py',
  javascript: '.js',
  typescript: '.ts',
  clojure: '.clj',
  markdown: '.md',
  html: '.html',
  php: '.php',
  lua: '.lua',
  plaintext: '.txt',
  'clean-ai-text': '.txt',
  'base64-image': '.base64'
};

const defaultContentByLang = {
  javascript: 'console.log("hello world")',
  typescript: 'const message: string = "hello world";\nconsole.log(message);',
  clojure: '(println "hello world")',
  markdown: '# Hello World\n\nThis is a **markdown** document.\n\n## Features\n\n- Headers\n- *Italic* and **bold** text\n- `inline code`\n- [Links](https://example.com)\n\n```javascript\nconsole.log("Code blocks");\n```',
  html: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Hello World</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n  <p>This is an HTML document.</p>\n  <button onclick="alert(\'Hello!\')">Click me</button>\n</body>\n</html>',
  php: '<?php\necho "hello world\\n";',
  lua: 'print("hello world")',
  plaintext: '# This is a heading\n\nPaste any **formatted** text here and click Run.\nThe output will show *clean plain text* without any formatting.\n\n- List items\n- Are stripped too\n\n`Code blocks` become plain text.',
  'clean-ai-text': 'This is AI-style text — with em dashes — and en dashes – scattered around.\n\nIt also uses spaced hyphens - like this - which we can clean up.\n\nPaste your text here and click Run to remove dashes and normalize spacing.',
  'base64-image': 'Paste a data URL or raw Base64 image here, then click Run.\n\nExample: a 32 x 32 pixel-art cat\ndata:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAkElEQVR42mNYd+fT/4HEDKMOGHXAqANwSUQHZuDE1NQz+B3w/tJuOCbWAaToGXXA4EwD+AyiBJPlAHMDR4rwqAModgAMF5zsh2NccUxIDcUOAPmIkAPwqRnaITBg2RBb6QbD77qngzE2ObIdgCs1k+oAXOZQNQTwYZpHAaEQosgB1E6MZLcJRx0w2i8YEQ4AAOpa+W5QlKQWAAAAAElFTkSuQmCC',
  python: 'print("hello world")'
};

export function defaultFSFor(language) {
  const ext = defaultExtByLang[language] || '.py';
  const fileName = 'main' + ext;
  const content = defaultContentByLang[language] || defaultContentByLang.python;
  return {
    [fileName]: { type: 'file', content }
  };
}

function fsKey(language) {
  return language ? LS_FS_PREFIX + language : LS_FS;
}

function openKey(language) {
  return language ? LS_OPEN_PREFIX + language : LS_OPEN;
}

export function loadFS(storage = getStorage()) {
  return loadFSFor(null, storage);
}

export function loadFSFor(language, storage = getStorage()) {
  const raw = storage.getItem(fsKey(language));
  if (raw) {
    if (raw.length > MAX_FS_BYTES) {
      resetFSFor(language, storage);
      return defaultFSFor(language || 'python');
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid fs');
      return parsed;
    } catch (_) {
      resetFSFor(language, storage);
      return defaultFSFor(language || 'python');
    }
  }
  const fs = defaultFSFor(language || 'python');
  saveFSFor(fs, language, storage);
  return fs;
}

export function resetFS(storage = getStorage()) {
  resetFSFor(null, storage);
}

export function resetFSFor(language, storage = getStorage()) {
  storage.removeItem(fsKey(language));
  storage.removeItem(openKey(language));
}

export function saveFS(fs, storage = getStorage()) {
  saveFSFor(fs, null, storage);
}

export function saveFSFor(fs, language, storage = getStorage()) {
  storage.setItem(fsKey(language), JSON.stringify(fs));
}

export function loadOpenFile(storage = getStorage()) {
  return loadOpenFileFor(null, storage);
}

export function loadOpenFileFor(language, storage = getStorage()) {
  return storage.getItem(openKey(language)) || null;
}

export function saveOpenFile(openFile, storage = getStorage()) {
  saveOpenFileFor(openFile, null, storage);
}

export function saveOpenFileFor(openFile, language, storage = getStorage()) {
  if (openFile) storage.setItem(openKey(language), openFile);
  else storage.removeItem(openKey(language));
}

export function buildTreeData(fs) {
  const tree = {};
  const paths = Object.keys(fs).sort((a, b) => {
    const aIsDir = fs[a].type === 'folder';
    const bIsDir = fs[b].type === 'folder';
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.localeCompare(b);
  });

  for (const path of paths) {
    const parts = path.split('/');
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!node[seg]) node[seg] = { __children: {} };
      node = node[seg].__children;
    }
    const last = parts[parts.length - 1];
    if (fs[path].type === 'folder') {
      if (!node[last]) node[last] = { __children: {} };
      node[last].__isFolder = true;
      node[last].__path = path;
    } else {
      node[last] = { __isFile: true, __path: path };
    }
  }

  return tree;
}
