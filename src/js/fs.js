import { getStorage } from './storage.js';

export const LS_FS = 'pyplay_fs';
export const LS_OPEN = 'pyplay_open';
const LS_FS_PREFIX = 'pyplay_fs_';
const LS_OPEN_PREFIX = 'pyplay_open_';
const MAX_FS_BYTES = 500000;

export function defaultFS() {
  return defaultFSFor('python');
}

export function defaultFSFor(language) {
  const ext = language === 'javascript' ? '.js' : language === 'clojure' ? '.clj' : language === 'markdown' ? '.md' : '.py';
  const fileName = 'main' + ext;
  const content = language === 'javascript'
    ? 'console.log("hello world")'
    : language === 'clojure'
      ? '(println "hello world")'
      : language === 'markdown'
        ? '# Hello World\n\nThis is a **markdown** document.\n\n## Features\n\n- Headers\n- *Italic* and **bold** text\n- `inline code`\n- [Links](https://example.com)\n\n```javascript\nconsole.log("Code blocks");\n```'
        : 'print("hello world")';
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
