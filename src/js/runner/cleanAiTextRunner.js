function cleanAiText(text) {
  return text
  // Em dash and en dash (common in AI copy) -> comma
    .replace(/\s*[—–]\s*/g, ', ')
    // Spaced hyphen used as a dash
    .replace(/\s+-\s+/g, ', ')
    // Horizontal rules made of dashes
    .replace(/^[\s]*[-–—]{3,}[\s]*$/gm, '')
    // Curly/smart quotes to straight quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Collapse repeated commas
    .replace(/,\s*,+/g, ', ')
    // Collapse extra spaces
    .replace(/[ \t]{2,}/g, ' ')
    // Trim trailing spaces on lines
    .replace(/[ \t]+$/gm, '')
    // Collapse 3+ blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderPreview(cleaned) {
  const escaped = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Clean AI Text</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #fff;
    }
    .label {
      font-size: 0.75em;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 8px;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      font-family: inherit;
      font-size: 1em;
    }
  </style>
</head>
<body>
  <div class="label">Cleaned text preview</div>
  <pre>${escaped}</pre>
</body>
</html>`;
}

export function createCleanAiTextRunner({ onStdout, onStderr, onSystem }) {
  async function load() {
    onSystem('Clean-AI-text tools ready.');
  }

  async function run(code) {
    try {
      const cleaned = cleanAiText(code);
      const consoleOutput = document.getElementById('console-output');

      const existingIframe = consoleOutput.querySelector('iframe');
      if (existingIframe) existingIframe.remove();

      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '400px';
      iframe.style.border = '1px solid #3c3c3c';
      iframe.style.borderRadius = '4px';
      iframe.style.marginTop = '8px';
      iframe.style.marginBottom = '8px';
      iframe.sandbox.add('allow-same-origin');
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(renderPreview(cleaned));
      consoleOutput.appendChild(iframe);

      onStdout('--- Cleaned text ---\n' + cleaned);
      onSystem('Removed em/en dashes and normalized spacing.');
    } catch (err) {
      onStderr('Error cleaning text: ' + err.message);
    }
  }

  return {
    load,
    run,
    isReady: () => true
  };
}
