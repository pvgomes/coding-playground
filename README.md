# Coding Playground

A fast, browser-based multi-language coding playground and markdown viewer with syntax highlighting and file management. Write, run, and test Python, JavaScript, Clojure, Markdown, and HTML directly in your browser—no server required, no advertisements.

Attention Replit, you're nice, but sometimes people just want to run a simple code.

## Features

✨ **Multi-Language Support**
- **Python** – Powered by Pyodide
- **JavaScript** – Native browser execution via Web Worker
- **Clojure** – Scittle runtime with full output capture
- **Markdown** – Live preview with HTML rendering
- **HTML** – Live preview with interactive elements
- **Base64 Image** – Decode a pasted Base64 image or `data:image/...;base64,...` URL into a preview
- **Image Cleanup** – Upload an image at `/cleanup`, remove its existing metadata, and download a JPEG with a new description and today’s timestamps

🎨 **Code Editor**
- Syntax highlighting with CodeMirror 5 (Dracula theme)
- Font size adjustment (10–40px)
- Responsive, minimal boot (~100ms with deferred syntax highlighting)

💾 **Per-Language Persistence**
- Each language maintains its own file tree and code
- localStorage-based persistence—code survives page refreshes
- Create folders and files for organized development

🚀 **Fast Performance**
- Instant page load with deferred CodeMirror upgrade
- No CDN dependencies—all runtimes bundled locally
- CodeMirror and Scittle loaded from vendor/

📁 **File Management**
- Create and organize files by language
- Collapse/expand folders to control view
- Delete files and folders
- Breadcrumb navigation

## Supported Extensions

- **Python**: `.py`
- **JavaScript**: `.js`
- **Clojure**: `.clj`

## How to Use

### Running Locally

```bash
# Start a local HTTP server in the project directory
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

### Using the Playground

1. **Select a Language** – Use the language dropdown in the topbar
2. **Create Files** – Click the `+` button in the Explorer to add files/folders
3. **Write Code** – Edit code in the editor
4. **Run Code** – Click the Run button or use the console
5. **Adjust Font** – Use A− and A+ buttons to resize text (10–40px)
6. **Preview a Base64 Image** – Select **Base64 Image**, paste raw Base64 or a Base64 image data URL, then click **Run**. PNG, JPEG, GIF, WebP, AVIF, BMP, and ICO are supported.
7. **Clean Image Metadata** – Open **Cleanup** in the top bar, upload an image, optionally add a description, then download the cleaned JPEG. If no description is supplied, it uses `image`.

### Code Execution

- **Python**: Executed via Pyodide WASM
- **JavaScript**: Runs in a Web Worker (isolated context)
- **Clojure**: Evaluated with Scittle, captures all `println` output

## Project Structure

```
coding-playground/
├── index.html                 # Main entry point
├── src/
│   ├── css/
│   │   └── styles.css        # UI styling (Dracula theme)
│   ├── js/
│   │   ├── app.js            # Main app logic, state management
│   │   ├── editor.js         # CodeMirror wrapper
│   │   ├── fs.js             # Per-language filesystem abstraction
│   │   ├── console.js        # Output buffering
│   │   ├── storage.js        # localStorage utilities
│   │   ├── ui/
│   │   │   ├── fileTree.js   # File browser UI
│   │   │   └── modal.js      # Create file/folder dialog
│   │   └── runner/
│   │       ├── pyodideRunner.js     # Python execution
│   │       ├── jsRunner.js          # JavaScript execution
│   │       └── clojureRunner.js     # Clojure execution + output capture
│   └── vendor/
│       ├── codemirror/       # CodeMirror 5.65.16 (local)
│       └── scittle/          # Scittle 0.6.21 (local, patched)
└── README.md
```

## Architecture

### Boot Sequence

1. **Instant Render** (~0ms)
   - HTML renders immediately with plain textarea
   - No blocking scripts

2. **Post-Boot Setup** (~10ms)
   - Event listeners attached
   - Filesystem loaded from localStorage
   - Default file opened

3. **CodeMirror Upgrade** (~2000ms)
   - Syntax highlighting loaded asynchronously
   - User can code while upgrade happens
   - No UI blocking

### State Management

- **Per-Language Storage**: Each language has isolated `fs` (filesystem) and `openFile`
- **Auto-Persistence**: File content saved on every keystroke
- **Language Switching**: Saves current language state before loading new language

### Runtime Isolation

- **Python**: WebAssembly via Pyodide (isolated from JavaScript)
- **JavaScript**: Web Worker (isolated execution context)
- **Clojure**: Scittle in main thread (captures console output)

## Customization

### Change Font Size Range
Edit `applyFontSize()` in `src/js/app.js`:
```javascript
const clamped = Math.max(10, Math.min(40, size)); // min: 10px, max: 40px
```

### Add a New Language
1. Create `src/js/runner/languageRunner.js`
2. Implement `createLanguageRunner({ onStdout, onStderr, onSystem })`
3. Register in `src/js/app.js`:
   ```javascript
   } else if (lang === 'language') {
     runners[lang] = createLanguageRunner({ ... });
   }
   ```
4. Add to dropdown in `index.html`
5. Add to language maps in `src/js/app.js`

### Modify Theme
Update CSS variables in `src/css/styles.css`:
```css
:root {
  --bg: #1e1e1e;
  --accent: #4CAF50;
  --text: #d4d4d4;
  /* ... */
}
```

## Implementation Details

### Console Output Capture
Clojure's `println` is captured by monkey-patching `console.log` during evaluation:
```javascript
const logs = [];
const originalLog = console.log;
console.log = (...args) => logs.push(args.join(' '));
// ... evaluate code ...
console.log = originalLog;
```

### File System Abstraction
Each language has its own localStorage key:
- `pyplay_fs_python` – Python filesystem
- `pyplay_fs_javascript` – JavaScript filesystem
- `pyplay_fs_clojure` – Clojure filesystem
- `pyplay_open_<lang>` – Currently open file per language

### CodeMirror Integration
- Loads asynchronously after 2 seconds to avoid blocking
- Updates editor instance without losing content
- Supports language-specific syntax highlighting

## Deployment

### GitHub Pages
1. Push to GitHub
2. Enable GitHub Pages in Settings → Pages
3. Deploy from `main` branch

### Static Hosting
Copy entire directory to any static host (Vercel, Netlify, etc.)

### Pull Request Validation

GitHub Actions validates the syntax of every frontend JavaScript module on pull requests to `main`. Configure the **JavaScript syntax** status check as required in the `main` branch protection rule to prevent merging a pull request when this validation fails.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires WebAssembly support (Pyodide)

## Author

Made by [pvgomes](https://pvgomes.com/)

## License

MIT
